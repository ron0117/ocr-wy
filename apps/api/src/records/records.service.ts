import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma, type TaskStatus } from '@prisma/client';
import type { ProductRow } from '@ocr/shared-types';
import { randomUUID } from 'node:crypto';
import type { DraftRow } from '../common/extract-table';
import { normalizePrice, normalizeQuantity } from '../common/numbers';
import { PrismaService } from '../prisma/prisma.module';
import { StorageService } from '../storage/storage.service';

function warningsOf(extra: Prisma.JsonValue | null): string[] {
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return [];
  const warnings = (extra as { warnings?: unknown }).warnings;
  if (!Array.isArray(warnings)) return [];
  return warnings.filter((item): item is string => typeof item === 'string');
}

function decimalText(value: Prisma.Decimal | null, fraction: number): string | null {
  if (value === null) return null;
  if (fraction === 3) return normalizeQuantity(value.toString());
  return normalizePrice(value.toString());
}

@Injectable()
export class RecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async list(taskId: string): Promise<ProductRow[]> {
    const records = await this.prisma.ocrRecord.findMany({
      where: { taskId },
      orderBy: { rowIndex: 'asc' },
    });
    return records.map((record) => ({
      id: record.id,
      rowIndex: record.rowIndex,
      productName: record.productName,
      price: decimalText(record.price, 2),
      quantity: decimalText(record.quantity, 3),
      total: decimalText(record.total, 2),
      unit: record.unit,
      confidence: record.confidence,
      rawText: record.rawText,
      warnings: warningsOf(record.extra),
    }));
  }

  toDrafts(rows: ProductRow[]): DraftRow[] {
    return rows.map((row) => ({
      productName: row.productName,
      price: row.price,
      quantity: row.quantity,
      unit: row.unit,
      total: row.total,
      sourceText: row.rawText ?? '',
      warnings: [...row.warnings],
      confidence: row.confidence,
      rawText: row.rawText,
    }));
  }

  async replaceRecords(params: {
    taskId: string;
    userId: string;
    drafts: DraftRow[];
    source: 'manual' | 'template' | 'ai_chat';
    status: TaskStatus;
  }): Promise<{ dataVersion: number; rows: ProductRow[] }> {
    if (params.drafts.length > 10000) {
      throw new BadRequestException('商品行数超过上限');
    }

    const normalized = params.drafts.map((draft, index) => this.normalize(draft, index, params.source));
    const task = await this.prisma.ocrTask.findFirst({
      where: { id: params.taskId, userId: params.userId },
    });
    if (!task) throw new BadRequestException('任务不存在');

    const nextVersion = task.dataVersion + 1;
    const revisionId = randomUUID();
    const objectName = `ocr/${params.userId}/${params.taskId}/structured/${revisionId}.json`;
    const payload = Buffer.from(
      JSON.stringify({
        version: nextVersion,
        source: params.source,
        rows: normalized,
      }),
    );

    const stored = await this.storage.upload(
      objectName,
      payload,
      'application/json',
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        const current = await tx.ocrTask.findFirst({
          where: { id: params.taskId, userId: params.userId },
        });
        if (!current || current.dataVersion !== task.dataVersion) {
          throw new ConflictException('数据已更新，请刷新后重试');
        }

        await tx.ocrRecord.deleteMany({ where: { taskId: params.taskId } });
        if (normalized.length > 0) {
          await tx.ocrRecord.createMany({
            data: normalized.map((row, index) => ({
              taskId: params.taskId,
              rowIndex: index,
              productName: row.productName,
              price: row.price === null ? null : new Prisma.Decimal(row.price),
              quantity: row.quantity === null ? null : new Prisma.Decimal(row.quantity),
              total: row.total === null ? null : new Prisma.Decimal(row.total),
              unit: row.unit,
              confidence: row.confidence,
              rawText: row.rawText,
              extra: { warnings: row.warnings },
            })),
          });
        }

        await tx.recordRevision.create({
          data: {
            id: revisionId,
            taskId: params.taskId,
            version: nextVersion,
            source: params.source,
            snapshot: normalized as unknown as Prisma.InputJsonValue,
          },
        });

        await tx.resourceFile.create({
          data: {
            taskId: params.taskId,
            type: 'STRUCTURED_JSON',
            objectName,
            contentType: 'application/json',
            sizeBytes: BigInt(stored.sizeBytes),
            sha256: stored.sha256,
            originalName: `structured-v${nextVersion}.json`,
          },
        });

        await tx.ocrTask.update({
          where: { id: params.taskId },
          data: {
            dataVersion: nextVersion,
            status: params.status,
            errorCode: null,
            errorMessage: null,
          },
        });

        const rows = await tx.ocrRecord.findMany({
          where: { taskId: params.taskId },
          orderBy: { rowIndex: 'asc' },
        });

        return {
          dataVersion: nextVersion,
          rows: rows.map((record) => ({
            id: record.id,
            rowIndex: record.rowIndex,
            productName: record.productName,
            price: decimalText(record.price, 2),
            quantity: decimalText(record.quantity, 3),
            total: decimalText(record.total, 2),
            unit: record.unit,
            confidence: record.confidence,
            rawText: record.rawText,
            warnings: warningsOf(record.extra),
          })),
        };
      });
    } catch (error) {
      await this.storage.remove(objectName);
      throw error;
    }
  }

  private normalize(draft: DraftRow, index: number, source: 'manual' | 'template' | 'ai_chat'): DraftRow {
    const productName = draft.productName.trim();
    if (!productName) {
      throw new BadRequestException(`第 ${index + 1} 行商品名称不能为空`);
    }
    if (productName.length > 300) {
      throw new BadRequestException(`第 ${index + 1} 行商品名称过长`);
    }

    const warnings = [...draft.warnings];
    let price = draft.price;
    let quantity = draft.quantity;
    if (price !== null) {
      const normalized = normalizePrice(price);
      if (normalized === null) {
        if (source === 'manual') throw new BadRequestException(`第 ${index + 1} 行价格不正确`);
        price = null;
        if (!warnings.includes('价格超出允许范围')) warnings.push('价格超出允许范围');
      } else {
        price = normalized;
      }
    }
    if (quantity !== null) {
      const normalized = normalizeQuantity(quantity);
      if (normalized === null) {
        if (source === 'manual') throw new BadRequestException(`第 ${index + 1} 行数量不正确`);
        quantity = null;
        if (!warnings.includes('数量超出允许范围')) warnings.push('数量超出允许范围');
      } else {
        quantity = normalized;
      }
    }

    let total = draft.total;
    if (total !== null) {
      const normalized = normalizePrice(total);
      total = normalized;
    }

    return {
      productName,
      price,
      quantity,
      total,
      unit: draft.unit?.trim().slice(0, 30) || null,
      sourceText: (draft.sourceText || draft.rawText || '').slice(0, 2000),
      warnings: warnings.slice(0, 20).map((item) => item.slice(0, 200)),
      confidence: draft.confidence,
      rawText: (draft.rawText ?? draft.sourceText ?? '').slice(0, 2000) || null,
    };
  }
}
