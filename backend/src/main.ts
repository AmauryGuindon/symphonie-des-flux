import * as dotenv from 'dotenv';
dotenv.config();

// ── Vérification obligatoire au démarrage ────────────────────────────────
if (!process.env.JWT_SECRET) {
  console.error('❌  JWT_SECRET est manquant dans les variables d\'environnement.');
  process.exit(1);
}

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:4200')
  .split(',')
  .map(o => o.trim());

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Headers de sécurité HTTP (X-Frame-Options, CSP, HSTS, etc.)
  // crossOriginResourcePolicy: cross-origin permet au frontend (port 4200) de charger
  // les images statiques servies par le backend (port 3000)
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // Servir les fichiers uploadés (galerie, etc.)
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

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
  console.log(`Backend DataCut démarré sur http://localhost:${port}/api`);
  console.log(`Origines autorisées : ${ALLOWED_ORIGINS.join(', ')}`);
}
bootstrap();
