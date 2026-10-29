import { Controller, Get, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';

@Controller('scenarios')
export class ScenariosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const version = await this.prisma.gameVersion.findFirst({
      where: { isCurrent: true },
    });
    if (!version) throw new NotFoundException('尚未导入游戏版本数据');
    const rows = await this.prisma.playScenario.findMany({
      where: { versionId: version.id },
      orderBy: { code: 'asc' },
    });
    return rows.map((row) => ({ code: row.code, name: row.name }));
  }
}
