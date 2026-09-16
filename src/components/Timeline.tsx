import { formatDate } from '@/lib/money';
import { Icon, IconName } from './Icon';

export type TimelineStep = {
  label: string;
  date?: Date | string | null;
  done: boolean;
  /** the step the document is sitting on right now */
  current?: boolean;
  tone?: 'default' | 'good' | 'bad';
  icon: IconName;
};

// Horizontal progress rail — turns a status word into "where is this in its
// life, and when did each step happen", which is the question you actually
// have when you open an invoice.
export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="flex items-start">
      {steps.map((step, i) => {
        const tone =
          step.tone === 'bad'
            ? { dot: 'bg-red-500 text-white', ring: 'ring-red-100', text: 'text-red-700' }
            : step.tone === 'good'
              ? { dot: 'bg-sprout-500 text-white', ring: 'ring-sprout-50', text: 'text-sprout-600' }
              : { dot: 'bg-brand-800 text-gold-400', ring: 'ring-brand-100', text: 'text-brand-800' };

        return (
          <li key={step.label} className="flex-1 flex flex-col items-center text-center relative">
            {i > 0 ? (
              <span
                className={`absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 ${
                  step.done ? 'bg-brand-200' : 'bg-gray-100'
                }`}
                aria-hidden="true"
              />
            ) : null}
            <span
              className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                step.done ? `${tone.dot} ${step.current ? `ring-4 ${tone.ring}` : ''}` : 'bg-white border-2 border-gray-200 text-gray-300'
              }`}
            >
              <Icon name={step.done ? step.icon : step.icon} className="w-3.5 h-3.5" strokeWidth={2} />
            </span>
            <span className={`mt-2 text-xs font-medium ${step.done ? tone.text : 'text-gray-400'}`}>{step.label}</span>
            <span className="text-[11px] text-gray-400 h-4">{step.date ? formatDate(step.date) : ''}</span>
          </li>
        );
      })}
    </ol>
  );
}
