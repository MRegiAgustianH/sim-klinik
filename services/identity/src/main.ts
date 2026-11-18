import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

const DEFAULT_PORT = 4010;

async function bootstrap() {
  const logger = new Logger('IdentityService');
  const app = await NestFactory.create(AppModule);

  // Hanya app klinik yang memanggil layanan ini lewat backend masing-masing dan
  // portal di browser. Origin dibuka untuk jaringan lokal, sama seperti SIMKlinik.
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization', 'x-service-name', 'x-service-key', 'x-target-aud'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    })
  );

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : DEFAULT_PORT;
  // Bind ke 0.0.0.0 agar app lain di jaringan lokal bisa memanggil layanan ini.
  await app.listen(port, '0.0.0.0');

  logger.log('=======================================================');
  logger.log('  Layanan Identitas SIMKlinik Aktif');
  logger.log(`  Port : ${port}`);
  logger.log(`  Health: http://localhost:${port}/api/health`);
  if (!process.env.JWT_SECRET) {
    logger.warn('  JWT_SECRET belum diset: memakai nilai bawaan. Ganti sebelum dipakai di klinik.');
  }
  logger.log('=======================================================');
}

bootstrap();
