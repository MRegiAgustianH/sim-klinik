import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { IdentityClient } from '../identity/identity-client.service';
import { PERMISSION_CATALOG, PERMISSION_PRESETS } from './permissions';

const RETRY_DELAYS_MS = [0, 2_000, 5_000, 15_000, 60_000];

// Mengirim daftar fitur aplikasi surat ke layanan identitas saat backend start,
// agar portal bisa menampilkan centang fitur yang selalu sesuai versi kode
// yang sedang berjalan. Kegagalan tidak menghentikan backend: katalog yang
// sudah tersimpan sebelumnya tetap dipakai, dan pendaftaran dicoba lagi.
@Injectable()
export class CatalogRegistrar implements OnApplicationBootstrap {
  private readonly logger = new Logger(CatalogRegistrar.name);

  constructor(private readonly identity: IdentityClient) {}

  onApplicationBootstrap() {
    void this.register(0);
  }

  private async register(attempt: number) {
    try {
      await this.identity.registerCatalog({ permissions: PERMISSION_CATALOG, presets: PERMISSION_PRESETS });
      this.logger.log(`Daftar fitur aplikasi surat (${PERMISSION_CATALOG.length} fitur) terdaftar di layanan identitas.`);
    } catch (err) {
      const next = RETRY_DELAYS_MS[attempt + 1];
      const reason = err instanceof Error ? err.message : String(err);
      if (next === undefined) {
        this.logger.error(`Gagal mendaftarkan daftar fitur ke layanan identitas: ${reason}`);
        return;
      }
      this.logger.warn(`Pendaftaran daftar fitur gagal (${reason}); dicoba lagi dalam ${next / 1000} detik.`);
      setTimeout(() => void this.register(attempt + 1), next);
    }
  }
}
