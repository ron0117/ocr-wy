import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActivityRegistrationsService } from './activity-registrations.service';
import { ListRegistrationsQuery, PatchRegistrationDto } from './dto';

@Controller('activity-registrations')
@UseGuards(JwtAuthGuard)
export class ActivityRegistrationsController {
  constructor(private readonly registrations: ActivityRegistrationsService) {}

  @Get('activities')
  listActivities() {
    return this.registrations.listActivitiesForView();
  }

  @Get()
  list(@Query() query: ListRegistrationsQuery) {
    return this.registrations.listRegistrations(query);
  }

  @Patch(':id')
  patch(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PatchRegistrationDto) {
    return this.registrations.patchRegistration(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.registrations.removeRegistration(id);
  }
}
