import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ChatDto {
  @IsString()
  @MinLength(1, { message: '请输入整理要求' })
  @MaxLength(2000, { message: '整理要求过长' })
  message!: string;
}

export class ApplyTemplateDto {
  @IsOptional()
  @IsUUID('4', { message: '模板标识不正确' })
  templateId?: string;
}
