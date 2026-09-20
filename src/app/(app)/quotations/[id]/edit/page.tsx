'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { QuotationPaperEditor, QuotationEditorInitial } from '@/components/QuotationPaperEditor';
import { Skeleton } from '@/components/Skeleton';
import { apiFetch } from '@/lib/api';

export default function EditQuotationPage() {
  const { id } = useParams<{ id: string }>();
  const [initial, setInitial] = useState<QuotationEditorInitial | null>(null);

  useEffect(() => {
    apiFetch<any>(`/api/quotations/${id}`).then((q) => {
      setInitial({
        number: q.number,
        clientId: q.clientId,
        currency: q.currency,
        issueDate: typeof q.issueDate === 'string' ? q.issueDate.slice(0, 10) : new Date(q.issueDate).toISOString().slice(0, 10),
        dueDate: q.expiryDate
          ? (typeof q.expiryDate === 'string' ? q.expiryDate.slice(0, 10) : new Date(q.expiryDate).toISOString().slice(0, 10))
          : '',
        discountType: q.discountType,
        discountValue: q.discountValue,
        notes: q.notes ?? '',
        terms: q.terms ?? '',
        items: (q.items || []).map((it: any) => ({
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

  if (!initial) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-12 w-48 rounded-xl" />
        <Skeleton className="h-[600px] w-full rounded-2xl" />
      </div>
    );
  }

  return <QuotationPaperEditor documentId={id} initial={initial} />;
}
