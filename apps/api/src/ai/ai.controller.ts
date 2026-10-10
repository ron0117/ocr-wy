import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@ocr/shared-types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.module';
import { TasksService } from '../tasks/tasks.service';
import { AiService } from './ai.service';
import { ApplyTemplateDto, ChatDto } from './dto';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly tasks: TasksService,
    private readonly prisma: PrismaService,
  ) {}

  @Post(':taskId/chat')
  chat(
    @CurrentUser() user: AuthUser,
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
    @Body() dto: ChatDto,
  ) {
    return this.ai.processChat(taskId, user.id, dto.message.trim());
  }

  @Post(':taskId/apply-template')
  applyTemplate(
    @CurrentUser() user: AuthUser,
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
    @Body() dto: ApplyTemplateDto,
  ) {
    return this.ai.applyTemplate(taskId, user.id, dto.templateId);
  }

  @Get(':taskId/messages')
  async messages(
    @CurrentUser() user: AuthUser,
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
  ) {
    await this.tasks.assertOwnedBy(taskId, user.id);
    const messages = await this.prisma.aiMessage.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    }));
  }
}
