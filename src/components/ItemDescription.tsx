import { splitDescription } from '@/lib/pdf/text';

// Renders a line item's description as a bold title plus bullet lines when
// it's multi-line (e.g. a service with a few included-items listed
// underneath) — mirrors how it's rendered in the PDF.
export function ItemDescription({ description }: { description: string }) {
  const { title, bullets } = splitDescription(description);
  return (
    <div>
      <p className="font-medium text-gray-900">{title}</p>
      {bullets.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {bullets.map((b, i) => (
            <li key={i} className="text-xs text-gray-500 flex gap-1.5">
              <span>•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
