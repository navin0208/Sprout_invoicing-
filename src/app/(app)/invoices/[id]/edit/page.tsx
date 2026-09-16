'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Topbar } from '@/components/Topbar';
import { DocumentForm, DocumentFormValue } from '@/components/DocumentForm';
import { Skeleton } from '@/components/Skeleton';
import { Icon } from '@/components/Icon';
import { apiFetch } from '@/lib/api';

export default function EditInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const [initial, setInitial] = useState<DocumentFormValue | null>(null);
  const [meta, setMeta] = useState<{ number: string; status: string } | null>(null);

  useEffect(() => {
    apiFetch<any>(`/api/invoices/${id}`).then((inv) => {
      setMeta({ number: inv.number, status: inv.status });
      setInitial({
        clientId: inv.clientId,
        currency: inv.currency,
        issueDate: inv.issueDate.slice(0, 10),
        dueDate: inv.dueDate.slice(0, 10),
        discountType: inv.discountType,
        discountValue: inv.discountValue,
        notes: inv.notes ?? '',
        terms: inv.terms ?? '',
        items: inv.items.map((it: any) => ({
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

  const alreadySent = meta ? meta.status !== 'DRAFT' : false;

  return (
    <>
      <Topbar
        title={meta ? `Edit ${meta.number}` : 'Edit invoice'}
        subtitle="Editable until a payment is recorded against it"
      />
      <main className="p-6 max-w-[1200px] space-y-4">
        {alreadySent ? (
          <div className="card p-4 bg-gold-50 border-gold-200 flex items-start gap-3">
            <Icon name="alert" className="w-4 h-4 text-gold-700 shrink-0 mt-0.5" />
            <p className="text-sm text-brand-700">
              This invoice has already been sent. Your changes go live immediately on the client&apos;s link and PDF — if
              they&apos;ve already seen it, let them know it changed.
            </p>
          </div>
        ) : null}
        {initial ? <DocumentForm kind="invoice" documentId={id} initial={initial} /> : <Skeleton className="h-96 w-full rounded-2xl" />}
      </main>
    </>
  );
}
