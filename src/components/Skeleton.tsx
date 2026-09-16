// Shimmer placeholders shown while data loads, instead of a bare "Loading…"
// — keeps the layout from jumping once the real rows arrive.

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-shimmer rounded bg-gray-100 ${className}`} />;
}

export function TableSkeleton({ rows = 4, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-5 py-4">
              <Skeleton className={`h-3.5 ${c === 0 ? 'w-28' : c === cols - 1 ? 'w-16' : 'w-20'}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`card p-5 ${className}`}>
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-7 w-32" />
    </div>
  );
}
