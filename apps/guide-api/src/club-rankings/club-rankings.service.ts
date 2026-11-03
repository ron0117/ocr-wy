import { BadRequestException, Injectable } from '@nestjs/common';
import { normalizeClubRankingClubs, type ClubRankingDto } from '@ocr/guide-types';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.module';

const CURRENT_ID = 'current';

@Injectable()
export class ClubRankingsService {
  constructor(private readonly prisma: PrismaService) {}

  async current(): Promise<ClubRankingDto> {
    const row = await this.prisma.clubRankingCurrent.findUnique({ where: { id: CURRENT_ID } });
    if (!row) return { clubs: [] };
    const parsed = normalizeClubRankingClubs(row.clubs);
    if (!parsed.ok) return { clubs: [] };
    return { clubs: parsed.clubs };
  }

  async replace(input: unknown): Promise<{ count: number }> {
    const parsed = normalizeClubRankingClubs(input);
    if (!parsed.ok) throw new BadRequestException(parsed.message);
    const clubs = parsed.clubs as unknown as Prisma.InputJsonValue;
    await this.prisma.clubRankingCurrent.upsert({
      where: { id: CURRENT_ID },
      create: { id: CURRENT_ID, clubs },
      update: { clubs },
    });
    return { count: parsed.clubs.length };
  }
}
