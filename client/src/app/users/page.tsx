'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';
import {
  UserCog,
  Plus,
  ShieldCheck,
  Stethoscope,
  HeartPulse,
  Edit,
  Trash2,
  X,
  Lock,
  User,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface UserSummary {
  id: number;
  username: string;
  fullName: string;
  role: 'Superadmin' | 'Dokter' | 'Perawat';
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

export default function UsersPage() {
  const { user: currentUser, hasRole } = useAuth();
  const { success, error: toastError, warning } = useToast();

  const [users, setUsers] = useState<UserSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserSummary | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    password: '',
    role: 'Perawat' as 'Superadmin' | 'Dokter' | 'Perawat',
    isActive: 1,
  });

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch<UserSummary[]>('/api/users');
      setUsers(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat daftar pengguna.';
      toastError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  if (!hasRole('Superadmin')) {
    return (
      <AppShell>
        <div className="p-8 text-center text-slate-500 text-sm">
          Akses terbatas. Halaman ini hanya dapat diakses oleh Superadministrator Rumah Sakit.
        </div>
      </AppShell>
    );
  }

  const handleOpenAdd = () => {
    setIsEditing(false);
    setSelectedUser(null);
    setFormData({
      username: '',
      fullName: '',
      password: '',
      role: 'Perawat',
      isActive: 1,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (u: UserSummary) => {
    setIsEditing(true);
    setSelectedUser(u);
    setFormData({
      username: u.username,
      fullName: u.fullName,
      password: '',
      role: u.role,
      isActive: u.isActive,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (isEditing && selectedUser) {
        const payload: { fullName?: string; role?: 'Superadmin' | 'Dokter' | 'Perawat'; password?: string; isActive?: number } = {
          fullName: formData.fullName,
          role: formData.role,
          isActive: formData.isActive,
        };
        if (formData.password.trim().length >= 6) {
          payload.password = formData.password.trim();
        }

        await apiFetch(`/api/users/${selectedUser.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        success(`Data pengguna ${selectedUser.username} berhasil diperbarui.`);
      } else {
        if (!formData.username.trim() || !formData.password.trim()) {
          warning('Username dan password wajib diisi.');
          return;
        }

        await apiFetch('/api/users', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
        success('Pengguna baru berhasil didaftarkan.');
      }

      setIsModalOpen(false);
      fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan pengguna.';
      toastError(msg);
    }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await apiFetch(`/api/users/${userToDelete.id}`, { method: 'DELETE' });
      success(`Akun pengguna '${userToDelete.username}' berhasil dihapus.`);
      setUserToDelete(null);
      fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus pengguna.';
      toastError(msg);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'Superadmin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            <ShieldCheck className="w-3 h-3" /> Superadmin
          </span>
        );
      case 'Dokter':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <Stethoscope className="w-3 h-3" /> Dokter
          </span>
        );
      case 'Perawat':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <HeartPulse className="w-3 h-3" /> Perawat
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <UserCog className="w-6 h-6 text-teal-700" />
              Kelola Pengguna Sistem
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Manajemen hak akses akun Superadmin, Dokter Pemeriksa, dan Perawat Pelaksana
            </p>
          </div>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Pengguna Baru</span>
          </button>
        </div>

        {/* Tabel Pengguna */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">No</th>
                  <th className="py-3 px-4">Username</th>
                  <th className="py-3 px-4">Nama Lengkap & Gelar</th>
                  <th className="py-3 px-4">Peran (Role)</th>
                  <th className="py-3 px-4 text-center">Status Akun</th>
                  <th className="py-3 px-4">Tanggal Dibuat</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Memuat data pengguna...
                    </td>
                  </tr>
                ) : users.length > 0 ? (
                  users.map((u, idx) => (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-500">{idx + 1}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">@{u.username}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{u.fullName}</td>
                      <td className="py-3 px-4">{getRoleBadge(u.role)}</td>
                      <td className="py-3 px-4 text-center">
                        {u.isActive === 1 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            <AlertCircle className="w-3 h-3" /> Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {u.createdAt.substring(0, 10)}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(u)}
                            className="p-1.5 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                            title="Ubah Pengguna"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {u.id !== currentUser?.id && (
                            <button
                              onClick={() => setUserToDelete(u)}
                              className="p-1.5 rounded text-rose-600 hover:text-rose-800 hover:bg-rose-50 cursor-pointer"
                              title="Hapus Pengguna"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Tidak ada pengguna terdaftar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Form Tambah / Ubah */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/60" onClick={() => setIsModalOpen(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 z-10 space-y-4 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-900">
                  {isEditing ? `Ubah Pengguna: @${selectedUser?.username}` : 'Tambah Pengguna Baru'}
                </h3>
                <button onClick={() => setIsModalOpen(false)}>
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                {!isEditing && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Username *</label>
                    <input
                      type="text"
                      required
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().trim() })}
                      placeholder="Contoh: dokter_ani"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-600"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap & Gelar *</label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="Contoh: dr. Ani Suryani, Sp.A"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Peran (Role) *</label>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        role: e.target.value as 'Superadmin' | 'Dokter' | 'Perawat',
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 bg-white font-semibold"
                  >
                    <option value="Superadmin">Superadmin (Akses Penuh)</option>
                    <option value="Dokter">Dokter (Pemeriksa / Telaah Medis)</option>
                    <option value="Perawat">Perawat (Registrasi & Vaksinasi)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {isEditing ? 'Password Baru (Kosongkan jika tidak diubah)' : 'Password Akun (Minimal 6 karakter) *'}
                  </label>
                  <input
                    type="password"
                    required={!isEditing}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={isEditing ? '••••••••' : 'Masukkan password baru'}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-600"
                  />
                </div>

                {isEditing && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Status Akun</label>
                    <select
                      value={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 bg-white"
                    >
                      <option value={1}>Aktif (Dapat Login)</option>
                      <option value={0}>Nonaktif (Diblokir)</option>
                    </select>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold cursor-pointer"
                  >
                    {isEditing ? 'Simpan Perubahan' : 'Daftarkan Pengguna'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Konfirmasi Hapus Pengguna */}
        <ConfirmModal
          isOpen={!!userToDelete}
          title="Konfirmasi Hapus Pengguna"
          message={`Apakah Anda yakin ingin menghapus akun pengguna '${userToDelete?.username}' (${userToDelete?.fullName})? Pengguna ini tidak akan dapat login lagi ke sistem.`}
          confirmText="Ya, Hapus Akun"
          cancelText="Batal"
          onConfirm={confirmDeleteUser}
          onCancel={() => setUserToDelete(null)}
        />
      </div>
    </AppShell>
  );
}
