import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { AuthUser } from '@ocr/shared-types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UploadExceptionFilter } from '../common/upload-exception.filter';
import { ListMembersQuery, WriteMemberDto } from './dto';
import { MembersService } from './members.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Post('clubs/:clubId/imports')
  @UseFilters(UploadExceptionFilter)
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  importImages(
    @CurrentUser() user: AuthUser,
    @Param('clubId', new ParseUUIDPipe({ version: '4' })) clubId: string,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ) {
    return this.members.importImages(user.id, clubId, files ?? []);
  }

  @Get('members')
  list(@CurrentUser() user: AuthUser, @Query() query: ListMembersQuery) {
    return this.members.list(user.id, query);
  }

  @Post('members')
  create(@CurrentUser() user: AuthUser, @Body() dto: WriteMemberDto) {
    return this.members.create(user.id, dto);
  }

  @Patch('members/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: WriteMemberDto,
  ) {
    return this.members.update(user.id, id, dto);
  }

  @Delete('members/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.members.remove(user.id, id);
  }
}
