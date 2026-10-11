import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@ocr/shared-types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ClubsService } from './clubs.service';
import { CreateClubDto, UpdateClubDto } from './dto';

@Controller('clubs')
@UseGuards(JwtAuthGuard)
export class ClubsController {
  constructor(private readonly clubs: ClubsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.clubs.list(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateClubDto) {
    return this.clubs.create(user, dto);
  }

  @Patch(':clubId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('clubId', new ParseUUIDPipe({ version: '4' })) clubId: string,
    @Body() dto: UpdateClubDto,
  ) {
    return this.clubs.update(user, clubId, dto);
  }

  @Delete(':clubId')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('clubId', new ParseUUIDPipe({ version: '4' })) clubId: string,
  ) {
    return this.clubs.remove(user, clubId);
  }
}
