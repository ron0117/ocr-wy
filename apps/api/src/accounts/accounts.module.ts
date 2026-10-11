import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';

@Module({
  imports: [AccessModule],
  controllers: [AccountsController],
  providers: [AccountsService],
})
export class AccountsModule {}
