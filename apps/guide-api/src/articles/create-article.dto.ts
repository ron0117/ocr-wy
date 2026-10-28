import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateArticleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  authorName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200_000)
  bodyHtml!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  coverUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  pathwaySlug?: string;
}
