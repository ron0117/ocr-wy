import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
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
}

export class LoginDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  email!: string;

  @IsString()
  @MinLength(1, { message: '请输入密码' })
  @MaxLength(72)
  password!: string;
}
