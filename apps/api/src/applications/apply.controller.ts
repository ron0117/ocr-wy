import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { SubmitApplicationDto } from './dto';

@Controller('apply')
export class ApplyController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get('clubs')
  clubs() {
    return this.applications.listPublicClubs();
  }

  @Post()
  submit(@Body() dto: SubmitApplicationDto) {
    return this.applications.submit(dto);
  }
}
