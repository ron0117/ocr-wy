import { Module } from '@nestjs/common';
import { AccessService } from './access.service';
import { MenuGuard } from './menu.guard';
import { PermissionController } from './permission.controller';

@Module({
  controllers: [PermissionController],
  providers: [AccessService, MenuGuard],
  exports: [AccessService, MenuGuard],
})
export class AccessModule {}
