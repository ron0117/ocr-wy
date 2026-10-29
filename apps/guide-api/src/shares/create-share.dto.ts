import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

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
}
