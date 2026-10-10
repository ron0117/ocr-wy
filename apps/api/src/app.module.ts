import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ClubsModule } from './clubs/clubs.module';
import { HealthController } from './health.controller';
import { MembersModule } from './members/members.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    StorageModule,
    AuthModule,
    ClubsModule,
    MembersModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
