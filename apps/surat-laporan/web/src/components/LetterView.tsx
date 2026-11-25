'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer, FileDown, Copy, Ban, Loader2, Hash, CalendarDays, UserRound, PenLine, Info, Trash2 } from 'lucide-react';
import PaperView from './PaperView';
import Modal, { ConfirmModal } from './Modal';
import { CategoryBadge, StatusBadge } from './Badges';
import { useToast } from './Toast';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, errorMessage } from '@/lib/api';
import { downloadDocHtml, printHtml } from '@/lib/suratpro';
import { formatDateId } from '@/lib/variables';
import type { Letter } from '@/lib/types';

// Tampilan surat yang sudah terbit atau dibatalkan (dan draft bagi yang tidak
// berhak mengubah). Isi surat dikunci; perubahan dilakukan lewat duplikat.
export default function LetterView({ letter, onChanged }: { letter: Letter; onChanged: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const { can } = useAuth();
  const { user } = useAuth();
  const [busy, setBusy] = useState<null | 'dup' | 'cancel' | 'delete'>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const canDelete = letter.status === 'batal' && !!user?.isSuperadmin;

  const remove = async () => {
    setBusy('delete');
    try {
      const res = await apiFetch<{ message: string }>(`/api/surat/${letter.id}`, { method: 'DELETE' });
      toast('success', res.message);
      router.push('/surat');
    } catch (err) {
      toast('error', errorMessage(err));
      setBusy(null);
      setDeleteOpen(false);
    }
  };
  const [reason, setReason] = useState('');

  const fileName = `${letter.subject || letter.templateName || 'Surat'}${letter.letterNumber ? ` ${letter.letterNumber}` : ''}`;

  const duplicate = async () => {
    setBusy('dup');
    try {
      const copy = await apiFetch<Letter>(`/api/surat/${letter.id}/duplikat`, { method: 'POST' });
      toast('success', 'Salinan dibuat sebagai draft baru.');
      router.push(`/surat/${copy.id}`);
    } catch (err) {
      toast('error', errorMessage(err));
      setBusy(null);
    }
  };

  const cancel = async () => {
    setBusy('cancel');
    try {
      await apiFetch(`/api/surat/${letter.id}/batal`, { method: 'POST', body: JSON.stringify({ reason }) });
      toast('success', 'Surat dibatalkan. Nomornya tetap tercatat dan tidak dipakai ulang.');
      setCancelOpen(false);
      onChanged();
    } catch (err) {
      toast('error', errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="h-14 shrink-0 bg-white border-b border-slate-200 flex items-center gap-2 px-3">
        <Link href="/surat" className="btn-ghost btn-sm" title="Kembali ke arsip">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-slate-900 truncate">{letter.subject || letter.templateName}</h1>
            <StatusBadge status={letter.status} />
          </div>
          <p className="text-[11px] text-slate-500 truncate">{letter.letterNumber ?? 'Belum bernomor'}</p>
        </div>
        <button className="btn-secondary btn-sm" onClick={() => void printHtml(letter.contentHtml, fileName)}>
          <Printer className="w-4 h-4" /> Cetak / PDF
        </button>
        <button className="btn-secondary btn-sm" onClick={() => void downloadDocHtml(letter.contentHtml, fileName)}>
          <FileDown className="w-4 h-4" /> .doc
        </button>
        {can('surat.buat') && letter.templateId && (
          <button className="btn-secondary btn-sm" onClick={() => void duplicate()} disabled={busy !== null}>
            {busy === 'dup' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />} Duplikat
          </button>
        )}
        {can('surat.batal') && letter.status === 'terbit' && (
          <button className="btn-danger btn-sm" onClick={() => setCancelOpen(true)}>
            <Ban className="w-4 h-4" /> Batalkan
          </button>
        )}
        {canDelete && (
          <button className="btn-danger btn-sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="w-4 h-4" /> Hapus
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 flex">
        <PaperView html={letter.contentHtml} className="flex-1 min-w-0" />
        <aside className="w-80 shrink-0 bg-white border-l border-slate-200 overflow-y-auto hidden lg:block p-4 space-y-4 text-sm">
          {letter.status === 'batal' && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-900 text-xs">
              <p className="font-semibold">Surat dibatalkan</p>
              <p className="mt-1">{letter.cancelReason}</p>
              <p className="mt-1 text-rose-700">
                oleh {letter.cancelledByName} · {letter.cancelledAt?.slice(0, 16).replace('T', ' ')}
              </p>
            </div>
          )}
          {letter.status === 'draft' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 text-xs flex gap-2">
              <Info className="w-4 h-4 shrink-0" />
              Draft ini hanya bisa dilihat: akun Anda belum diberi izin membuat & mengubah surat.
            </div>
          )}
          <CategoryBadge category={letter.category} />
          <InfoRow icon={Hash} label="Nomor" value={letter.letterNumber ?? '—'} />
          <InfoRow icon={CalendarDays} label="Tanggal surat" value={formatDateId(letter.letterDate)} />
          <InfoRow icon={Info} label="Jenis" value={`${letter.templateName ?? '-'} (v${letter.templateVersion ?? '-'})`} />
          {letter.recipient && <InfoRow icon={Info} label="Tujuan" value={letter.recipient} />}
          {letter.patientSnapshot && (
            <InfoRow icon={UserRound} label="Pasien" value={`${letter.patientSnapshot.fullName} · NIK ${letter.patientSnapshot.nik ?? '-'}`} />
          )}
          {letter.signers.length > 0 && (
            <div>
              <p className="label flex items-center gap-1">
                <PenLine className="w-3.5 h-3.5" /> Penandatangan
              </p>
              <ul className="space-y-1.5">
                {letter.signers.map((s, i) => (
                  <li key={i} className="text-xs">
                    <p className="font-medium text-slate-800">{s.name || '-'}</p>
                    <p className="text-slate-500">{s.role}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="border-t border-slate-200 pt-3 text-xs text-slate-500 space-y-1">
            <p>Dibuat oleh {letter.createdByName} · {letter.createdAt?.slice(0, 16)}</p>
            {letter.issuedAt && (
              <p>
                Diterbitkan oleh {letter.issuedByName} · {letter.issuedAt.slice(0, 16)}
              </p>
            )}
          </div>
        </aside>
      </div>

      <Modal
        open={cancelOpen}
        title="Batalkan surat"
        onClose={() => setCancelOpen(false)}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setCancelOpen(false)}>
              Tutup
            </button>
            <button className="btn bg-rose-600 border-rose-600 text-white hover:bg-rose-700" disabled={!reason.trim() || busy !== null} onClick={() => void cancel()}>
              {busy === 'cancel' && <Loader2 className="w-4 h-4 animate-spin" />} Batalkan surat
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-700 mb-3">
          Nomor <b>{letter.letterNumber}</b> tetap tercatat sebagai batal dan tidak dipakai ulang.
        </p>
        <label className="label">Alasan pembatalan</label>
        <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        <p className="text-xs text-slate-500 mt-2">Setelah dibatalkan, Superadmin dapat menghapus surat ini dari arsip.</p>
      </Modal>

      <ConfirmModal
        open={deleteOpen}
        title="Hapus surat permanen?"
        danger
        busy={busy === 'delete'}
        confirmLabel="Hapus permanen"
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void remove()}
        message={
          <>
            <p>
              Surat <b>{letter.letterNumber}</b> ({letter.subject}) dihapus dari arsip dan tidak bisa dikembalikan.
            </p>
            <p className="text-xs text-slate-500">Nomornya tidak akan dipakai ulang untuk surat lain.</p>
          </>
        }
      />
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div>
      <p className="label flex items-center gap-1">
        <Icon className="w-3.5 h-3.5" /> {label}
      </p>
      <p className="text-slate-800 break-words">{value}</p>
    </div>
  );
}
