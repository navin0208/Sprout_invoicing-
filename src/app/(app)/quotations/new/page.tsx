'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { QuotationPaperEditor } from '@/components/QuotationPaperEditor';

function NewQuotationInner() {
  const params = useSearchParams();
  return <QuotationPaperEditor defaultClientId={params.get('clientId') ?? undefined} />;
}

export default function NewQuotationPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-gray-400">Loading paper canvas…</div>}>
      <NewQuotationInner />
    </Suspense>
  );
}
