export type Category = 'keluar' | 'internal' | 'formulir';
export type VarType = 'text' | 'textarea' | 'number' | 'date' | 'time' | 'select' | 'list' | 'tabel';
export type ListStyle = 'decimal' | 'lower-alpha' | 'disc' | 'none';
export type SignatureLayout = 'kanan' | 'kiri' | 'tengah' | 'kolom' | 'bertingkat' | 'tanpa';
export type KopMode = 'default' | 'library' | 'custom' | 'none';
export type LetterStatus = 'draft' | 'terbit' | 'batal';

export interface VarDef {
  key: string;
  label: string;
  type: VarType;
  required?: boolean;
  options?: string[];
  columns?: string[];
  default?: string;
  hint?: string;
  heading?: string;
  listStyle?: ListStyle;
}

export interface SignatureSlot {
  prefix?: string;
  label: string;
  signerId?: number | null;
  signerPosition?: string;
  showId?: boolean;
}

export interface TemplateSignature {
  layout: SignatureLayout;
  showPlaceDate: boolean;
  slots: SignatureSlot[];
}

export interface PageSetup {
  pageSize: 'A4' | 'F4' | 'Letter' | 'Legal' | 'A5';
  orientation: 'portrait' | 'landscape';
  margins: { top: number; right: number; bottom: number; left: number };
  fontFamily: string;
  fontSize: number;
  lineSpacing: number;
}

export interface Template {
  id: number;
  code: string;
  name: string;
  category: Category;
  description: string | null;
  letterheadMode: KopMode;
  letterheadId: number | null;
  customHeaderHtml: string;
  bodyHtml: string;
  closingHtml: string;
  signature: TemplateSignature;
  page: PageSetup;
  numbering: { code: string; pattern: string };
  variables: VarDef[];
  isActive: boolean;
  sortOrder: number;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateSummary {
  id: number;
  code: string;
  name: string;
  category: Category;
  description: string | null;
  isActive: boolean;
  version: number;
  updatedAt: string;
  updatedBy: string | null;
  numbering: { code: string; pattern: string };
  variableCount: number;
  signerCount: number;
  pageSize: string;
  letterCount: number;
}

export interface Letterhead {
  id: number;
  name: string;
  html: string;
  isDefault: number;
  usedBy?: number;
  updatedAt: string;
}

export interface Signer {
  id: number;
  name: string;
  position: string;
  idLabel: string | null;
  idNumber: string | null;
  isActive: number;
  sortOrder: number;
}

export interface Patient {
  id: number;
  nik: string | null;
  fullName: string;
  gender: string;
  birthPlace: string | null;
  birthDate: string | null;
  address: string | null;
  email?: string | null;
  phoneWa: string | null;
  occupation: string | null;
  maritalStatus: string | null;
  age: number | null;
}

export interface LetterSigner {
  level?: number;
  role: string;
  name: string;
  idLabel: string;
  idNumber: string;
  signerId: number | null;
}

export type VarValue = string | string[] | string[][];

export interface LetterSummary {
  id: number;
  letterNumber: string | null;
  templateId: number | null;
  templateVersion: number | null;
  templateName: string | null;
  category: Category;
  subject: string | null;
  recipient: string | null;
  patientId: number | null;
  patientSnapshot: Patient | null;
  status: LetterStatus;
  letterDate: string;
  createdBy: number | null;
  createdByName: string | null;
  updatedByName: string | null;
  issuedAt: string | null;
  issuedByName: string | null;
  cancelledAt: string | null;
  cancelledByName: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Letter extends LetterSummary {
  numberCode: string | null;
  numberPattern: string | null;
  payload: Record<string, VarValue>;
  contentHtml: string;
  signers: LetterSigner[];
}

export type Settings = Record<string, string>;
