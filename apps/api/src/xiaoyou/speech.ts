import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const FALLBACK: Record<string, string> = {
  help: '管理员，小忧现在会这些：看看你能管哪些俱乐部、问一家有多少人、何时更新、查某个人的某项或全部信息、导出人员表、查看活动、查看一场的出席、查看某人参加过和没参加的活动。比如：导出某某俱乐部人员名单，或问张三参加了哪些活动。绑定状态已经不再提供。',
  'activity-list': '管理员，小忧看到这些活动：{activityList}。',
  'activity-empty': '管理员，小忧看过了，现在没有这样的活动。',
  'activity-ready': '管理员，「{title}」在{clubList}，开始时间是 {startsAt}，状态是{statusText}。已签到 {attendedCount} 人，未签到 {missedCount} 人，迟到 {lateCount} 人。',
  'activity-choice': '管理员，小忧找到这些活动：{activityList}。说一个名字或序号，小忧再去看。',
  'activity-missing': '管理员，小忧没找到这场活动。说清楚标题，小忧再找。',
  'activity-roster': '管理员，「{title}」已签到 {attendedCount} 人，未签到 {missedCount} 人，迟到 {lateCount} 人。{detail}',
  'member-activity-ready': '管理员，「{playerName}」已签到 {attendedCount} 场，未签到 {missedCount} 场，迟到 {lateCount} 场。{detail}',
  'member-activity-empty': '管理员，「{playerName}」没有纳入范围的活动。',
  'activity-no-menu': '管理员，小忧还不能帮你查活动。这个账号没有「活动签到」的权限。',
  'no-menu': '管理员，小忧还不能帮你查人员和导出。这个账号没有「人员列表」的权限。',
  'list-clubs': '管理员，小忧能帮你看到这些：{clubList}。',
  'list-empty': '管理员，小忧看过了，你现在还没有可访问的俱乐部。',
  'need-choice': '管理员，小忧找到{clubList}。说一个名字或序号，小忧再去办。',
  'need-confirm': '管理员，小忧认出的是「{clubName}」。是这一家的话，回小忧一声「是」。',
  'club-missing': '管理员，没有找到你可访问的相关俱乐部，请检查名称后重试。小忧只能在你管得到的俱乐部里找。',
  'empty-members': '管理员，「{clubName}」暂无可导出的人员数据。小忧没有做空表。',
  'export-ready': '管理员，小忧把「{clubName}」人员名单放好了，一共 {memberCount} 人。点下面就能带走。',
  'export-many': '管理员，小忧把{clubList}的人放进同一份表了，一共 {memberCount} 人。点下面就能带走。',
  'export-failed': '管理员，小忧没把表做好。你再说一次导出，小忧重新做。',
  summary: '管理员，小忧问过「{clubName}」了。{leaderText}，一共 {memberCount} 人，{updatedText}。',
  'summary-empty': '管理员，小忧看了「{clubName}」，现在没有人员，人数是 0。暂无人员数据更新时间。',
  'ask-club': '管理员，小忧还不知道是哪一家。说俱乐部名称，小忧再去办。',
  'member-ready': '管理员，小忧查过「{clubName}」的「{playerName}」了。{detail}',
  'member-missing': '管理员，小忧没找到「{playerName}」。{scopeText}',
  'member-choice': '管理员，小忧找到{memberList}。说一个名字或序号，小忧再去查。',
  'member-confirm': '管理员，小忧认出的是「{clubName}」的「{playerName}」。是这一位的话，回小忧一声「是」。',
  'member-ask': '管理员，小忧还不知道查谁。说一个玩家名称，小忧再去翻。',
  'lookup-club-choice': '管理员，小忧要查「{playerName}」，找到{clubList}。说一个名字或序号，小忧再去查。',
  'lookup-club-confirm': '管理员，小忧要查「{playerName}」，认出的是「{clubName}」。是这一家的话，回小忧一声「是」。',
  'file-unavailable': '管理员，这份文件小忧拿不到了。要是你还管着这家俱乐部，跟小忧再说一声导出就行。',
  'basic-mode': '管理员，小忧这会儿没连上模型，自己在认话。{sentence}',
};

const INTENT_FALLBACK = `你只把管理员的一句话收成 JSON，不要写回复。
只能返回 tool、可选的 clubName、playerName 和 field。
tool 只能是 list_clubs、find_club、get_club_summary、export_club_members_excel、lookup_member、list_activities、get_activity、activity_roster、member_activities、answer_help。
查某一个玩家时用 lookup_member。问活动用 list_activities、get_activity、activity_roster 或 member_activities。问绑定用 answer_help。`;

@Injectable()
export class SpeechBook implements OnModuleInit {
  private readonly logger = new Logger(SpeechBook.name);
  private readonly scenes = new Map<string, string>();
  private intentPrompt = INTENT_FALLBACK;

  async onModuleInit() {
    const root = await this.findRoot();
    if (!root) {
      this.logger.warn('没有找到小忧技能文稿，使用内置句子');
      return;
    }
    await this.loadScenes(path.join(root, 'scenes'));
    const intent = await this.readBody(path.join(root, 'intent', 'SKILL.md'));
    if (intent) this.intentPrompt = intent;
    this.logger.log(`已读入小忧技能 ${this.scenes.size} 个场景`);
  }

  intentText(): string {
    return this.intentPrompt;
  }

  line(scene: string, slots: Record<string, string>, must: string[], basicMode: boolean, callerName?: string | null): string {
    const spoken = this.accept(this.fillScene(scene, slots), must) ?? this.accept(this.fill(FALLBACK[scene] ?? FALLBACK.help, slots), must);
    const sentence = spoken ?? '管理员，小忧这次没说清楚，你再说一次。';
    if (!basicMode) return addressAs(sentence, callerName);
    const rest = sentence.replace(/^管理员，/u, '');
    const wrapped = this.fillScene('basic-mode', { sentence: rest });
    return addressAs(this.accept(wrapped, must) ?? `管理员，小忧这会儿没连上模型，自己在认话。${rest}`, callerName);
  }

  unavailable(callerName?: string | null): string {
    return this.line('file-unavailable', {}, [], false, callerName);
  }

  acceptSpoken(text: string, must: string[], callerName?: string | null): string | null {
    const cleaned = text.trim().replace(/^```(?:json|markdown)?\s*|```$/giu, '').trim();
    const accepted = this.accept(unwrapReply(cleaned), must);
    return accepted ? addressAs(accepted, callerName) : null;
  }

  private fillScene(scene: string, slots: Record<string, string>): string {
    return this.fill(this.scenes.get(scene) ?? FALLBACK[scene] ?? FALLBACK.help, slots);
  }

  private fill(template: string, slots: Record<string, string>): string {
    return template.replace(/\{(\w+)\}/g, (_, key: string) => slots[key] ?? '');
  }

  private accept(text: string, must: string[]): string | null {
    if (!text.includes('小忧') || !text.includes('管理员')) return null;
    if (text.includes('主人') || text.includes('宝宝')) return null;
    if (must.some((item) => item && !text.includes(item))) return null;
    return text;
  }

  private async findRoot(): Promise<string | null> {
    const candidates = [
      path.join(__dirname, 'skills'),
      path.resolve(process.cwd(), 'src/xiaoyou/skills'),
      path.resolve(process.cwd(), 'apps/api/src/xiaoyou/skills'),
    ];
    for (const candidate of candidates) {
      try {
        await readFile(path.join(candidate, 'voice', 'SKILL.md'), 'utf8');
        return candidate;
      } catch {
        continue;
      }
    }
    return null;
  }

  private async loadScenes(dir: string) {
    let names: string[] = [];
    try {
      names = await readdir(dir);
    } catch {
      return;
    }
    for (const name of names) {
      const body = await this.readBody(path.join(dir, name, 'SKILL.md'));
      if (body) this.scenes.set(name, body);
    }
  }

  private async readBody(file: string): Promise<string | null> {
    try {
      const raw = await readFile(file, 'utf8');
      const matched = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/u);
      const body = (matched?.[1] ?? raw).trim();
      return body || null;
    } catch {
      return null;
    }
  }
}

export function addressAs(text: string, name: string | null | undefined): string {
  const called = name?.trim() ?? '';
  if (!called || called === '管理员' || called.includes('主人') || called.includes('宝宝')) return text;
  return text.replace('管理员', called);
}

function unwrapReply(text: string): string {
  if (!text.startsWith('{')) return text;
  try {
    const value = JSON.parse(text) as { reply?: unknown; content?: unknown };
    if (typeof value.reply === 'string') return value.reply.trim();
    if (typeof value.content === 'string') return value.content.trim();
  } catch {
    return text;
  }
  return text;
}
