import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTaskDto {
  @IsString()
  @MinLength(1, { message: '请填写任务名称' })
  @MaxLength(120, { message: '任务名称过长' })
  title!: string;

  @IsOptional()
  @IsUUID('4', { message: '模板标识不正确' })
  templateId?: string;
}

export class ListTaskQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class RecognizeDto {
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
