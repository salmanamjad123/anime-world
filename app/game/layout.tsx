import type { Metadata } from 'next';
import { SITE_NAME } from '@/constants/site';
import './game.css';

export const metadata: Metadata = {
  title: `Game | ${SITE_NAME}`,
  description:
    'Village Arena — original 3v3 fighter duels on Anime Village. Ranked Forge, Quick Duel, and Private Gate.',
};

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return children;
}
