import { SetMetadata } from '@nestjs/common';

export const SERVICE_KEY_META = 'serviceKey';
export interface ServiceKeyRequirement {
  // true hanya untuk portal: boleh memverifikasi token milik app mana pun.
  canVerifyAll?: boolean;
}
export const RequireServiceKey = (req: ServiceKeyRequirement = {}) =>
  SetMetadata(SERVICE_KEY_META, req);
