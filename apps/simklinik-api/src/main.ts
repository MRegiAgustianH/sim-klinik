import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import * as os from 'os';

function getLocalIpAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  for (const name of Object.keys(interfaces)) {
    const netList = interfaces[name];
    if (netList) {
      for (const net of netList) {
        if (net.family === 'IPv4' && !net.internal) {
          addresses.push(net.address);
        }
      }
    }
  }
  return addresses;
}

async function bootstrap() {
  const logger = new Logger('SIMKlinik-Server');
  const app = await NestFactory.create(AppModule);

  // Mengizinkan CORS untuk akses dari port client dan seluruh jaringan lokal
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global validation pipe untuk DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    })
  );

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
  // Bind ke 0.0.0.0 agar satu jaringan LAN / WiFi RS dapat mengakses
  await app.listen(port, '0.0.0.0');

  const lanIps = getLocalIpAddresses();
  logger.log(`=======================================================`);
  logger.log(`  Backend SIMKlinik Rotinsulu Server Aktif & Siap Menerima Request`);
  logger.log(`  Port: ${port}`);
  logger.log(`  Akses Lokal  : http://localhost:${port}`);
  lanIps.forEach((ip) => {
    logger.log(`  Akses LAN RS : http://${ip}:${port}`);
  });
  logger.log(`=======================================================`);
}

bootstrap();
