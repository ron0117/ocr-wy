import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { z } from 'zod';
import { normalizeField } from './member-lookup';
import type { PlannedTool } from './plan';
import { SpeechBook } from './speech';

const IntentSchema = z
  .object({
    tool: z.enum(['list_clubs', 'find_club', 'get_club_summary', 'export_club_members_excel', 'lookup_member', 'answer_help']),
    clubName: z.string().max(80).optional(),
    playerName: z.string().max(40).optional(),
    field: z.string().max(20).optional(),
    clubNames: z.array(z.string().max(80)).max(20).optional(),
    allMatching: z.boolean().optional(),
  })
  .strict();

const SPEAK_PROMPT = `你是小忧，俱乐部的团宠助手。用简体中文写给管理员的回复。
自称小忧，称呼对方管理员。先把结果说完。不叫主人或宝宝，不闲聊。
只能根据给定事实说话，不能编造俱乐部、人数或文件。
must 里的每一段都必须原样出现在 reply 里。只输出 JSON：{"reply":"回复正文"}。`;

export interface ClubFact {
  name: string;
  leader: string | null;
  memberCount: number;
}

@Injectable()
export class IntentClient {
  private readonly logger = new Logger(IntentClient.name);
  private client: OpenAI | null = null;
  private resolvedModel: string | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly speech: SpeechBook,
  ) {}

  enabled(): boolean {
    return Boolean(this.config.get<string>('AI_API_KEY')?.trim());
  }

  async plan(
    text: string,
    activeClubName: string | null,
    pendingNames: string[],
    clubs: ClubFact[],
  ): Promise<PlannedTool | null> {
    if (!this.enabled()) return null;
    try {
      const client = this.getClient();
      const model = await this.resolveModel(client);
      const content = await this.complete(client, model, this.speech.intentText(), {
        text: text.slice(0, 500),
        activeClubName,
        pendingClubNames: pendingNames,
        clubs,
      });
      return this.parse(content);
    } catch (error) {
      const message = error instanceof Error ? error.message : '意图识别失败';
      this.logger.warn(`小忧意图识别失败，改用本地句式：${message}`);
      return null;
    }
  }

  async speak(input: { request: string; facts: Record<string, unknown>; must: string[] }): Promise<string | null> {
    if (!this.enabled()) return null;
    try {
      const client = this.getClient();
      const model = await this.resolveModel(client);
      return await this.complete(client, model, SPEAK_PROMPT, {
        request: input.request.slice(0, 500),
        facts: input.facts,
        must: input.must,
      }, 30_000);
    } catch (error) {
      const message = error instanceof Error ? error.message : '回复生成失败';
      this.logger.warn(`小忧回复生成失败，改用场景句：${message}`);
      return null;
    }
  }

  private parse(content: string): PlannedTool | null {
    const trimmed = content.trim().replace(/^```(?:json)?\s*|```$/giu, '');
    let value: unknown;
    try {
      value = JSON.parse(trimmed);
    } catch {
      return null;
    }
    const parsed = IntentSchema.safeParse(value);
    if (!parsed.success) return null;
    const clubName = parsed.data.clubName?.trim() || undefined;
    if (parsed.data.tool === 'list_clubs') return { tool: 'list_clubs' };
    if (parsed.data.tool === 'answer_help') return { tool: 'answer_help' };
    if (parsed.data.tool === 'lookup_member') {
      const playerName = parsed.data.playerName?.trim();
      if (!playerName) return null;
      return { tool: 'lookup_member', playerName, clubName, field: normalizeField(parsed.data.field) };
    }
    if (parsed.data.tool === 'export_club_members_excel') {
      const clubNames = parsed.data.clubNames?.map((name) => name.trim()).filter(Boolean);
      return {
        tool: 'export_club_members_excel',
        clubName,
        clubNames: clubNames?.length ? clubNames : undefined,
        allMatching: parsed.data.allMatching || undefined,
      };
    }
    return { tool: 'get_club_summary', clubName };
  }

  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: this.config.getOrThrow<string>('AI_API_KEY'),
        baseURL: normalizeBaseUrl(this.config.get<string>('AI_BASE_URL')),
        timeout: 60_000,
        maxRetries: 0,
      });
    }
    return this.client;
  }

  private async resolveModel(client: OpenAI): Promise<string> {
    const configured = this.config.get<string>('AI_MODEL')?.trim();
    if (configured) return configured;
    if (this.resolvedModel) return this.resolvedModel;
    const listed = await client.models.list();
    const model = listed.data.find((item) => item.id)?.id;
    if (!model) throw new Error('AI 服务没有可用模型');
    this.resolvedModel = model;
    return model;
  }

  private async complete(
    client: OpenAI,
    model: string,
    system: string,
    payload: unknown,
    timeout = 60_000,
  ): Promise<string> {
    try {
      return await this.request(client, model, system, payload, true, timeout);
    } catch (error) {
      if (!isFormatRejected(error)) throw error;
      return this.request(client, model, system, payload, false, timeout);
    }
  }

  private async request(
    client: OpenAI,
    model: string,
    system: string,
    payload: unknown,
    jsonMode: boolean,
    timeout: number,
  ): Promise<string> {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `请用 json 返回。\n${JSON.stringify(payload)}` },
      ],
      ...(jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
    }, { timeout });
    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('AI 未返回内容');
    return content;
  }
}

function normalizeBaseUrl(value: string | undefined): string {
  const trimmed = (value ?? '').trim().replace(/\/$/u, '');
  if (!trimmed) throw new Error('未配置 AI 请求地址');
  if (/\/v1$/iu.test(trimmed)) return trimmed;
  return `${trimmed}/v1`;
}

function isFormatRejected(error: unknown): boolean {
  return error instanceof OpenAI.APIError && (error.status === 400 || error.status === 422);
}
