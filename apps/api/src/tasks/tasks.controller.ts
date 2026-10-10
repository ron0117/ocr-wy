import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '@ocr/shared-types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateTaskDto, ListTaskQuery } from './dto';
import { TasksService } from './tasks.service';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListTaskQuery) {
    return this.tasks.list(user.id, query.limit ?? 50);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTaskDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.tasks.create(user.id, dto, idempotencyKey);
  }

  @Get(':taskId')
  detail(
    @CurrentUser() user: AuthUser,
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
  ) {
    return this.tasks.getDetail(taskId, user.id);
  }

  @Post(':taskId/complete')
  complete(
    @CurrentUser() user: AuthUser,
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
  ) {
    return this.tasks.complete(taskId, user.id);
  }
}
