import {
  BadRequestException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function firstValidationMessage(errors: ValidationError[]): string {
  const messages: string[] = [];
  const walk = (items: ValidationError[]) => {
    for (const item of items) {
      if (item.constraints) {
        messages.push(...Object.values(item.constraints));
      }
      if (item.children?.length) walk(item.children);
    }
  };
  walk(errors);
  return messages[0] ?? '请求参数不正确';
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const http = app.getHttpAdapter().getInstance();
  if (typeof http.set === 'function') {
    http.set('trust proxy', 1);
  }
  app.setGlobalPrefix('api/v1');
  const origins = (process.env.GUIDE_WEB_ORIGIN ?? 'http://localhost:3002')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) =>
        new BadRequestException(firstValidationMessage(errors)),
    }),
  );

  // 勿用根目录 OCR 的 PORT=3000；Guide API 固定独立端口
  const port = Number(process.env.GUIDE_API_PORT ?? 3001);
  await app.listen(port);
}

void bootstrap();
