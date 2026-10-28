import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import COS from 'cos-nodejs-sdk-v5';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

@Injectable()
export class WikiMediaService {
  private readonly logger = new Logger(WikiMediaService.name);
  private readonly cos?: COS;
  private readonly bucket?: string;
  private readonly region?: string;
  private readonly publicBase: string;
  private readonly wikiPrefix: string;
  private readonly localRoot: string;
  private readonly apiPublicBase: string;

  constructor(config: ConfigService) {
    const secretId = config.get<string>('COS_SECRET_ID')?.trim();
    const secretKey = config.get<string>('COS_SECRET_KEY')?.trim();
    this.bucket = config.get<string>('COS_BUCKET')?.trim();
    this.region = config.get<string>('COS_REGION')?.trim();
    this.wikiPrefix =
      config.get<string>('COS_WIKI_PREFIX')?.replace(/^\/+|\/+$/g, '') || 'wiki';
    const customBase = config.get<string>('COS_PUBLIC_BASE_URL')?.trim();
    if (this.bucket && this.region) {
      this.publicBase =
        customBase?.replace(/\/$/, '') ??
        `https://${this.bucket}.cos.${this.region}.myqcloud.com`;
    } else {
      this.publicBase = customBase?.replace(/\/$/, '') ?? '';
    }
    if (secretId && secretKey && this.bucket && this.region) {
      this.cos = new COS({ SecretId: secretId, SecretKey: secretKey });
      this.logger.log(`Wiki 图床：COS ${this.bucket} /${this.wikiPrefix}/`);
    } else {
      this.logger.warn('未配置 COS，Wiki 图片写入本地目录（开发用）');
    }
    this.localRoot = path.resolve(
      config.get<string>('GUIDE_LOCAL_MEDIA_DIR') ?? './data/wiki-media',
    );
    this.apiPublicBase = (
      config.get<string>('GUIDE_API_PUBLIC_URL') ?? 'http://127.0.0.1:3001'
    ).replace(/\/$/, '');
  }

  assertAllowedImage(mime: string) {
    if (!ALLOWED_MIME.has(mime)) {
      throw new BadRequestException('仅支持 JPG / PNG / WebP / GIF 图片');
    }
  }

  private objectKey(ext: string): string {
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = randomBytes(8).toString('hex');
    return `${this.wikiPrefix}/${day}/${rand}${ext}`;
  }

  async uploadImage(buffer: Buffer, mime: string): Promise<{ url: string; objectKey: string }> {
    this.assertAllowedImage(mime);
    const ext = EXT_BY_MIME[mime] ?? '.bin';
    const key = this.objectKey(ext);

    if (this.cos && this.bucket && this.region) {
      try {
        await new Promise<void>((resolve, reject) => {
          this.cos!.putObject(
            {
              Bucket: this.bucket!,
              Region: this.region!,
              Key: key,
              Body: buffer,
              ContentType: mime,
              ACL: 'public-read',
            },
            (err) => (err ? reject(err) : resolve()),
          );
        });
      } catch (e) {
        this.logger.error('COS 上传失败', e instanceof Error ? e.message : e);
        throw new InternalServerErrorException('图片上传失败');
      }
      const url = `${this.publicBase}/${key}`;
      return { url, objectKey: key };
    }

    const sha = createHash('sha256').update(buffer).digest('hex').slice(0, 16);
    const localKey = key.replace(/\//g, '__');
    const full = path.join(this.localRoot, localKey);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, buffer);
    const url = `${this.apiPublicBase}/api/v1/media/local/${encodeURIComponent(localKey)}?sig=${sha}`;
    return { url, objectKey: localKey };
  }

  async readLocalFile(localKey: string): Promise<{ buffer: Buffer; mime: string }> {
    const safe = localKey.replace(/[^a-zA-Z0-9._-]/g, '');
    if (safe !== localKey) {
      throw new InternalServerErrorException('无效路径');
    }
    const full = path.join(this.localRoot, safe);
    const buffer = await readFile(full);
    const lower = safe.toLowerCase();
    let mime = 'application/octet-stream';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mime = 'image/jpeg';
    else if (lower.endsWith('.png')) mime = 'image/png';
    else if (lower.endsWith('.webp')) mime = 'image/webp';
    else if (lower.endsWith('.gif')) mime = 'image/gif';
    return { buffer, mime };
  }
}
