import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '@ocr/shared-types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TasksService } from '../tasks/tasks.service';
import { UpdateRecordsDto } from './dto';
import { RecordsService } from './records.service';

function blankToNull(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class RecordsController {
  constructor(
    private readonly records: RecordsService,
    private readonly tasks: TasksService,
  ) {}

  @Get(':taskId/records')
  async list(
    @CurrentUser() user: AuthUser,
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
  ) {
    await this.tasks.assertOwnedBy(taskId, user.id);
    return this.records.list(taskId);
  }

  @Patch(':taskId/records')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
    @Body() dto: UpdateRecordsDto,
  ) {
    const task = await this.tasks.assertOwnedBy(taskId, user.id);
    this.tasks.assertIdle(task.status);
    if (task.status === 'UPLOADED') {
      throw new ConflictException('请先完成识别');
    }
    for (const row of dto.rows) {
      const price = blankToNull(row.price);
      const quantity = blankToNull(row.quantity);
      if (price && !/^\d+(?:\.\d+)?$/.test(price)) {
        throw new BadRequestException('价格格式不正确');
      }
      if (quantity && !/^\d+(?:\.\d+)?$/.test(quantity)) {
        throw new BadRequestException('数量格式不正确');
      }
    }
    const saved = await this.records.replaceRecords({
      taskId,
      userId: user.id,
      source: 'manual',
      status: 'REVIEW_REQUIRED',
      drafts: dto.rows.map((row) => ({
        productName: row.productName,
        price: blankToNull(row.price),
        quantity: blankToNull(row.quantity),
        total: blankToNull(row.total),
        unit: blankToNull(row.unit),
        sourceText: row.rawText ?? '',
        warnings: row.warnings ?? [],
        confidence: row.confidence ?? null,
        rawText: row.rawText ?? null,
      })),
    });
    return saved;
  }
}
