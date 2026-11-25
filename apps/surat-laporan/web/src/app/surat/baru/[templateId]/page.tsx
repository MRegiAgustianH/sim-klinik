'use client';

import AppShell from '@/components/AppShell';
import LetterWorkspace from '@/components/LetterWorkspace';

export default function NewLetterPage({ params }: { params: { templateId: string } }) {
  return (
    <AppShell fullHeight>
      <LetterWorkspace templateId={Number(params.templateId)} />
    </AppShell>
  );
}
