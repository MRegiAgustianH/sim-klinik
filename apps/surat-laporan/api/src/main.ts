import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as os from 'os';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Surat-Server');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });

  // Isi surat bisa memuat gambar base64 (logo hasil tempel dari Word), jadi
  // batas body dinaikkan dari bawaan 100 KB.
  app.useBodyParser('json', { limit: '25mb' });
  app.useBodyParser('urlencoded', { limit: '25mb', extended: true });

  app.enableCors({ origin: true, methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS', credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4002;
  await app.listen(port, '0.0.0.0');

  logger.log('=======================================================');
  logger.log('  Backend Sistem Surat Aktif & Siap Menerima Request');
  logger.log(`  Port: ${port}`);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) logger.log(`  Akses LAN    : http://${net.address}:${port}`);
    }
  }
  logger.log('=======================================================');
}

bootstrap();
