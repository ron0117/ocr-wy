import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GearModule } from './gear/gear.module';
import { HealthController } from './health.controller';
import { LoadoutsModule } from './loadouts/loadouts.module';
import { MetaModule } from './meta/meta.module';
import { PathwaysModule } from './pathways/pathways.module';
import { PrismaModule } from './prisma/prisma.module';
import { ScenariosController } from './scenarios/scenarios.controller';
import { ArticlesModule } from './articles/articles.module';
import { SharesModule } from './shares/shares.module';
import { SkillsModule } from './skills/skills.module';
import { StorageModule } from './storage/storage.module';
import { AdminModule } from './admin/admin.module';
import { ClubRankingsModule } from './club-rankings/club-rankings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env.local', '../../.env'],
    }),
    PrismaModule,
    MetaModule,
    PathwaysModule,
    SkillsModule,
    GearModule,
    LoadoutsModule,
    SharesModule,
    ArticlesModule,
    StorageModule,
    AdminModule,
    ClubRankingsModule,
  ],
  controllers: [HealthController, ScenariosController],
})
export class AppModule {}
