import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SendAssistantMessageDto {
  @IsString()
  @MinLength(1, { message: '管理员，小忧没听到内容。' })
  @MaxLength(500, { message: '管理员，这句话有点长，小忧一次只听 500 字。' })
  text!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{8,80}$/u, { message: '管理员，这次请求小忧对不上号。' })
  clientRequestId!: string;
}
