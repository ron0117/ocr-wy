import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { UploadsController } from './uploads.controller';
import { WikiMediaService } from './wiki-media.service';

@Module({
  controllers: [UploadsController, MediaController],
  providers: [WikiMediaService],
  exports: [WikiMediaService],
})
export class StorageModule {}
