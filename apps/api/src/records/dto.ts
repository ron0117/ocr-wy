import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RecordRowDto {
  @IsInt()
  @Min(0)
  rowIndex!: number;

  @IsString()
  @MinLength(1, { message: '商品名称不能为空' })
  @MaxLength(300, { message: '商品名称过长' })
  productName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  price?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  quantity?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  total?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30, { message: '单位过长' })
  unit?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rawText?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  warnings?: string[];
}

export class UpdateRecordsDto {
  @IsArray()
  @ArrayMaxSize(10000)
  @ValidateNested({ each: true })
  @Type(() => RecordRowDto)
  rows!: RecordRowDto[];
}
