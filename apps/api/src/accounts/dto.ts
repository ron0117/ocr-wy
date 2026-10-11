import { IsBoolean, IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateAccountDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  email!: string;

  @IsString()
  @MinLength(8, { message: '密码至少 8 位' })
  @MaxLength(72, { message: '密码过长' })
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40, { message: '名称过长' })
  name?: string;

  @IsUUID('4', { message: '请选择角色' })
  roleId!: string;
}

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(40, { message: '名称过长' })
  name?: string;

  @IsOptional()
  @IsUUID('4', { message: '请选择角色' })
  roleId?: string;

  @IsOptional()
  @IsBoolean()
  disabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(72, { message: '密码过长' })
  password?: string;
}

export class ListAccountsQuery {
  @IsOptional()
  @IsString()
  email?: string;
}
