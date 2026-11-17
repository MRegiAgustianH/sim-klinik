// portal-dashboard/src/lib/types.ts

export type UserRole = 'Superadmin' | 'Dokter' | 'Perawat' | 'Administrasi';

export interface PortalUser {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
  apps: string[];
}

export interface AppEntry {
  id: number;
  code: string;
  name: string;
  description: string | null;
  frontendUrl: string | null;
  backendUrl: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: number;
}

export type AppHealthStatus = 'aktif' | 'tidak aktif' | 'tidak dapat dihubungi' | 'url belum diisi';

export interface AppHealth {
  code: string;
  name: string;
  frontendUrl: string | null;
  backendUrl: string | null;
  status: AppHealthStatus;
  httpStatus: number | null;
  latencyMs: number | null;
}

export interface Patient {
  id: number;
  nik: string | null;
  fullName: string;
  gender: string;
  birthPlace: string | null;
  birthDate: string | null;
  email: string | null;
  address: string | null;
  phoneWa: string | null;
  occupation: string | null;
  maritalStatus: string | null;
  bloodType: string | null;
  allergy: string | null;
  sourceApp: string | null;
  age: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PatientSearchResult {
  total: number;
  limit: number;
  offset: number;
  data: Patient[];
}
