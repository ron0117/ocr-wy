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
  app.enableCors({
    origin: (process.env.WEB_ORIGIN ?? 'http://localhost:5777')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) =>
        new BadRequestException(firstValidationMessage(errors)),
    }),
  );

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
