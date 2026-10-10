import { Module } from '@nestjs/common';
import { OcrClient } from './ocr.client';

@Module({
  providers: [OcrClient],
  exports: [OcrClient],
})
export class OcrClientModule {}
