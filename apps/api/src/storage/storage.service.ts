import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertObjectName } from '../common/object-name';

export interface StoredObject {
  objectName: string;
  sizeBytes: number;
  sha256: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: 'local' | 'gcs';
  private readonly localRoot: string;
  private readonly bucketName: string;
  private readonly gcs?: Storage;

  constructor(config: ConfigService) {
    const requested = config.get<string>('STORAGE_DRIVER') ?? 'local';
    this.driver = requested === 'gcs' ? 'gcs' : 'local';
    this.localRoot = path.resolve(
      process.cwd(),
      config.get<string>('LOCAL_STORAGE_DIR') ?? './data/storage',
    );
    this.bucketName = config.get<string>('GCS_BUCKET') ?? '';
    if (this.driver === 'gcs') {
      if (!this.bucketName) {
        throw new Error('STORAGE_DRIVER=gcs 时必须设置 GCS_BUCKET');
      }
      this.gcs = new Storage();
      this.logger.log(`存储驱动：GCS 私有桶 ${this.bucketName}`);
    } else {
      this.logger.log(`存储驱动：本地目录 ${this.localRoot}`);
    }
  }

  get supportsSignedUrl(): boolean {
    return this.driver === 'gcs';
  }

  async upload(objectName: string, buffer: Buffer, contentType: string): Promise<StoredObject> {
    const safeName = assertObjectName(objectName);
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    try {
      if (this.driver === 'local') {
        const full = this.resolveLocal(safeName);
        await mkdir(path.dirname(full), { recursive: true });
        await writeFile(full, buffer, { flag: 'wx' });
      } else {
        await this.gcs!
          .bucket(this.bucketName)
          .file(safeName)
          .save(buffer, {
            resumable: false,
            contentType,
            metadata: {
              cacheControl: 'private, no-store',
              metadata: { sha256 },
            },
            preconditionOpts: { ifGenerationMatch: 0 },
          });
      }
    } catch (error) {
      this.logger.error(`上传失败 ${safeName}`, error instanceof Error ? error.message : undefined);
      throw new InternalServerErrorException('文件存储失败');
    }

    return { objectName: safeName, sizeBytes: buffer.length, sha256 };
  }

  async download(objectName: string): Promise<Buffer> {
    const safeName = assertObjectName(objectName);
    try {
      if (this.driver === 'local') {
        return await readFile(this.resolveLocal(safeName));
      }
      const [buffer] = await this.gcs!.bucket(this.bucketName).file(safeName).download();
      return buffer;
    } catch (error) {
      this.logger.error(`读取失败 ${safeName}`, error instanceof Error ? error.message : undefined);
      throw new BadGatewayException('文件读取失败');
    }
  }

  async remove(objectName: string): Promise<void> {
    const safeName = assertObjectName(objectName);
    try {
      if (this.driver === 'local') {
        await rm(this.resolveLocal(safeName), { force: true });
        return;
      }
      await this.gcs!.bucket(this.bucketName).file(safeName).delete({ ignoreNotFound: true });
    } catch (error) {
      this.logger.error(`删除失败 ${safeName}`, error instanceof Error ? error.message : undefined);
    }
  }

  async createReadUrl(objectName: string): Promise<string> {
    if (!this.supportsSignedUrl) {
      throw new BadGatewayException('当前存储驱动不提供签名 URL');
    }
    const safeName = assertObjectName(objectName);
    const [url] = await this.gcs!.bucket(this.bucketName).file(safeName).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 5 * 60 * 1000,
    });
    return url;
  }

  private resolveLocal(objectName: string): string {
    const full = path.resolve(this.localRoot, objectName);
    const root = path.resolve(this.localRoot);
    if (full !== root && !full.startsWith(root + path.sep)) {
      throw new InternalServerErrorException('非法对象路径');
    }
    return full;
  }
}
