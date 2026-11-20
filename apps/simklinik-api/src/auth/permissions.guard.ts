import { Injectable, CanActivate, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser } from './jwt.strategy';
import { Permission, PERMISSION_CATALOG } from './permissions';

export const PERMISSION_KEY = 'requiredPermission';

/** Endpoint hanya boleh dipakai pengguna yang dicentang fitur ini di portal. */
export const RequirePermission = (permission: Permission) => SetMetadata(PERMISSION_KEY, permission);

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!user) {
      throw new ForbiddenException('Akses ditolak: pengguna belum terautentikasi.');
    }
    if (user.isSuperadmin || user.permissions.includes(required)) return true;

    const label = PERMISSION_CATALOG.find((p) => p.code === required)?.label ?? required;
    throw new ForbiddenException(
      `Akses ditolak: akun Anda belum diberi izin "${label}". Minta Superadmin mengaturnya di portal.`
    );
  }
}
