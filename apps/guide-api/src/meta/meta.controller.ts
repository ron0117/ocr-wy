import { Controller, Get } from '@nestjs/common';
import { MetaService } from './meta.service';

@Controller('meta')
export class MetaController {
  constructor(private readonly meta: MetaService) {}

  @Get('current-version')
  currentVersion() {
    return this.meta.getCurrentVersion();
  }
}
