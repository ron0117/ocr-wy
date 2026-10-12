import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AccessModule } from './access/access.module';
import { AccountsModule } from './accounts/accounts.module';
import { ActivitiesModule } from './activities/activities.module';
import { AuthModule } from './auth/auth.module';
import { ClubsModule } from './clubs/clubs.module';
import { RolesModule } from './roles/roles.module';
import { HealthController } from './health.controller';
import { MembersModule } from './members/members.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { XiaoyouModule } from './xiaoyou/xiaoyou.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    StorageModule,
    AuthModule,
    AccessModule,
    AccountsModule,
    RolesModule,
    ClubsModule,
    MembersModule,
    ActivitiesModule,
    XiaoyouModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
