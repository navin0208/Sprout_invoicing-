import Link from 'next/link';
import { Icon, IconName } from './Icon';

// A friendly empty state with a sprouting-seed illustration (a nod to the
// brand) instead of a line of grey text, plus the one action that makes
// sense from here.
function SproutIllustration() {
  return (
    <svg viewBox="0 0 120 90" className="w-28 h-20" fill="none" aria-hidden="true">
      <ellipse cx="60" cy="78" rx="34" ry="5" className="fill-gray-100" />
      <circle cx="60" cy="34" r="26" className="fill-gold-100" />
      <path d="M60 72V44" className="stroke-brand-300" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M60 46c0-8-6-14-14-14 0 8 6 14 14 14z"
        className="fill-gold-400 stroke-gold-600"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M60 52c0-7 5-12 12-12 0 7-5 12-12 12z"
        className="fill-gold-500 stroke-gold-600"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  icon
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  icon?: IconName;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon ? (
        <div className="w-14 h-14 rounded-2xl bg-gold-50 border border-gold-200 flex items-center justify-center mb-4">
          <Icon name={icon} className="w-6 h-6 text-gold-600" />
        </div>
      ) : (
        <SproutIllustration />
      )}
      <p className="text-sm font-semibold text-brand-800 mt-2">{title}</p>
      {description ? <p className="text-sm text-gray-500 mt-1 max-w-sm">{description}</p> : null}
      {actionLabel && actionHref ? (
        <Link href={actionHref} className="btn-primary mt-5">
          <Icon name="plus" className="w-4 h-4" />
          {actionLabel}
        </Link>
      ) : actionLabel && onAction ? (
        <button onClick={onAction} className="btn-primary mt-5">
          <Icon name="plus" className="w-4 h-4" />
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
