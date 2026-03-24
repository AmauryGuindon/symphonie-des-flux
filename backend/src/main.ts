import * as dotenv from 'dotenv';
dotenv.config();

// ── Vérification obligatoire au démarrage ────────────────────────────────
if (!process.env.JWT_SECRET) {
  console.error('❌  JWT_SECRET est manquant dans les variables d\'environnement.');
  process.exit(1);
}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:4200')
  .split(',')
  .map(o => o.trim());

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Headers de sécurité HTTP (X-Frame-Options, CSP, HSTS, etc.)
  app.use(helmet());

  // CORS restreint aux origines déclarées
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origine non autorisée — ${origin}`));
      }
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Backend Dany1st démarré sur http://localhost:${port}/api`);
  console.log(`Origines autorisées : ${ALLOWED_ORIGINS.join(', ')}`);
}
bootstrap();
