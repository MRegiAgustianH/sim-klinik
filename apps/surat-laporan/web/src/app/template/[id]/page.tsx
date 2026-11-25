'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
import TemplateDesigner, { blankTemplate } from '@/components/TemplateDesigner';
import { apiFetch, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { Template } from '@/lib/types';

export default function TemplateEditPage({ params }: { params: { id: string } }) {
  const { can, isLoading } = useAuth();
  const [template, setTemplate] = useState<Template | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.id === 'baru') {
      setTemplate(blankTemplate());
      return;
    }
    apiFetch<Template>(`/api/template/${params.id}`)
      .then(setTemplate)
      .catch((err) => setError(errorMessage(err)));
  }, [params.id]);

  return (
    <AppShell fullHeight>
      {!isLoading && !can('template.kelola') ? (
        <p className="p-8 text-sm text-slate-600">Akun Anda belum diberi izin mengelola template. Minta Superadmin mengaturnya di portal.</p>
      ) : error ? (
        <p className="p-8 text-sm text-rose-700">{error}</p>
      ) : !template ? (
        <div className="h-full flex items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Memuat template…
        </div>
      ) : (
        <TemplateDesigner initial={template} />
      )}
    </AppShell>
  );
}
