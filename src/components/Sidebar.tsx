'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DEFAULT_LOGO_PATH } from '@/lib/brand';
import { Icon, IconName } from './Icon';

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/invoices', label: 'Invoices', icon: 'invoice' },
  { href: '/quotations', label: 'Quotations', icon: 'quotation' },
  { href: '/clients', label: 'Clients', icon: 'clients' },
  { href: '/items', label: 'Items', icon: 'items' }
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <aside className="w-60 shrink-0 border-r border-gray-200/80 bg-white min-h-screen flex flex-col sticky top-0 h-screen">
      <div className="px-5 pt-6 pb-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={DEFAULT_LOGO_PATH} alt="The Sprout Media" className="w-32 h-auto object-contain" />
      </div>

      <div className="px-3 pb-4">
        <Link href="/invoices/new" className="btn-primary w-full">
          <Icon name="plus" className="w-4 h-4" />
          New invoice
        </Link>
      </div>

      <nav className="flex-1 px-3 space-y-0.5">
        {NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${
                active
                  ? 'bg-brand-800 text-white font-semibold shadow-sm'
                  : 'text-gray-600 font-medium hover:bg-gray-100 hover:text-brand-800'
              }`}
            >
              <Icon
                name={item.icon}
                className={`w-4 h-4 transition-colors ${active ? 'text-gold-400' : 'text-gray-400 group-hover:text-gold-600'}`}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-gray-100">
        <Link
          href="/settings"
          className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${
            isActive('/settings')
              ? 'bg-brand-800 text-white font-semibold shadow-sm'
              : 'text-gray-600 font-medium hover:bg-gray-100 hover:text-brand-800'
          }`}
        >
          <Icon
            name="settings"
            className={`w-4 h-4 ${isActive('/settings') ? 'text-gold-400' : 'text-gray-400 group-hover:text-gold-600'}`}
          />
          Settings
        </Link>
      </div>
    </aside>
  );
}
