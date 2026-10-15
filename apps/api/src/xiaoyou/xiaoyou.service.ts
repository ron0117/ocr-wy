import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { AuthUser } from '@ocr/shared-types';
import { AccessService } from '../access/access.service';
import { PrismaService } from '../prisma/prisma.module';
import { StorageService } from '../storage/storage.service';
import type { SendAssistantMessageDto } from './dto';
import { IntentClient } from './intent-client';
import { describeMember, formatMemberList, type MemberField, type MemberSnapshot } from './member-lookup';
import { buildMemberWorkbook, formatShanghai, memberFileName } from './member-workbook';
import {
  formatClubList,
  isNewTopic,
  matchClubs,
  nearbyClubs,
  packTargets,
  planLocally,
  planPackAll,
  readPending,
  resolveMemberPick,
  resolvePending,
  type PendingState,
  type PlannedTool,
  type VisibleClub,
} from './plan';
import { AssistantRateLimit } from './rate-limit';
import { addressAs, SpeechBook } from './speech';

const BUSY = '管理员，小忧还在办上一件，等这一件说完再发。';
const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const DAY_MS = 24 * 60 * 60 * 1000;

interface Turn {
  scene: string;
  slots: Record<string, string>;
  must: string[];
  basicMode: boolean;
  pending: PendingState | null;
  replacePending: boolean;
  activeClubId?: string | null;
  replaceActive: boolean;
  tool: string;
  clubId: string | null;
  status: 'OK' | 'ERROR' | 'DENIED';
  errorCode: string | null;
  exportId?: string;
  started: number;
  request: string;
  facts: Record<string, unknown>;
  callerName: string;
}

interface DownloadView {
  exportId: string;
  fileName: string;
  clubName: string;
  memberCount: number;
  createdAt: string;
  expiresAt: string;
}

interface MessageView {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  download: DownloadView | null;
}

@Injectable()
export class XiaoyouService {
  private readonly logger = new Logger(XiaoyouService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly storage: StorageService,
    private readonly speech: SpeechBook,
    private readonly intent: IntentClient,
    private readonly rates: AssistantRateLimit,
  ) {}

  async current(user: AuthUser) {
    const session = await this.prisma.assistantSession.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    });
    if (!session) return { session: null };
    const messages = await this.prisma.assistantMessage.findMany({
      where: { sessionId: session.id, userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return {
      session: {
        id: session.id,
        processing: Boolean(session.processingClientRequestId),
        messages: await this.presentMessages(user.id, messages.reverse()),
      },
    };
  }

  async openSession(user: AuthUser) {
    const session = await this.prisma.assistantSession.create({
      data: { userId: user.id },
      select: { id: true },
    });
    return session;
  }

  async send(user: AuthUser, sessionId: string, dto: SendAssistantMessageDto) {
    this.rates.hit(user.id, user.name);
    const text = dto.text.trim();
    if (!text) throw new BadRequestException(addressAs('管理员，小忧没听到内容。', user.name));
    const session = await this.ownedSession(user.id, sessionId, user.name);
    const replay = await this.findReplay(session.id, user.id, dto.clientRequestId);
    if (replay) return replay;

    const claimed = await this.prisma.assistantSession.updateMany({
      where: { id: session.id, userId: user.id, processingClientRequestId: null },
      data: { processingClientRequestId: dto.clientRequestId },
    });
    if (!claimed.count) {
      const again = await this.findReplay(session.id, user.id, dto.clientRequestId);
      if (again) return again;
      throw new ConflictException(addressAs(BUSY, user.name));
    }

    const started = Date.now();
    try {
      const userMessage = await this.ensureUserMessage(session.id, user.id, dto.clientRequestId, text);
      const finished = await this.findReplay(session.id, user.id, dto.clientRequestId);
      if (finished) return finished;
      const turn = await this.safeTurn(user, session, text, started);
      turn.request = text;
      turn.callerName = user.name?.trim() ?? '';
      return await this.persist(user.id, session.id, userMessage.id, turn);
    } finally {
      await this.prisma.assistantSession.updateMany({
        where: { id: session.id, userId: user.id, processingClientRequestId: dto.clientRequestId },
        data: { processingClientRequestId: null },
      });
    }
  }

  async readExport(user: AuthUser, exportId: string) {
    const unavailable = this.speech.unavailable(user.name);
    const row = await this.prisma.assistantExport.findFirst({
      where: { id: exportId, userId: user.id, status: 'COMPLETED' },
    });
    if (!row || row.expiresAt.getTime() <= Date.now()) throw new NotFoundException(unavailable);
    const clubIds = row.clubIds.length ? row.clubIds : [row.clubId];
    try {
      for (const clubId of clubIds) await this.access.assertClub(user, clubId);
    } catch {
      throw new NotFoundException(unavailable);
    }
    try {
      const buffer = await this.storage.download(row.objectName);
      return { buffer, fileName: row.fileName };
    } catch {
      throw new NotFoundException(unavailable);
    }
  }

  private async safeTurn(
    user: AuthUser,
    session: { id: string; activeClubId: string | null; pending: unknown },
    text: string,
    started: number,
  ): Promise<Turn> {
    try {
      return await this.turn(user, session, text, started);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error instanceof Error ? error.message : '小忧处理失败');
      return this.plain('export-failed', {}, [], !this.intent.enabled(), started, 'export_club_members_excel', 'ERROR', 'EXPORT_FAILED');
    }
  }

  private async turn(
    user: AuthUser,
    session: { id: string; activeClubId: string | null; pending: unknown },
    text: string,
    started: number,
  ): Promise<Turn> {
    const basic = !this.intent.enabled();
    if (!this.canReadMembers(user) && !this.canReadActivities(user)) {
      const local = planLocally(text);
      if (local.tool === 'answer_help' && !session.pending) return this.help(started, basic);
      return this.plain('no-menu', {}, [], basic, started, local.tool, 'DENIED', 'NO_MENU');
    }

    const visible = await this.visibleClubs(user);
    const pending = readPending(session.pending);
    if (pending && !isNewTopic(text) && !planPackAll(text)) {
      if (pending.intent === 'activity') return this.pickActivity(user, pending, text, basic, started);
      if (pending.intent === 'lookup' && pending.playerNames?.length) {
        return this.pickMember(user, visible, pending, text, basic, started);
      }
      const ordered = pending.clubIds
        .map((id) => visible.find((club) => club.id === id))
        .filter((club): club is VisibleClub => Boolean(club));
      if (!ordered.length) return pending.intent === 'lookup'
        ? this.memberMissing(started, basic, '', pending.playerName ?? '')
        : this.missing(started, basic, text, visible);
      const picked = resolvePending(ordered, text, pending.kind);
      if (picked === 'reject') return pending.intent === 'lookup' ? this.memberAsk(started, basic) : this.ask(started, basic);
      if (picked && pending.intent === 'lookup') {
        return this.lookupInClubs(user, [picked], pending.playerName ?? '', pending.field ?? 'all', basic, started);
      }
      if (picked && pending.intent !== 'lookup') return this.runOnClub(user, session.id, pending.intent, picked, basic, started);
      return this.pendingTurn(pending, ordered, basic, started);
    }

    const planned = await this.plan(text, visible, session.activeClubId, []);
    return this.dispatch(user, session, visible, planned.tool, planned.basicMode, started);
  }

  private async plan(
    text: string,
    visible: VisibleClub[],
    activeClubId: string | null,
    pendingNames: string[],
  ): Promise<{ tool: PlannedTool; basicMode: boolean }> {
    const lookup = planLocally(text);
    if (
      lookup.tool === 'lookup_member' ||
      lookup.tool === 'list_activities' ||
      lookup.tool === 'get_activity' ||
      lookup.tool === 'activity_roster' ||
      lookup.tool === 'member_activities'
    ) {
      return { tool: lookup, basicMode: !this.intent.enabled() };
    }
    const packed = planPackAll(text);
    if (packed) {
      return {
        tool: { tool: 'export_club_members_excel', allMatching: true, clubName: packed.keyword },
        basicMode: !this.intent.enabled(),
      };
    }
    if (this.intent.enabled()) {
      const active = visible.find((club) => club.id === activeClubId)?.name ?? null;
      const model = await this.intent.plan(text, active, pendingNames, await this.clubCatalog(visible));
      if (model) return { tool: model, basicMode: false };
    }
    return { tool: planLocally(text), basicMode: true };
  }

  private async dispatch(
    user: AuthUser,
    session: { id: string; activeClubId: string | null },
    visible: VisibleClub[],
    tool: PlannedTool,
    basicMode: boolean,
    started: number,
  ): Promise<Turn> {
    if (tool.tool === 'answer_help') return this.help(started, basicMode);
    if (tool.tool === 'list_clubs') return this.list(visible, basicMode, started);
    if (tool.tool === 'list_activities' || tool.tool === 'get_activity' || tool.tool === 'activity_roster') {
      if (!this.canReadActivities(user)) {
        return this.plain('activity-no-menu', {}, ['活动签到'], basicMode, started, tool.tool, 'DENIED', 'NO_MENU');
      }
      if (tool.tool === 'list_activities') return this.listActivities(user, visible, tool.clubName, tool.status, basicMode, started);
      return this.openActivity(user, visible, tool.tool, tool.title, tool.clubName, tool.tool === 'activity_roster' ? tool.side : 'both', basicMode, started);
    }
    if (tool.tool === 'member_activities') {
      if (!this.canReadMembers(user)) {
        return this.plain('no-menu', {}, [], basicMode, started, tool.tool, 'DENIED', 'NO_MENU');
      }
      return this.memberActivities(user, visible, tool.playerName, tool.clubName, basicMode, started);
    }
    if (!this.canReadMembers(user)) {
      return this.plain('no-menu', {}, [], basicMode, started, tool.tool, 'DENIED', 'NO_MENU');
    }
    if (tool.tool === 'lookup_member') return this.lookupMember(user, visible, tool.playerName, tool.clubName, tool.field, basicMode, started);
    if (tool.tool === 'export_club_members_excel' && (tool.allMatching || (tool.clubNames?.length ?? 0) > 1)) {
      const clubs = tool.allMatching
        ? packTargets(visible, tool.clubName)
        : this.namedClubs(visible, tool.clubNames ?? []);
      if (!clubs.length) return this.missing(started, basicMode, tool.clubName ?? '', visible);
      if (clubs.length === 1) return this.runOnClub(user, session.id, 'export', clubs[0], basicMode, started);
      return this.exportClubs(user, session.id, clubs, basicMode, started, tool.clubName);
    }
    const clubName = tool.clubName?.trim();
    const intent = tool.tool === 'export_club_members_excel' ? 'export' : 'summary';
    if (!clubName) {
      const active = visible.find((club) => club.id === session.activeClubId);
      if (active) return this.runOnClub(user, session.id, intent, active, basicMode, started);
      return this.ask(started, basicMode);
    }
    const matched = matchClubs(visible, clubName);
    if (matched.type === 'exact') return this.runOnClub(user, session.id, intent, matched.club, basicMode, started);
    if (matched.type === 'confirm') return this.pendingTurn({ kind: 'confirm', clubIds: [matched.club.id], intent }, [matched.club], basicMode, started);
    if (matched.type === 'choice') {
      return this.pendingTurn(
        { kind: 'choose', clubIds: matched.clubs.map((club) => club.id), intent },
        matched.clubs,
        basicMode,
        started,
      );
    }
    return this.missing(started, basicMode, clubName, visible);
  }

  private async runOnClub(
    user: AuthUser,
    sessionId: string,
    intent: 'export' | 'summary',
    club: VisibleClub,
    basicMode: boolean,
    started: number,
  ): Promise<Turn> {
    try {
      await this.access.assertClub(user, club.id);
    } catch {
      return this.missing(started, basicMode, club.name, [club]);
    }
    if (intent === 'summary') return this.summary(club, basicMode, started);
    return this.exportClub(user, sessionId, club, basicMode, started);
  }

  private async summary(club: VisibleClub, basicMode: boolean, started: number): Promise<Turn> {
    const [count, latest] = await Promise.all([
      this.prisma.member.count({ where: { clubId: club.id } }),
      this.prisma.member.aggregate({ where: { clubId: club.id }, _max: { dataUpdatedAt: true } }),
    ]);
    const base = this.clubTurn('get_club_summary', club.id, basicMode, started);
    if (!count || !latest._max.dataUpdatedAt) {
      return {
        ...base,
        scene: 'summary-empty',
        slots: { clubName: club.name },
        must: [club.name, '0', '暂无人员数据更新时间'],
      };
    }
    const updated = formatShanghai(latest._max.dataUpdatedAt, 'minute');
    const leader = club.leader?.trim();
    return {
      ...base,
      scene: 'summary',
      slots: {
        clubName: club.name,
        leaderText: leader ? `会长是${leader}` : '会长还没填',
        memberCount: String(count),
        updatedText: `人员数据更新时间是 ${updated}`,
      },
      must: [club.name, String(count), updated],
    };
  }

  private async exportClub(
    user: AuthUser,
    sessionId: string,
    club: VisibleClub,
    basicMode: boolean,
    started: number,
  ): Promise<Turn> {
    const members = await this.prisma.member.findMany({
      where: { clubId: club.id },
      include: { club: { select: { name: true } } },
    });
    const base = this.clubTurn('export_club_members_excel', club.id, basicMode, started);
    if (!members.length) {
      return {
        ...base,
        scene: 'empty-members',
        slots: { clubName: club.name },
        must: [club.name, '暂无可导出的人员数据'],
        errorCode: 'NO_MEMBERS',
      };
    }
    const exportId = randomUUID();
    const createdAt = new Date();
    const fileName = memberFileName(club.name, createdAt);
    const objectName = `assistant/${user.id}/${exportId}.xlsx`;
    try {
      const buffer = buildMemberWorkbook(
        members.map((row) => ({
          rank: row.rank,
          playerName: row.playerName,
          clubName: club.name,
          level: row.level,
          path: row.path,
          score: row.score,
          fashion: row.fashion,
          weeklyActivity: row.weeklyActivity,
          joinedText: row.joinedText,
          dataUpdatedAt: row.dataUpdatedAt,
        })),
      );
      await this.storage.upload(objectName, buffer, MIME);
      await this.prisma.assistantExport.create({
        data: {
          id: exportId,
          sessionId,
          userId: user.id,
          clubId: club.id,
          clubIds: [club.id],
          clubName: club.name,
          objectName,
          fileName,
          memberCount: members.length,
          status: 'COMPLETED',
          expiresAt: new Date(createdAt.getTime() + DAY_MS),
          createdAt,
        },
      });
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : '人员名单生成失败');
      return { ...base, scene: 'export-failed', status: 'ERROR', errorCode: 'EXPORT_FAILED' };
    }
    return {
      ...base,
      scene: 'export-ready',
      slots: { clubName: club.name, memberCount: String(members.length) },
      must: [club.name, String(members.length)],
      facts: { clubName: club.name, memberCount: members.length, fileReady: true },
      exportId,
    };
  }

  private async exportClubs(
    user: AuthUser,
    sessionId: string,
    clubs: VisibleClub[],
    basicMode: boolean,
    started: number,
    keyword?: string,
  ): Promise<Turn> {
    const members = await this.prisma.member.findMany({
      where: { clubId: { in: clubs.map((club) => club.id) } },
      include: { club: { select: { name: true } } },
    });
    const counts = new Map(clubs.map((club) => [club.id, 0]));
    for (const row of members) counts.set(row.clubId, (counts.get(row.clubId) ?? 0) + 1);
    const clubFacts = clubs.map((club) => ({ name: club.name, memberCount: counts.get(club.id) ?? 0 }));
    const title = keyword?.trim() ? `${keyword.trim()}相关俱乐部` : clubs.map((club) => club.name).join('、');
    const base = this.plain('export-many', {}, [], basicMode, started, 'export_club_members_excel', 'OK', null);
    base.clubId = clubs[0]?.id ?? null;
    if (!members.length) {
      const names = clubs.map((club) => club.name).join('、');
      return {
        ...base,
        scene: 'empty-members',
        slots: { clubName: names },
        must: [...clubs.map((club) => club.name), '暂无可导出的人员数据'],
        facts: { clubs: clubFacts, fileReady: false },
        errorCode: 'NO_MEMBERS',
      };
    }
    const exportId = randomUUID();
    const createdAt = new Date();
    const fileName = memberFileName(title, createdAt);
    const objectName = `assistant/${user.id}/${exportId}.xlsx`;
    try {
      const buffer = buildMemberWorkbook(
        members.map((row) => ({
          rank: row.rank,
          playerName: row.playerName,
          clubName: clubs.find((club) => club.id === row.clubId)?.name ?? '',
          level: row.level,
          path: row.path,
          score: row.score,
          fashion: row.fashion,
          weeklyActivity: row.weeklyActivity,
          joinedText: row.joinedText,
          dataUpdatedAt: row.dataUpdatedAt,
        })),
      );
      await this.storage.upload(objectName, buffer, MIME);
      await this.prisma.assistantExport.create({
        data: {
          id: exportId,
          sessionId,
          userId: user.id,
          clubId: clubs[0].id,
          clubIds: clubs.map((club) => club.id),
          clubName: title,
          objectName,
          fileName,
          memberCount: members.length,
          status: 'COMPLETED',
          expiresAt: new Date(createdAt.getTime() + DAY_MS),
          createdAt,
        },
      });
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : '人员名单生成失败');
      return { ...base, scene: 'export-failed', status: 'ERROR', errorCode: 'EXPORT_FAILED', facts: { clubs: clubFacts, fileReady: false } };
    }
    return {
      ...base,
      scene: 'export-many',
      slots: { clubList: formatClubList(clubs), memberCount: String(members.length) },
      must: [...clubs.map((club) => club.name), String(members.length)],
      facts: { clubs: clubFacts, memberCount: members.length, fileReady: true },
      exportId,
    };
  }

  private async lookupMember(
    user: AuthUser,
    visible: VisibleClub[],
    playerName: string,
    clubName: string | undefined,
    field: MemberField,
    basicMode: boolean,
    started: number,
  ): Promise<Turn> {
    const name = playerName.trim();
    if (!name) return this.memberAsk(started, basicMode);
    const scoped = clubName?.trim();
    if (!scoped) return this.lookupInClubs(user, visible, name, field, basicMode, started);
    const matched = this.matchLookupClub(visible, scoped);
    if (matched.type === 'none') return this.lookupInClubs(user, visible, name, field, basicMode, started);
    if (matched.type !== 'exact') {
      const clubs = matched.type === 'confirm' ? [matched.club] : matched.clubs;
      return this.pendingTurn(
        {
          kind: matched.type === 'confirm' ? 'confirm' : 'choose',
          clubIds: clubs.map((club) => club.id),
          intent: 'lookup',
          playerName: name,
          field,
        },
        clubs,
        basicMode,
        started,
      );
    }
    return this.lookupInClubs(user, [matched.club], name, field, basicMode, started);
  }

  private matchLookupClub(visible: VisibleClub[], name: string) {
    const first = matchClubs(visible, name);
    if (first.type !== 'none') return first;
    const stripped = name.replace(/俱乐部$/u, '').trim();
    if (!stripped || stripped === name) return first;
    return matchClubs(visible, stripped);
  }

  private async lookupInClubs(
    user: AuthUser,
    clubs: VisibleClub[],
    query: string,
    field: MemberField,
    basicMode: boolean,
    started: number,
  ): Promise<Turn> {
    const name = query.trim();
    if (!clubs.length || !name) return this.memberMissing(started, basicMode, '', name);
    const rows = await this.prisma.member.findMany({
      where: { clubId: { in: clubs.map((club) => club.id) }, playerName: { contains: name } },
      include: { club: { select: { name: true } } },
      take: 40,
    });
    const exact = rows.filter((row) => row.playerName.trim() === name);
    const pool = exact.length ? exact : rows;
    const ordered = [...pool].sort((left, right) => {
      const leftClub = clubs.find((club) => club.id === left.clubId)?.name ?? '';
      const rightClub = clubs.find((club) => club.id === right.clubId)?.name ?? '';
      const byClub = leftClub.localeCompare(rightClub, 'zh');
      if (byClub) return byClub;
      return left.playerName.localeCompare(right.playerName, 'zh');
    }).slice(0, 8);
    if (!ordered.length) return this.memberMissing(started, basicMode, clubs.length === 1 ? clubs[0].name : '', name);
    if (exact.length === 1) {
      const club = clubs.find((item) => item.id === ordered[0].clubId);
      if (!club) return this.memberMissing(started, basicMode, '', name);
      return this.readMember(user, club, ordered[0], field, basicMode, started);
    }
    return this.memberPersonPending(exact.length === 0 && ordered.length === 1 ? 'confirm' : 'choose', ordered, clubs, name, field, basicMode, started);
  }

  private async pickMember(
    user: AuthUser,
    visible: VisibleClub[],
    pending: PendingState,
    text: string,
    basicMode: boolean,
    started: number,
  ): Promise<Turn> {
    const names = pending.playerNames ?? [];
    const options = pending.clubIds.flatMap((id, index) => {
      const club = visible.find((item) => item.id === id);
      const playerName = names[index];
      return club && playerName ? [{ club, playerName }] : [];
    });
    if (!options.length) return this.memberMissing(started, basicMode, '', pending.playerName ?? '');
    const picked = resolveMemberPick(
      options.map((item) => ({ clubName: item.club.name, playerName: item.playerName })),
      text,
      pending.kind,
    );
    if (picked === 'reject') return this.memberAsk(started, basicMode);
    if (typeof picked !== 'number') return this.replayMemberPending(pending, options, basicMode, started);
    const option = options[picked];
    const row = await this.prisma.member.findFirst({
      where: { clubId: option.club.id, playerName: option.playerName },
      include: { club: { select: { name: true } } },
    });
    if (!row) return this.memberMissing(started, basicMode, option.club.name, option.playerName);
    if (pending.follow === 'member_activities') return this.speakMemberActivities(user, row, basicMode, started);
    return this.readMember(user, option.club, row, pending.field ?? 'all', basicMode, started);
  }

  private async readMember(
    user: AuthUser,
    club: VisibleClub,
    row: { playerName: string; rank: number; level: number | null; path: string | null; score: number | null; fashion: number | null; weeklyActivity: number | null; joinedText: string | null; dataUpdatedAt: Date },
    field: MemberField,
    basicMode: boolean,
    started: number,
  ): Promise<Turn> {
    try {
      await this.access.assertClub(user, club.id);
    } catch {
      return this.memberMissing(started, basicMode, club.name, row.playerName);
    }
    const snapshot: MemberSnapshot = {
      playerName: row.playerName,
      clubName: club.name,
      rank: row.rank,
      level: row.level,
      path: row.path,
      score: row.score,
      fashion: row.fashion,
      weeklyActivity: row.weeklyActivity,
      joinedText: row.joinedText,
      updatedText: formatShanghai(row.dataUpdatedAt, 'minute'),
    };
    const described = describeMember(snapshot, field);
    return {
      ...this.clubTurn('lookup_member', club.id, basicMode, started),
      scene: 'member-ready',
      slots: { clubName: club.name, playerName: row.playerName, detail: described.detail },
      must: [club.name, row.playerName, ...described.must],
      facts: { clubName: club.name, playerName: row.playerName, field, detail: described.detail },
    };
  }

  private memberPersonPending(
    kind: PendingState['kind'],
    rows: Array<{ clubId: string; playerName: string }>,
    clubs: VisibleClub[],
    query: string,
    field: MemberField,
    basicMode: boolean,
    started: number,
  ): Turn {
    const options = rows.flatMap((row) => {
      const club = clubs.find((item) => item.id === row.clubId);
      return club ? [{ club, playerName: row.playerName }] : [];
    });
    if (!options.length) return this.memberMissing(started, basicMode, '', query);
    const pending: PendingState = {
      kind: options.length === 1 ? 'confirm' : kind,
      clubIds: options.map((item) => item.club.id),
      intent: 'lookup',
      playerName: query,
      playerNames: options.map((item) => item.playerName),
      field,
    };
    return this.replayMemberPending(pending, options, basicMode, started);
  }

  private replayMemberPending(
    pending: PendingState,
    options: Array<{ club: VisibleClub; playerName: string }>,
    basicMode: boolean,
    started: number,
  ): Turn {
    if (pending.kind === 'confirm') {
      const option = options[0];
      return {
        ...this.plain(
          'member-confirm',
          { clubName: option?.club.name ?? '', playerName: option?.playerName ?? '' },
          [option?.club.name ?? '', option?.playerName ?? '', '回小忧一声「是」'],
          basicMode,
          started,
          'lookup_member',
          'OK',
          'NEED_CONFIRM',
        ),
        pending,
        replacePending: true,
        replaceActive: false,
      };
    }
    const memberList = formatMemberList(options.map((item) => ({ clubName: item.club.name, playerName: item.playerName })));
    return {
      ...this.plain(
        'member-choice',
        { memberList },
        [...options.flatMap((item) => [item.club.name, item.playerName]), '说一个名字或序号'],
        basicMode,
        started,
        'lookup_member',
        'OK',
        'NEED_CHOICE',
      ),
      pending,
      replacePending: true,
      replaceActive: false,
    };
  }

  private memberMissing(started: number, basicMode: boolean, clubName: string, playerName: string): Turn {
    const name = playerName.trim() || '这个人';
    const scopeText = clubName
      ? `在「${clubName}」里没有这一位。核对名字后再问一次。`
      : '你能查看的俱乐部里没有这一位。核对名字后再问一次。';
    return this.plain(
      'member-missing',
      { playerName: name, scopeText },
      clubName ? [name, clubName, '没有这一位'] : [name, '没有这一位'],
      basicMode,
      started,
      'lookup_member',
      'OK',
      'NOT_FOUND',
    );
  }

  private memberAsk(started: number, basicMode: boolean): Turn {
    return this.plain('member-ask', {}, ['玩家名称'], basicMode, started, 'lookup_member', 'OK', 'NEED_NAME');
  }

  private list(clubs: VisibleClub[], basicMode: boolean, started: number): Turn {
    if (!clubs.length) {
      return this.plain('list-empty', {}, [], basicMode, started, 'list_clubs', 'OK', null);
    }
    return {
      ...this.plain('list-clubs', { clubList: formatClubList(clubs) }, clubs.map((club) => club.name), basicMode, started, 'list_clubs', 'OK', null),
    };
  }

  private pendingTurn(pending: PendingState, clubs: VisibleClub[], basicMode: boolean, started: number): Turn {
    if (pending.intent === 'lookup' && pending.playerName) {
      const scene = pending.kind === 'confirm' ? 'lookup-club-confirm' : 'lookup-club-choice';
      const slots: Record<string, string> = pending.kind === 'confirm'
        ? { clubName: clubs[0]?.name ?? '', playerName: pending.playerName }
        : { clubList: formatClubList(clubs), playerName: pending.playerName };
      const must = [
        ...clubs.map((club) => club.name),
        pending.playerName,
        pending.kind === 'confirm' ? '回小忧一声「是」' : '说一个名字或序号',
      ];
      return {
        ...this.plain(scene, slots, must, basicMode, started, 'lookup_member', 'OK', pending.kind === 'confirm' ? 'NEED_CONFIRM' : 'NEED_CHOICE'),
        pending,
        replacePending: true,
        replaceActive: false,
      };
    }
    const scene = pending.kind === 'confirm' ? 'need-confirm' : 'need-choice';
    const slots: Record<string, string> = pending.kind === 'confirm'
      ? { clubName: clubs[0]?.name ?? '' }
      : { clubList: formatClubList(clubs) };
    const must = [
      ...clubs.map((club) => club.name),
      pending.kind === 'confirm' ? '回小忧一声「是」' : '说一个名字或序号',
    ];
    return {
      ...this.plain(scene, slots, must, basicMode, started, 'find_club', 'OK', pending.kind === 'confirm' ? 'NEED_CONFIRM' : 'NEED_CHOICE'),
      pending,
      replacePending: true,
      replaceActive: false,
    };
  }

  private help(started: number, basicMode: boolean): Turn {
    return this.plain('help', {}, ['导出某某俱乐部人员名单', '查十三郎的非凡评分'], basicMode, started, 'answer_help', 'OK', null);
  }

  private ask(started: number, basicMode: boolean): Turn {
    return this.plain('ask-club', {}, [], basicMode, started, 'find_club', 'OK', 'NEED_NAME');
  }

  private missing(started: number, basicMode: boolean, requestedName = '', visible: VisibleClub[] = []): Turn {
    return {
      ...this.plain(
        'club-missing',
        {},
        ['没有找到你可访问的相关俱乐部，请检查名称后重试'],
        basicMode,
        started,
        'find_club',
        'OK',
        'NOT_FOUND',
      ),
      facts: {
        requestedName,
        accessibleClubs: nearbyClubs(visible, requestedName).map((club) => club.name),
      },
    };
  }

  private clubTurn(
    tool: string,
    clubId: string,
    basicMode: boolean,
    started: number,
  ): Turn {
    return {
      scene: 'help',
      slots: {},
      must: [],
      basicMode,
      pending: null,
      replacePending: true,
      activeClubId: clubId,
      replaceActive: true,
      tool,
      clubId,
      status: 'OK',
      errorCode: null,
      started,
      request: '',
      facts: {},
      callerName: '',
    };
  }

  private plain(
    scene: string,
    slots: Record<string, string>,
    must: string[],
    basicMode: boolean,
    started: number,
    tool: string,
    status: Turn['status'],
    errorCode: string | null,
  ): Turn {
    return {
      scene,
      slots,
      must,
      basicMode,
      pending: null,
      replacePending: true,
      replaceActive: false,
      tool,
      clubId: null,
      status,
      errorCode,
      started,
      request: '',
      facts: {},
      callerName: '',
    };
  }

  private async persist(userId: string, sessionId: string, userMessageId: string, turn: Turn) {
    const started = turn.started;
    const content = await this.spokenContent(turn);
    const [assistant] = await this.prisma.$transaction([
      this.prisma.assistantMessage.create({
        data: {
          sessionId,
          userId,
          role: 'ASSISTANT',
          content,
          scene: turn.scene,
          replyToMessageId: userMessageId,
          exportId: turn.exportId ?? null,
        },
      }),
      this.prisma.assistantToolCall.create({
        data: {
          sessionId,
          userId,
          tool: turn.tool,
          clubId: turn.clubId,
          status: turn.status,
          errorCode: turn.errorCode,
          durationMs: Math.max(0, Date.now() - started),
        },
      }),
      this.prisma.assistantSession.updateMany({
        where: { id: sessionId, userId },
        data: {
          ...(turn.replaceActive ? { activeClubId: turn.activeClubId ?? null } : {}),
          ...(turn.replacePending
            ? { pending: turn.pending ? ({ ...turn.pending } as Prisma.InputJsonValue) : Prisma.JsonNull }
            : {}),
        },
      }),
    ]);
    const message = await this.presentOne(userId, assistant);
    return { sessionId, processing: false, basicMode: turn.basicMode, message };
  }

  private async spokenContent(turn: Turn): Promise<string> {
    const fallback = this.speech.line(turn.scene, turn.slots, turn.must, turn.basicMode, turn.callerName);
    if (turn.basicMode || !this.intent.enabled()) return fallback;
    const drafted = await this.intent.speak({
      request: turn.request,
      facts: { ...turn.slots, ...turn.facts },
      must: turn.must,
    });
    if (!drafted) return fallback;
    return this.speech.acceptSpoken(drafted, turn.must, turn.callerName) ?? fallback;
  }

  private namedClubs(visible: VisibleClub[], names: string[]): VisibleClub[] {
    const picked: VisibleClub[] = [];
    for (const name of names) {
      const matched = matchClubs(visible, name);
      if (matched.type === 'exact' && !picked.some((club) => club.id === matched.club.id)) picked.push(matched.club);
    }
    return picked;
  }

  private async clubCatalog(visible: VisibleClub[]) {
    if (!visible.length) return [];
    const grouped = await this.prisma.member.groupBy({
      by: ['clubId'],
      where: { clubId: { in: visible.map((club) => club.id) } },
      _count: { _all: true },
    });
    const counts = new Map(grouped.map((row) => [row.clubId, row._count._all]));
    return visible.map((club) => ({
      name: club.name,
      leader: club.leader?.trim() || null,
      memberCount: counts.get(club.id) ?? 0,
    }));
  }

  private async ownedSession(userId: string, sessionId: string, callerName?: string | null) {
    const session = await this.prisma.assistantSession.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw new NotFoundException(addressAs('管理员，小忧没找到这场对话。', callerName));
    return session;
  }

  private async ensureUserMessage(sessionId: string, userId: string, clientRequestId: string, text: string) {
    const existing = await this.prisma.assistantMessage.findFirst({
      where: { sessionId, userId, role: 'USER', clientRequestId },
    });
    if (existing) return existing;
    try {
      return await this.prisma.assistantMessage.create({
        data: { sessionId, userId, role: 'USER', content: text, clientRequestId },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const raced = await this.prisma.assistantMessage.findFirst({
          where: { sessionId, userId, role: 'USER', clientRequestId },
        });
        if (raced) return raced;
      }
      throw error;
    }
  }

  private async findReplay(sessionId: string, userId: string, clientRequestId: string) {
    const userMessage = await this.prisma.assistantMessage.findFirst({
      where: { sessionId, userId, role: 'USER', clientRequestId },
    });
    if (!userMessage) return null;
    const assistant = await this.prisma.assistantMessage.findFirst({
      where: { sessionId, userId, role: 'ASSISTANT', replyToMessageId: userMessage.id },
    });
    if (!assistant) return null;
    return {
      sessionId,
      processing: false,
      basicMode: assistant.content.includes('自己在认话'),
      message: await this.presentOne(userId, assistant),
    };
  }

  private async visibleClubs(user: AuthUser): Promise<VisibleClub[]> {
    return this.prisma.club.findMany({
      where: this.access.clubWhere(user),
      select: { id: true, name: true, leader: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  private canReadMembers(user: AuthUser): boolean {
    return user.isSuper || user.menuKeys.includes('members');
  }

  private canReadActivities(user: AuthUser): boolean {
    return user.isSuper || user.menuKeys.includes('activities');
  }

  private async listActivities(
    user: AuthUser,
    visible: VisibleClub[],
    clubName: string | undefined,
    status: 'PUBLISHED' | 'ENDED' | undefined,
    basicMode: boolean,
    started: number,
  ): Promise<Turn> {
    const clubIds = clubName
      ? visible.filter((club) => club.name.includes(clubName) || clubName.includes(club.name)).map((club) => club.id)
      : null;
    if (clubIds && clubIds.length === 0) return this.missing(started, basicMode, clubName ?? '', visible);
    const rows = await this.prisma.activity.findMany({
      where: {
        AND: [
          this.access.activityWhere(user),
          ...(status ? [{ status }] : []),
          ...(clubIds ? [{ clubs: { some: { clubId: { in: clubIds } } } }] : []),
        ],
      },
      include: { clubs: { include: { club: { select: { name: true } } } } },
      orderBy: { startsAt: 'desc' },
      take: 30,
    });
    if (!rows.length) return this.plain('activity-empty', {}, ['没有这样的活动'], basicMode, started, 'list_activities', 'OK', 'EMPTY');
    const activityList = rows.map((row) => `「${row.title}」${formatShanghai(row.startsAt, 'minute')}`).join('、');
    return this.plain('activity-list', { activityList }, [activityList], basicMode, started, 'list_activities', 'OK', null);
  }

  private async openActivity(
    user: AuthUser,
    visible: VisibleClub[],
    tool: 'get_activity' | 'activity_roster',
    title: string | undefined,
    clubName: string | undefined,
    side: 'attended' | 'missed' | 'both',
    basicMode: boolean,
    started: number,
  ): Promise<Turn> {
    const rows = await this.prisma.activity.findMany({
      where: this.access.activityWhere(user),
      select: { id: true, title: true },
      orderBy: { startsAt: 'desc' },
    });
    const name = title?.trim();
    if (!name) {
      if (!rows.length) return this.plain('activity-empty', {}, ['没有这样的活动'], basicMode, started, tool, 'OK', 'EMPTY');
      return this.activityPending(tool, side, rows.slice(0, 8), basicMode, started);
    }
    const exact = rows.filter((row) => row.title.trim() === name);
    const pool = exact.length ? exact : rows.filter((row) => row.title.includes(name));
    if (!pool.length) return this.plain('activity-missing', { title: name }, [name], basicMode, started, tool, 'OK', 'NOT_FOUND');
    if (pool.length > 1) return this.activityPending(tool, exact.length === 1 ? side : side, pool.slice(0, 8), basicMode, started, exact.length === 0);
    return this.readActivity(user, visible, pool[0].id, tool, side, basicMode, started);
  }

  private activityPending(
    tool: 'get_activity' | 'activity_roster',
    side: 'attended' | 'missed' | 'both',
    rows: Array<{ id: string; title: string }>,
    basicMode: boolean,
    started: number,
    confirm = false,
  ): Turn {
    const activityList = rows.map((row, index) => `${index + 1}.「${row.title}」`).join('、');
    return {
      ...this.plain('activity-choice', { activityList }, [activityList], basicMode, started, tool, 'OK', confirm ? 'NEED_CONFIRM' : 'NEED_CHOICE'),
      pending: { kind: confirm ? 'confirm' : 'choose', intent: 'activity', clubIds: [], activityIds: rows.map((row) => row.id), activityTool: tool, rosterSide: side },
    };
  }

  private async pickActivity(
    user: AuthUser,
    pending: PendingState,
    text: string,
    basicMode: boolean,
    started: number,
  ): Promise<Turn> {
    const ids = pending.activityIds ?? [];
    const rows = await this.prisma.activity.findMany({
      where: { id: { in: ids }, AND: [this.access.activityWhere(user)] },
      select: { id: true, title: true },
    });
    const ordered = ids.flatMap((id) => rows.filter((row) => row.id === id));
    const trimmed = text.trim().replace(/[。.!！]$/u, '');
    if (/^(?:不是|不对|取消|算了|不要)$/u.test(trimmed)) {
      return this.plain('activity-missing', {}, ['说清楚标题'], basicMode, started, pending.activityTool ?? 'get_activity', 'OK', 'REJECTED');
    }
    const index = /^(?:第)?(\d{1,2})(?:个)?$/u.exec(trimmed);
    const picked = index ? ordered[Number(index[1]) - 1] : ordered.find((row) => row.title === trimmed || row.title.includes(trimmed));
    if (!picked) return this.activityPending(pending.activityTool ?? 'get_activity', pending.rosterSide ?? 'both', ordered, basicMode, started);
    return this.readActivity(user, [], picked.id, pending.activityTool ?? 'get_activity', pending.rosterSide ?? 'both', basicMode, started);
  }

  private async readActivity(
    user: AuthUser,
    _visible: VisibleClub[],
    activityId: string,
    tool: 'get_activity' | 'activity_roster',
    side: 'attended' | 'missed' | 'both',
    basicMode: boolean,
    started: number,
  ): Promise<Turn> {
    const activity = await this.prisma.activity.findFirst({
      where: { id: activityId, AND: [this.access.activityWhere(user)] },
      include: { clubs: { include: { club: { select: { name: true } } } }, attendances: true },
    });
    if (!activity) return this.plain('activity-missing', {}, ['没找到这场活动'], basicMode, started, tool, 'OK', 'NOT_FOUND');
    const clubIds = activity.clubs.map((item) => item.clubId);
    const members = await this.prisma.member.findMany({
      where: { clubId: { in: clubIds } },
      select: { id: true, playerName: true },
      orderBy: { playerName: 'asc' },
    });
    const marks = new Map(activity.attendances.flatMap((row) => (row.memberId ? [[row.memberId, row.late] as const] : [])));
    const attended = members.filter((member) => marks.has(member.id));
    const missed = members.filter((member) => !marks.has(member.id));
    const late = attended.filter((member) => marks.get(member.id));
    const clubList = activity.clubs.map((item) => item.club.name).join('、');
    const statusText = activity.status === 'PUBLISHED' ? '已发布' : '已结束';
    const startsAt = formatShanghai(activity.startsAt, 'minute');
    const detail = this.rosterText(attended, missed, late, side);
    const slots = {
      title: activity.title,
      clubList,
      startsAt,
      statusText,
      attendedCount: String(attended.length),
      missedCount: String(missed.length),
      lateCount: String(late.length),
      detail,
    };
    const must = [activity.title, String(attended.length), String(missed.length), String(late.length)];
    return this.plain(tool === 'get_activity' ? 'activity-ready' : 'activity-roster', slots, must, basicMode, started, tool, 'OK', null);
  }

  private rosterText(
    attended: Array<{ playerName: string }>,
    missed: Array<{ playerName: string }>,
    late: Array<{ playerName: string }>,
    side: 'attended' | 'missed' | 'both',
  ) {
    const lateNames = new Set(late.map((member) => member.playerName));
    const parts: string[] = [];
    if (side !== 'missed') parts.push(`已签到：${this.nameList(attended.map((member) => lateNames.has(member.playerName) ? `${member.playerName}（迟到）` : member.playerName))}`);
    if (side !== 'attended') parts.push(`未签到：${this.nameList(missed.map((member) => member.playerName))}`);
    return parts.join('。');
  }

  private nameList(names: string[]) {
    if (!names.length) return '没有人';
    if (names.length <= 30) return names.join('、');
    return `${names.slice(0, 30).join('、')}，还有 ${names.length - 30} 人`;
  }

  private async memberActivities(
    user: AuthUser,
    visible: VisibleClub[],
    playerName: string,
    clubName: string | undefined,
    basicMode: boolean,
    started: number,
  ): Promise<Turn> {
    return this.lookupMember(user, visible, playerName, clubName, 'all', basicMode, started).then(async (turn) => {
      if (turn.scene !== 'member-ready') {
        if (turn.pending?.intent === 'lookup') return { ...turn, pending: { ...turn.pending, follow: 'member_activities' as const } };
        return turn;
      }
      const club = visible.find((item) => item.id === turn.clubId);
      if (!club) return turn;
      const member = await this.prisma.member.findFirst({
        where: { clubId: club.id, playerName: turn.slots.playerName || playerName },
        select: { id: true, clubId: true, playerName: true },
      });
      if (!member) return turn;
      return this.speakMemberActivities(user, member, basicMode, started);
    });
  }

  private async speakMemberActivities(
    user: AuthUser,
    member: { id: string; clubId: string; playerName: string },
    basicMode: boolean,
    started: number,
  ): Promise<Turn> {
    const [attended, missed] = await Promise.all([
        this.prisma.activityAttendance.findMany({
          where: { memberId: member.id, activity: this.access.activityWhere(user) },
          include: { activity: { select: { title: true, startsAt: true } } },
          orderBy: { activity: { startsAt: 'desc' } },
        }),
        this.prisma.activity.findMany({
          where: {
            AND: [
              this.access.activityWhere(user),
              { clubs: { some: { clubId: member.clubId } } },
              { attendances: { none: { memberId: member.id } } },
            ],
          },
          select: { title: true },
          orderBy: { startsAt: 'desc' },
        }),
      ]);
      if (!attended.length && !missed.length) {
        return this.plain('member-activity-empty', { playerName: member.playerName }, [member.playerName, '没有纳入范围的活动'], basicMode, started, 'member_activities', 'OK', 'EMPTY');
      }
      const late = attended.filter((row) => row.late);
      const detail = [
        `已签到：${this.nameList(attended.map((row) => (row.late ? `${row.activity.title}（迟到）` : row.activity.title)))}`,
        `未签到：${this.nameList(missed.map((row) => row.title))}`,
      ].join('。');
      return this.plain(
        'member-activity-ready',
        {
          playerName: member.playerName,
          attendedCount: String(attended.length),
          missedCount: String(missed.length),
          lateCount: String(late.length),
          detail,
        },
        [member.playerName, String(attended.length), String(missed.length), String(late.length)],
        basicMode,
        started,
        'member_activities',
        'OK',
        null,
      );
  }

  private async presentMessages(userId: string, messages: Array<{ id: string; role: 'USER' | 'ASSISTANT'; content: string; createdAt: Date; exportId: string | null; userId: string }>): Promise<MessageView[]> {
    const exportIds = messages.flatMap((message) => (message.exportId ? [message.exportId] : []));
    const exports = exportIds.length
      ? await this.prisma.assistantExport.findMany({ where: { userId, id: { in: exportIds }, status: 'COMPLETED' } })
      : [];
    const byId = new Map(exports.map((row) => [row.id, row]));
    return messages.map((message) => this.toView(message, message.exportId ? byId.get(message.exportId) : undefined));
  }

  private async presentOne(userId: string, message: { id: string; role: 'USER' | 'ASSISTANT'; content: string; createdAt: Date; exportId: string | null }) {
    const row = message.exportId
      ? await this.prisma.assistantExport.findFirst({ where: { id: message.exportId, userId, status: 'COMPLETED' } })
      : null;
    return this.toView(message, row);
  }

  private toView(
    message: { id: string; role: 'USER' | 'ASSISTANT'; content: string; createdAt: Date; exportId: string | null },
    row?: { id: string; fileName: string; clubName: string; memberCount: number; createdAt: Date; expiresAt: Date } | null,
  ): MessageView {
    return {
      id: message.id,
      role: message.role === 'USER' ? 'user' : 'assistant',
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      download: row
        ? {
            exportId: row.id,
            fileName: row.fileName,
            clubName: row.clubName,
            memberCount: row.memberCount,
            createdAt: row.createdAt.toISOString(),
            expiresAt: row.expiresAt.toISOString(),
          }
        : null,
    };
  }
}
