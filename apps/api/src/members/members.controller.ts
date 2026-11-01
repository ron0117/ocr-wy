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
import { DeleteMembersDto, ListMembersQuery, TemplateImportDto, WriteMemberDto } from './dto';
import { MembersService } from './members.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Post('clubs/:clubId/imports/preview')
  @UseFilters(UploadExceptionFilter)
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  previewImages(
    @CurrentUser() user: AuthUser,
    @Param('clubId', new ParseUUIDPipe({ version: '4' })) clubId: string,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ) {
    return this.members.previewImages(user, clubId, files ?? []);
  }

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
    @Body('rows') rows?: string,
  ) {
    return this.members.confirmImport(user, clubId, files ?? [], rows);
  }

  @Post('clubs/:clubId/imports/template')
  importTemplate(
    @CurrentUser() user: AuthUser,
    @Param('clubId', new ParseUUIDPipe({ version: '4' })) clubId: string,
    @Body() body: TemplateImportDto,
  ) {
    return this.members.confirmTemplate(user, clubId, body.rows);
  }

  @Get('members')
  list(@CurrentUser() user: AuthUser, @Query() query: ListMembersQuery) {
    return this.members.list(user, query);
  }

  @Post('members')
  create(@CurrentUser() user: AuthUser, @Body() dto: WriteMemberDto) {
    return this.members.create(user, dto);
  }

  @Patch('members/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: WriteMemberDto,
  ) {
    return this.members.update(user, id, dto);
  }

  @Post('members/batch-delete')
  removeMany(@CurrentUser() user: AuthUser, @Body() dto: DeleteMembersDto) {
    return this.members.removeMany(user, dto.ids);
  }

  @Get('members/:id/activities')
  activities(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.members.activities(user, id);
  }

  @Delete('members/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.members.remove(user, id);
  }
}
