import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  @MinLength(1, { message: '请填写模板名称' })
  @MaxLength(60, { message: '模板名称过长' })
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300, { message: '模板说明过长' })
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: '模板提示过长' })
  prompt?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
