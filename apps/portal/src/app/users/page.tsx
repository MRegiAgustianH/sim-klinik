'use client';

import React, { useCallback, useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import { apiFetch } from '@/lib/api';
import { UserRole } from '@/lib/types';
import {
  Loader2,
  UserPlus,
  Pencil,
  X,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  KeyRound,
  ListChecks,
} from 'lucide-react';

const ROLES: UserRole[] = ['Superadmin', 'Dokter', 'Perawat', 'Administrasi'];
const APP_CODES = ['portal', 'simklinik', 'surat', 'laporan'];

interface ManagedUser {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
  isActive: number;
  createdAt: string;
  apps: string[];
  // Centang fitur per aplikasi, mis. { simklinik: ['mcu.tulis', ...] }.
  permissions: Record<string, string[]>;
}

// Daftar fitur yang didaftarkan setiap aplikasi ke layanan identitas.
interface AppCatalog {
  appCode: string;
  permissions: { code: string; label: string; group?: string; description?: string }[];
  presets: { code: string; label: string; permissions: string[] }[];
}

interface UserForm {
  username: string;
  fullName: string;
  role: UserRole;
  password: string;
  isActive: boolean;
  appCodes: string[];
  permissions: Record<string, string[]>;
}

const emptyForm: UserForm = {
  username: '',
  fullName: '',
  role: 'Perawat',
  password: '',
  isActive: true,
  appCodes: ['portal'],
  permissions: {},
};

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item) => b.includes(item));
}

export default function UsersPage() {
  const { token } = useAuth();
  const { success, error: toastError } = useToast();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [catalogs, setCatalogs] = useState<Record<string, AppCatalog>>({});
  const [appNames, setAppNames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await apiFetch<{ data: ManagedUser[] }>('/api/users', { token });
      setUsers(res.data);
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Gagal memuat daftar pengguna.');
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [token, toastError]);

  useEffect(() => {
    load();
  }, [load]);

  // Katalog fitur dimuat sekali. Aplikasi yang belum pernah dinyalakan belum
  // mendaftarkan katalognya, dan cukup diatur aksesnya saja.
  useEffect(() => {
    if (!token) return;
    apiFetch<{ data: { code: string; name: string }[] }>('/api/apps/all', { token })
      .then((res) => setAppNames(Object.fromEntries(res.data.map((app) => [app.code, app.name]))))
      .catch(() => setAppNames({}));
    Promise.all(
      APP_CODES.filter((code) => code !== 'portal').map((code) =>
        apiFetch<AppCatalog>(`/api/apps/${code}/catalog`, { token }).catch(() => null)
      )
    ).then((list) => {
      const next: Record<string, AppCatalog> = {};
      for (const catalog of list) {
        if (catalog && catalog.permissions.length > 0) next[catalog.appCode] = catalog;
      }
      setCatalogs(next);
    });
  }, [token]);

  // Untuk akun baru, preset yang namanya sama dengan peran dipilih otomatis
  // saat aplikasinya dicentang, agar Superadmin tidak mulai dari kosong.
  const defaultPermissions = (appCode: string, role: UserRole): string[] => {
    const preset = catalogs[appCode]?.presets.find((p) => p.code === role.toLowerCase());
    return preset ? [...preset.permissions] : [];
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEdit = (user: ManagedUser) => {
    setEditing(user);
    setForm({
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      // Dikosongkan: password hanya diisi bila Superadmin memang ingin
      // meresetnya. Mengirim nilai kosong berarti "jangan diubah".
      password: '',
      isActive: user.isActive === 1,
      appCodes: user.apps,
      permissions: user.permissions ?? {},
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const toggleApp = (code: string) => {
    setForm((prev) => {
      const enabling = !prev.appCodes.includes(code);
      const permissions = { ...prev.permissions };
      if (enabling && !(permissions[code]?.length)) {
        permissions[code] = defaultPermissions(code, prev.role);
      }
      return {
        ...prev,
        appCodes: enabling ? [...prev.appCodes, code] : prev.appCodes.filter((item) => item !== code),
        permissions,
      };
    });
  };

  const setAppPermissions = (appCode: string, permissions: string[]) => {
    setForm((prev) => ({ ...prev, permissions: { ...prev.permissions, [appCode]: permissions } }));
  };

  // Centang fitur dikirim untuk setiap aplikasi yang punya katalog dan
  // dicentang aksesnya. Aplikasi yang aksesnya dicabut cukup ditutup aksesnya;
  // centangnya disimpan agar tidak hilang bila akses diberikan lagi.
  const savePermissions = async (userId: number) => {
    for (const appCode of form.appCodes) {
      if (!catalogs[appCode]) continue;
      await apiFetch(`/api/users/${userId}/permissions`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ appCode, permissions: form.permissions[appCode] ?? [] }),
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!form.fullName.trim()) {
      setFormError('Nama lengkap wajib diisi.');
      return;
    }
    if (!editing && !form.username.trim()) {
      setFormError('Username wajib diisi.');
      return;
    }
    if (!editing && form.password.length < 6) {
      setFormError('Password minimal 6 karakter.');
      return;
    }
    if (editing && form.password && form.password.length < 6) {
      setFormError('Password minimal 6 karakter.');
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await apiFetch(`/api/users/${editing.id}`, {
          method: 'PUT',
          token,
          body: JSON.stringify({
            fullName: form.fullName.trim(),
            role: form.role,
            isActive: form.isActive,
            ...(form.password ? { password: form.password } : {}),
          }),
        });
        // Akses app diatur lewat endpoint tersendiri; Superadmin otomatis
        // punya semua akses sehingga endpoint itu menolaknya.
        if (form.role !== 'Superadmin') {
          await apiFetch(`/api/users/${editing.id}/apps`, {
            method: 'PUT',
            token,
            body: JSON.stringify({ appCodes: form.appCodes }),
          });
          await savePermissions(editing.id);
        }
        success(`Data ${form.fullName} berhasil diperbarui.`);
      } else {
        const created = await apiFetch<ManagedUser>('/api/users', {
          method: 'POST',
          token,
          body: JSON.stringify({
            username: form.username.trim(),
            fullName: form.fullName.trim(),
            role: form.role,
            password: form.password,
            appCodes: form.role === 'Superadmin' ? [] : form.appCodes,
          }),
        });
        if (form.role !== 'Superadmin') await savePermissions(created.id);
        success(`Pengguna ${form.fullName} berhasil dibuat.`);
      }
      setIsFormOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan data pengguna.');
    } finally {
      setIsSaving(false);
    }
  };

  const appLabel = (code: string, user: ManagedUser) => {
    const name = appNames[code] ?? code;
    const catalog = catalogs[code];
    if (!catalog) return name;
    return `${name} (${(user.permissions?.[code] ?? []).length}/${catalog.permissions.length} fitur)`;
  };

  const roleBadge = (role: UserRole) => {
    const style =
      role === 'Superadmin'
        ? 'bg-portal-50 text-portal-800 border-portal-200'
        : role === 'Dokter'
        ? 'bg-brand-50 text-brand-900 border-brand-200'
        : role === 'Perawat'
        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
        : 'bg-slate-100 text-slate-700 border-slate-200';
    return (
      <span className={`inline-block text-xs font-semibold border rounded-full px-2.5 py-0.5 ${style}`}>
        {role}
      </span>
    );
  };

  return (
    <PortalShell
      title="Pengguna"
      subtitle="Satu akun untuk seluruh aplikasi klinik. Atur peran dan aplikasi yang boleh dibuka."
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-sm text-slate-600">
          {!isLoading && (
            <>
              <span className="font-semibold text-slate-900">{users.length}</span> akun terdaftar
            </>
          )}
        </p>
        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-portal-600 hover:bg-portal-700 text-white text-sm font-semibold"
        >
          <UserPlus className="w-4 h-4" />
          Pengguna Baru
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-portal-600" />
            <span className="text-sm font-medium">Memuat daftar pengguna…</span>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="px-4 py-3">Nama</th>
                    <th className="px-4 py-3">Username</th>
                    <th className="px-4 py-3">Peran</th>
                    <th className="px-4 py-3">Akses Aplikasi</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{user.fullName}</td>
                      <td className="px-4 py-3 text-slate-600">@{user.username}</td>
                      <td className="px-4 py-3">{roleBadge(user.role)}</td>
                      <td className="px-4 py-3">
                        {user.role === 'Superadmin' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Semua aplikasi
                          </span>
                        ) : user.apps.length === 0 ? (
                          <span className="text-xs text-slate-400">Belum ada akses</span>
                        ) : (
                          <span className="text-xs text-slate-600">
                            {user.apps.map((code) => appLabel(code, user)).join(', ')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {user.isActive === 1 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                            <XCircle className="w-3.5 h-3.5" />
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openEdit(user)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-portal-700 hover:text-portal-900 px-2.5 py-1.5 rounded-lg hover:bg-portal-50"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Ubah
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="md:hidden divide-y divide-slate-100">
              {users.map((user) => (
                <li key={user.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{user.fullName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">@{user.username}</p>
                      <div className="mt-1.5">{roleBadge(user.role)}</div>
                      <p className="text-xs text-slate-500 mt-1.5">
                        {user.role === 'Superadmin'
                          ? 'Semua aplikasi'
                          : user.apps.map((code) => appLabel(code, user)).join(', ') || 'Belum ada akses'}
                        {user.isActive === 0 && ' · Nonaktif'}
                      </p>
                    </div>
                    <button
                      onClick={() => openEdit(user)}
                      className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-portal-700 px-2.5 py-1.5 rounded-lg border border-portal-200"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Ubah
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-2 sm:p-4">
          {/* Tinggi dibatasi layar: judul dan tombol simpan selalu terlihat,
              hanya isi formulir yang digulir. */}
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] flex flex-col">
            <div className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
              <div className="min-w-0">
                <h2 className="font-bold text-slate-900">
                  {editing ? 'Ubah Pengguna' : 'Pengguna Baru'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {editing ? `${editing.fullName} · @${editing.username}` : 'Akun berlaku untuk seluruh aplikasi klinik'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                aria-label="Tutup formulir"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
                {formError && (
                  <div className="mb-4 flex items-start gap-2 text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-x-6 gap-y-5">
                  {/* Kiri: data akun */}
                  <section className="space-y-3.5">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Data Akun</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="user-username" className="block text-xs font-semibold text-slate-700 mb-1">
                          Username
                        </label>
                        <input
                          id="user-username"
                          type="text"
                          required
                          disabled={Boolean(editing)}
                          value={form.username}
                          onChange={(e) => setForm({ ...form, username: e.target.value })}
                          className={`w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-portal-600 focus:border-transparent ${
                            editing ? 'bg-slate-100 text-slate-500' : ''
                          }`}
                        />
                      </div>
                      <div>
                        <label htmlFor="user-role" className="block text-xs font-semibold text-slate-700 mb-1">
                          Peran
                        </label>
                        <select
                          id="user-role"
                          value={form.role}
                          onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-portal-600 focus:border-transparent"
                        >
                          {ROLES.map((role) => (
                            <option key={role}>{role}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="user-fullname" className="block text-xs font-semibold text-slate-700 mb-1">
                        Nama Lengkap &amp; Gelar
                      </label>
                      <input
                        id="user-fullname"
                        type="text"
                        required
                        value={form.fullName}
                        onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                        placeholder="mis. Ns. Siti Nurhaliza, S.Kep"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-portal-600 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label htmlFor="user-password" className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                        <KeyRound className="w-3.5 h-3.5" />
                        {editing ? 'Reset Password (opsional)' : 'Password'}
                      </label>
                      <input
                        id="user-password"
                        type="text"
                        required={!editing}
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        placeholder={editing ? 'Kosongkan bila tidak ingin mengubah' : 'Minimal 6 karakter'}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-portal-600 focus:border-transparent"
                      />
                    </div>

                    {editing && (
                      <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={form.isActive}
                          onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                          className="mt-0.5 rounded border-slate-300 text-portal-600 focus:ring-portal-500"
                        />
                        <span className="text-sm text-slate-700">
                          Akun aktif
                          <span className="block text-xs text-slate-500">
                            Bila dimatikan, pemiliknya tidak bisa login ke aplikasi mana pun.
                          </span>
                        </span>
                      </label>
                    )}
                  </section>

                  {/* Kanan: akses aplikasi & fitur */}
                  <section className="space-y-3 lg:border-l lg:border-slate-200 lg:pl-6">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Akses Aplikasi &amp; Fitur
                    </h3>
                    {form.role === 'Superadmin' ? (
                      <div className="flex items-start gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>
                          Superadmin otomatis dapat membuka semua aplikasi dan memakai semua fitur, termasuk
                          aplikasi yang didaftarkan nanti.
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {APP_CODES.map((code) => (
                            <label
                              key={code}
                              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm cursor-pointer transition-colors ${
                                form.appCodes.includes(code)
                                  ? 'border-portal-400 bg-portal-50 text-portal-900'
                                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={form.appCodes.includes(code)}
                                onChange={() => toggleApp(code)}
                                className="rounded border-slate-300 text-portal-600 focus:ring-portal-500"
                              />
                              <span className="font-medium">{appNames[code] ?? code}</span>
                            </label>
                          ))}
                        </div>

                        {form.appCodes
                          .filter((code) => catalogs[code])
                          .map((code) => (
                            <PermissionEditor
                              key={code}
                              appName={appNames[code] ?? code}
                              catalog={catalogs[code]}
                              selected={form.permissions[code] ?? []}
                              onChange={(next) => setAppPermissions(code, next)}
                            />
                          ))}

                        <p className="text-xs text-slate-500">
                          Melihat data selalu boleh bagi yang punya akses aplikasi. Perubahan berlaku paling lambat
                          30 detik.
                        </p>
                      </>
                    )}
                  </section>
                </div>
              </div>

              <div className="shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-portal-600 hover:bg-portal-700 text-white text-sm font-semibold disabled:opacity-60"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSaving ? 'Menyimpan…' : editing ? 'Simpan Perubahan' : 'Buat Pengguna'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalShell>
  );
}

// Centang fitur satu aplikasi. Preset hanya mengisi centang; setelah itu
// Superadmin tetap bebas menambah atau mengurangi per orang.
function PermissionEditor({
  appName,
  catalog,
  selected,
  onChange,
}: {
  appName: string;
  catalog: AppCatalog;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const matchedPreset = catalog.presets.find((preset) => sameSet(preset.permissions, selected));
  const groups = catalog.permissions.reduce<Record<string, AppCatalog['permissions']>>((acc, permission) => {
    (acc[permission.group ?? 'Lainnya'] ??= []).push(permission);
    return acc;
  }, {});

  const toggle = (code: string) =>
    onChange(selected.includes(code) ? selected.filter((item) => item !== code) : [...selected, code]);

  return (
    <div className="rounded-lg border border-slate-200">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200 bg-slate-50 rounded-t-lg">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-800 min-w-0">
          <ListChecks className="w-4 h-4 shrink-0 text-portal-600" />
          <span className="truncate">Fitur {appName}</span>
          <span className="shrink-0 text-xs font-normal text-slate-500">
            {selected.length}/{catalog.permissions.length}
          </span>
        </span>
        <select
          value={matchedPreset?.code ?? ''}
          onChange={(e) => {
            const preset = catalog.presets.find((p) => p.code === e.target.value);
            if (preset) onChange([...preset.permissions]);
          }}
          aria-label={`Preset fitur ${appName}`}
          className="shrink-0 px-2 py-1 text-xs rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-portal-600"
        >
          <option value="" disabled>
            Kustom
          </option>
          {catalog.presets.map((preset) => (
            <option key={preset.code} value={preset.code}>
              Preset: {preset.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 px-3 py-2.5">
        {Object.entries(groups).map(([group, permissions]) => (
          <fieldset key={group} className="min-w-0">
            <legend className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">{group}</legend>
            {permissions.map((permission) => (
              <label
                key={permission.code}
                title={permission.description}
                className="flex items-start gap-2 py-1 text-sm text-slate-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(permission.code)}
                  onChange={() => toggle(permission.code)}
                  className="mt-0.5 shrink-0 rounded border-slate-300 text-portal-600 focus:ring-portal-500"
                />
                <span className="leading-snug">{permission.label}</span>
              </label>
            ))}
          </fieldset>
        ))}
      </div>
    </div>
  );
}
