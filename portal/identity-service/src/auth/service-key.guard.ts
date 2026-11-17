import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { SERVICE_KEY_META, ServiceKeyRequirement } from './service-key.decorator';

interface ServiceKeyRow {
  id: number;
  name: string;
  keyHash: string;
  canVerifyAll: number;
  isActive: number;
}

// Endpoint antar-layanan (verify, mint) tidak memakai JWT pengguna, melainkan
// service key per aplikasi. Kuncinya disimpan sebagai hash bcrypt, jadi bocornya
// file database tidak langsung membuka akses.
@Injectable()
export class ServiceKeyGuard implements CanActivate {
  constructor(
    private readonly db: DatabaseService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requirement =
      this.reflector.getAllAndOverride<ServiceKeyRequirement>(SERVICE_KEY_META, [
        context.getHandler(),
        context.getClass(),
      ]) || {};

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      serviceName?: string;
    }>();

    const rawKey = request.headers['x-service-key'];
    const name = request.headers['x-service-name'];
    const serviceKey = Array.isArray(rawKey) ? rawKey[0] : rawKey;
    const serviceName = Array.isArray(name) ? name[0] : name;

    if (!serviceKey || !serviceName) {
      throw new UnauthorizedException('Header x-service-name dan x-service-key wajib dikirim.');
    }

    const rows = this.db.query<ServiceKeyRow>(
      'SELECT id, name, keyHash, canVerifyAll, isActive FROM service_keys WHERE name = ?',
      [serviceName]
    );

    const matched = rows.find((row) => row.isActive === 1 && bcrypt.compareSync(serviceKey, row.keyHash));
    if (!matched) {
      throw new UnauthorizedException('Service key tidak valid atau tidak aktif.');
    }

    if (requirement.canVerifyAll && matched.canVerifyAll !== 1) {
      throw new ForbiddenException(
        `Layanan '${matched.name}' tidak berwenang memverifikasi token aplikasi lain.`
      );
    }

    this.db.run('UPDATE service_keys SET lastUsedAt = CURRENT_TIMESTAMP WHERE id = ?', [matched.id]);
    request.serviceName = matched.name;
    return true;
  }
}
