'use client';

import { useEffect } from 'react';
import { Icon } from './Icon';

export function Modal({
  title,
  description,
  onClose,
  children,
  wide
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  // Escape closes, and the page behind doesn't scroll while it's open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/40 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`card w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto p-6 animate-pop-in shadow-lift`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5 gap-4">
          <div>
            <h2 className="text-base font-semibold text-brand-800">{title}</h2>
            {description ? <p className="text-xs text-gray-500 mt-0.5">{description}</p> : null}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-brand-700 hover:bg-gray-100 rounded-lg p-1 -m-1 transition-colors"
            aria-label="Close"
          >
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
