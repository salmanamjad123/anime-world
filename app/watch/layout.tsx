/**
 * Watch HTML is an anonymous client shell. ISR so Cloudflare can HIT /watch.
 */
export const revalidate = 60;

export default function WatchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
