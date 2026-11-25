'use client';

import AppShell from '@/components/AppShell';
import LetterWorkspace from '@/components/LetterWorkspace';

export default function LetterPage({ params }: { params: { id: string } }) {
  return (
    <AppShell fullHeight>
      <LetterWorkspace letterId={Number(params.id)} />
    </AppShell>
  );
}
