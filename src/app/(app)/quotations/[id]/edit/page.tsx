'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Topbar } from '@/components/Topbar';
import { DocumentForm, DocumentFormValue } from '@/components/DocumentForm';
import { Skeleton } from '@/components/Skeleton';
import { apiFetch } from '@/lib/api';

export default function EditQuotationPage() {
  const { id } = useParams<{ id: string }>();
  const [initial, setInitial] = useState<DocumentFormValue | null>(null);

  useEffect(() => {
    apiFetch<any>(`/api/quotations/${id}`).then((q) => {
      setInitial({
        clientId: q.clientId,
        currency: q.currency,
        issueDate: q.issueDate.slice(0, 10),
        dueDate: q.expiryDate ? q.expiryDate.slice(0, 10) : '',
        discountType: q.discountType,
        discountValue: q.discountValue,
        notes: q.notes ?? '',
        terms: q.terms ?? '',
        items: q.items.map((it: any) => ({
          itemId: it.itemId,
          description: it.description,
          quantity: it.quantity,
          unit: it.unit,
          rate: it.rateCents / 100,
          taxPercent: it.taxPercent
        }))
      });
    });
  }, [id]);

  return (
    <>
      <Topbar title="Edit quotation" subtitle="Only drafts can be edited" />
      <main className="p-6 max-w-[1200px]">
        {initial ? (
          <DocumentForm kind="quotation" documentId={id} initial={initial} />
        ) : (
          <Skeleton className="h-96 w-full rounded-2xl" />
        )}
      </main>
    </>
  );
}
