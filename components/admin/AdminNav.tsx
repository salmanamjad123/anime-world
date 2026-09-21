'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils';

const LINKS: { href: string; label: string; exact?: boolean }[] = [
  { href: ROUTES.ADMIN, label: 'Overview', exact: true },
  { href: ROUTES.ADMIN_USERS, label: 'Users' },
  { href: ROUTES.ADMIN_AUDITS, label: 'Audits' },
  { href: ROUTES.ADMIN_EMAIL, label: 'Email' },
  { href: ROUTES.ADMIN_GAME_DEMO, label: 'Game demo' },
  { href: ROUTES.ADMIN_ADS, label: 'Ads' },
];

export function AdminNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        'flex flex-wrap gap-1 border-b border-gray-800 pb-px',
        className
      )}
      aria-label="Admin"
    >
      {LINKS.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm transition-colors',
              active
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
