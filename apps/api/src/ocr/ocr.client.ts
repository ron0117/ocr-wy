import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OcrLine {
  text: string;
  confidence: number;
  box: number[][];
}

export interface OcrResponse {
  text: string;
  lines: OcrLine[];
}

@Injectable()
export class OcrClient {
  private readonly logger = new Logger(OcrClient.name);

  constructor(private readonly config: ConfigService) {}

  async recognize(buffer: Buffer, filename: string): Promise<OcrResponse> {
    const baseUrl = this.config.getOrThrow<string>('OCR_SERVICE_URL').replace(/\/$/, '');
    const token = this.config.get<string>('OCR_AUTH_TOKEN');
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(buffer)]), filename);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch(`${baseUrl}/recognize`, {
        method: 'POST',
        body: form,
        headers: token ? { 'X-OCR-Token': token } : undefined,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`OCR HTTP ${response.status}`);
      }
      const json = (await response.json()) as Partial<OcrResponse>;
      if (typeof json.text !== 'string' || !Array.isArray(json.lines)) {
        throw new Error('OCR 响应无效');
      }
      const lines = json.lines.flatMap((line) => {
        if (!line || typeof line.text !== 'string' || typeof line.confidence !== 'number') {
          return [];
        }
        const box = Array.isArray(line.box) ? line.box : [];
        return [{ text: line.text, confidence: line.confidence, box }];
      });
      return { text: json.text, lines };
    } catch (error) {
      this.logger.error('OCR 调用失败', error instanceof Error ? error.message : undefined);
      throw new BadGatewayException('OCR 服务暂时不可用');
    } finally {
      clearTimeout(timer);
    }
  }
}
