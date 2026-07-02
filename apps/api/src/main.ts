import 'reflect-metadata';

import { parseEnv } from '@dealflow/shared';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { z } from 'zod';

import { AppModule } from './app.module';

const bootEnvSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  PORT: z.coerce.number().int().positive().default(3001),
});

async function bootstrap(): Promise<void> {
  const env = parseEnv(bootEnvSchema);

  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  await app.listen(env.PORT);
  console.log(`API listening on port ${env.PORT}`);
}

bootstrap().catch((err: unknown) => {
  console.error('Fatal: failed to boot API', err);
  process.exit(1);
});
