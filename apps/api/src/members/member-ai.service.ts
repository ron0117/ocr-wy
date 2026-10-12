import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { OcrLine, ParsedMember } from './parse-member-table';
import { groundMemberRows, MEMBER_STRUCTURE_SYSTEM, parseMemberPayload, uniqueByName } from './structure-members';
import { VISION_MEMBER_SYSTEM } from './vision-members';

export interface MemberAiImage {
  name: string;
  lines: OcrLine[];
  candidates: ParsedMember[];
}

@Injectable()
export class MemberAiService {
  private readonly logger = new Logger(MemberAiService.name);
  private client: OpenAI | null = null;
  private resolvedModel: string | null = null;

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return Boolean(this.config.get<string>('AI_API_KEY')?.trim());
  }

  async readImage(jpeg: Buffer): Promise<unknown> {
    const client = this.getClient();
    const model = await this.resolveModel(client);
    const dataUrl = `data:image/jpeg;base64,${jpeg.toString('base64')}`;
    const content = await this.completeVision(client, model, dataUrl);
    try {
      return parseMemberPayload(content);
    } catch {
      throw new BadGatewayException('AI 返回的 JSON 格式无效');
    }
  }

  async filterAndDedupe(images: MemberAiImage[]): Promise<ParsedMember[]> {
    const client = this.getClient();
    const model = await this.resolveModel(client);
    const payload = {
      images: images.map((image) => ({
        name: image.name,
        lines: image.lines.slice(0, 200).map((line) => ({ text: line.text, box: line.box })),
        candidates: image.candidates,
      })),
    };
    // 网关启用 json_object 时只检查用户消息，系统提示里的 JSON 不算。
    const content = await this.complete(client, model, `请用 json 返回。\n${JSON.stringify(payload)}`);
    let parsed: unknown;
    try {
      parsed = parseMemberPayload(content);
    } catch {
      throw new BadGatewayException('AI 返回的 JSON 格式无效');
    }
    const lines = images.flatMap((image) => image.lines);
    return uniqueByName(groundMemberRows(parsed, lines));
  }

  private getClient(): OpenAI {
    if (!this.client) {
      const baseURL = normalizeBaseUrl(this.config.get<string>('AI_BASE_URL'));
      this.client = new OpenAI({
        apiKey: this.config.getOrThrow<string>('AI_API_KEY'),
        baseURL,
        timeout: 60_000,
        maxRetries: 0,
        fetch: gatewayFetch,
      });
    }
    return this.client;
  }

  private async resolveModel(client: OpenAI): Promise<string> {
    const configured = this.config.get<string>('AI_MODEL')?.trim();
    if (configured) return configured;
    if (this.resolvedModel) return this.resolvedModel;
    try {
      const listed = await client.models.list();
      const model = listed.data.find((item) => item.id)?.id;
      if (!model) throw new BadGatewayException('AI 服务没有可用模型');
      this.resolvedModel = model;
      this.logger.log(`使用模型 ${model}`);
      return model;
    } catch (error) {
      throw this.toGatewayError(error);
    }
  }

  private async complete(client: OpenAI, model: string, userContent: string): Promise<string> {
    try {
      return await this.request(client, model, userContent, true);
    } catch (error) {
      if (!isFormatRejected(error)) throw this.toGatewayError(error);
      try {
        return await this.request(client, model, userContent, false);
      } catch (retryError) {
        throw this.toGatewayError(retryError);
      }
    }
  }

  private async completeVision(client: OpenAI, model: string, dataUrl: string): Promise<string> {
    const userContent = [
      { type: 'text' as const, text: '请用 json 返回。' },
      { type: 'image_url' as const, image_url: { url: dataUrl } },
    ];
    try {
      return await this.requestVision(client, model, userContent, true);
    } catch (error) {
      if (!isFormatRejected(error)) throw this.toGatewayError(error);
      try {
        return await this.requestVision(client, model, userContent, false);
      } catch (retryError) {
        throw this.toGatewayError(retryError);
      }
    }
  }

  private async requestVision(
    client: OpenAI,
    model: string,
    userContent: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>,
    jsonMode: boolean,
  ): Promise<string> {
    const completion = await client.chat.completions.create(
      {
        model,
        temperature: 0,
        messages: [
          { role: 'system', content: VISION_MEMBER_SYSTEM },
          { role: 'user', content: userContent },
        ],
        ...(jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
      },
      { timeout: 90_000 },
    );
    const content = completion.choices[0]?.message?.content;
    if (!content) throw new BadGatewayException('AI 未返回整理结果');
    return content;
  }

  private async request(client: OpenAI, model: string, userContent: string, jsonMode: boolean): Promise<string> {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0,
      messages: [
        { role: 'system', content: MEMBER_STRUCTURE_SYSTEM },
        { role: 'user', content: userContent },
      ],
      ...(jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) throw new BadGatewayException('AI 未返回整理结果');
    return content;
  }

  private toGatewayError(error: unknown): BadGatewayException {
    if (error instanceof BadGatewayException) return error;
    const message = error instanceof Error ? error.message : 'AI 整理失败';
    this.logger.error(message);
    return new BadGatewayException(message || 'AI 整理失败');
  }
}

function normalizeBaseUrl(value: string | undefined): string {
  const trimmed = (value ?? '').trim().replace(/\/$/, '');
  if (!trimmed) throw new BadGatewayException('未配置 AI 请求地址');
  if (/\/v1$/i.test(trimmed)) return trimmed;
  return `${trimmed}/v1`;
}

function isFormatRejected(error: unknown): boolean {
  if (!(error instanceof OpenAI.APIError)) return false;
  return error.status === 400 || error.status === 422;
}

const gatewayFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  return unwrapSseError(response);
};

async function unwrapSseError(response: Response): Promise<Response> {
  const body = await response.clone().text();
  if (!body.trimStart().startsWith('event:')) return response;
  return new Response(JSON.stringify({ error: { message: sseErrorMessage(body), type: 'invalid_request_error' } }), {
    status: response.ok ? 400 : response.status,
    headers: { 'content-type': 'application/json' },
  });
}

function sseErrorMessage(body: string): string {
  const data = body
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== '[DONE]')
    .at(-1);
  if (!data) return body.slice(0, 300);
  try {
    const parsed = JSON.parse(data) as { error?: { message?: string }; message?: string };
    return parsed.error?.message || parsed.message || data;
  } catch {
    return data;
  }
}
