import { Injectable, NotFoundException } from '@nestjs/common';
import type { CurrentVersionDto } from '@ocr/guide-types';
import { PrismaService } from '../prisma/prisma.module';

@Injectable()
export class MetaService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentVersion(): Promise<CurrentVersionDto> {
    const version = await this.prisma.gameVersion.findFirst({
      where: { isCurrent: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!version) {
      throw new NotFoundException('尚未导入游戏版本数据');
    }
    const latestGear = await this.prisma.gear.findFirst({
      where: { versionId: version.id },
      orderBy: { verifiedAt: 'desc' },
    });
    return {
      semver: version.semver,
      label: version.label,
      verifiedAt: latestGear?.verifiedAt?.toISOString() ?? version.createdAt.toISOString(),
    };
  }
}
