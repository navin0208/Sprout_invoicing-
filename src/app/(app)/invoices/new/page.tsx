'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Topbar } from '@/components/Topbar';
import { DocumentForm } from '@/components/DocumentForm';

function NewInvoiceInner() {
  const params = useSearchParams();
  return <DocumentForm kind="invoice" defaultClientId={params.get('clientId') ?? undefined} />;
}

export default function NewInvoicePage() {
  return (
    <>
      <Topbar title="New invoice" subtitle="It saves as a draft — nothing is sent until you say so" />
      <main className="p-6 max-w-[1200px]">
        <Suspense>
          <NewInvoiceInner />
        </Suspense>
      </main>
    </>
  );
}
