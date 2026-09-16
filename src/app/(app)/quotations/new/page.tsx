'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Topbar } from '@/components/Topbar';
import { DocumentForm } from '@/components/DocumentForm';

function NewQuotationInner() {
  const params = useSearchParams();
  return <DocumentForm kind="quotation" defaultClientId={params.get('clientId') ?? undefined} />;
}

export default function NewQuotationPage() {
  return (
    <>
      <Topbar title="New quotation" subtitle="Clients can accept or decline it straight from the link you share" />
      <main className="p-6 max-w-[1200px]">
        <Suspense>
          <NewQuotationInner />
        </Suspense>
      </main>
    </>
  );
}
