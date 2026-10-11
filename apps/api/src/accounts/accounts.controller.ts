import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@ocr/shared-types';
import { MenuGuard, RequireMenu } from '../access/menu.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccountsService } from './accounts.service';
import { CreateAccountDto, ListAccountsQuery, UpdateAccountDto } from './dto';

@Controller('accounts')
@UseGuards(JwtAuthGuard, MenuGuard)
@RequireMenu('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  list(@Query() query: ListAccountsQuery) {
    return this.accounts.list(query);
  }

  @Post()
  create(@Body() dto: CreateAccountDto) {
    return this.accounts.create(dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.accounts.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.accounts.remove(user, id);
  }
}
