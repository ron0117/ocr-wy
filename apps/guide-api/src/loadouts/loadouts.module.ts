import { Module } from '@nestjs/common';
import { LoadoutsController } from './loadouts.controller';
import { LoadoutsService } from './loadouts.service';

@Module({
  controllers: [LoadoutsController],
  providers: [LoadoutsService],
})
export class LoadoutsModule {}
