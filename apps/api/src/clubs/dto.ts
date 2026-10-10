import { IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class CreateClubDto {
  @IsString()
  @MinLength(1, { message: '请填写俱乐部名称' })
  @MaxLength(40, { message: '俱乐部名称过长' })
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40, { message: '会长名称过长' })
  leader?: string;
}

export class UpdateClubDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: '请填写俱乐部名称' })
  @MaxLength(40, { message: '俱乐部名称过长' })
  name?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(40, { message: '会长名称过长' })
  leader?: string | null;
}
