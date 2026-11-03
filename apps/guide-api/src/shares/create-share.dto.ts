import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateShareDto {
  @IsString()
  @MaxLength(64)
  pathwaySlug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  scenarioCode?: string;

  @IsString()
  @MaxLength(32_000)
  shareText!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  /** 去重前最多 3 个；空数组或省略表示不带秘偶 */
  @IsOptional()
  @IsArray({ message: '上阵秘偶须为名称数组' })
  @ArrayMaxSize(3, { message: '上阵秘偶最多 3 个' })
  @IsString({ each: true, message: '上阵秘偶名称须为字符串' })
  @MaxLength(40, { each: true, message: '上阵秘偶名称最长 40 字' })
  deployedPuppets?: string[];
}
