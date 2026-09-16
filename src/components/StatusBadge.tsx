const STYLES: Record<string, { cls: string; dot: string }> = {
  DRAFT: { cls: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
  SENT: { cls: 'bg-brand-100 text-brand-700', dot: 'bg-brand-400' },
  VIEWED: { cls: 'bg-brand-100 text-brand-700', dot: 'bg-brand-500' },
  PARTIALLY_PAID: { cls: 'bg-gold-100 text-gold-800', dot: 'bg-gold-500' },
  PAID: { cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  OVERDUE: { cls: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
  CANCELLED: { cls: 'bg-gray-100 text-gray-400 line-through', dot: 'bg-gray-300' },
  ACCEPTED: { cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  REJECTED: { cls: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
  EXPIRED: { cls: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
  CONVERTED: { cls: 'bg-brand-100 text-brand-700', dot: 'bg-brand-500' }
};

export function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status] ?? STYLES.DRAFT;
  return (
    <span className={`badge ${style.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {status.replace('_', ' ')}
    </span>
  );
}
