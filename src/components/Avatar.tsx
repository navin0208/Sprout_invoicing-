// Initials chip for a client, with a colour picked deterministically from the
// name so the same client always looks the same — makes long lists much
// faster to scan than plain text rows.
const PALETTE = [
  'bg-gold-100 text-gold-800',
  'bg-emerald-50 text-emerald-700',
  'bg-sky-50 text-sky-700',
  'bg-violet-50 text-violet-700',
  'bg-rose-50 text-rose-700',
  'bg-amber-50 text-amber-700'
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hueFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const sizing = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-xs';
  return (
    <span
      className={`inline-flex items-center justify-center rounded-lg font-bold shrink-0 ${sizing} ${hueFor(name)}`}
      title={name}
    >
      {initials(name)}
    </span>
  );
}
