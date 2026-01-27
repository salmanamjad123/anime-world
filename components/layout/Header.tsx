/**
 * Header Component
 * Main navigation header
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Heart, History, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/constants/routes';
import { useThemeStore } from '@/store/useThemeStore';
import { cn } from '@/lib/utils';

export function Header() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useThemeStore();

  const navItems = [
    { label: 'Home', href: ROUTES.HOME },
    { label: 'Search', href: ROUTES.SEARCH, icon: Search },
    { label: 'Watchlist', href: ROUTES.WATCHLIST, icon: Heart },
    { label: 'History', href: ROUTES.HISTORY, icon: History },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-800 bg-gray-900/95 backdrop-blur supports-[backdrop-filter]:bg-gray-900/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href={ROUTES.HOME} className="flex items-center space-x-2">
            <div className="text-2xl font-bold">
              <span className="text-blue-500">Anime</span>
              <span className="text-white">World</span>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 text-sm font-medium transition-colors hover:text-blue-400',
                    isActive ? 'text-blue-500' : 'text-gray-300'
                  )}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
