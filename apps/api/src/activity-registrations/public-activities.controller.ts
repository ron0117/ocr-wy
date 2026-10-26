import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ActivityRegistrationsService } from './activity-registrations.service';
import { SubmitRegistrationDto } from './dto';

@Controller('public/activities')
export class PublicActivitiesController {
  constructor(private readonly registrations: ActivityRegistrationsService) {}

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.registrations.getPublicActivity(id);
  }

  @Post(':id/registrations')
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitRegistrationDto,
    @Req() request: Request,
  ) {
    return this.registrations.submitPublic(id, dto, request);
  }
}
