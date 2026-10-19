import { Suspense } from 'react';
import { WatchPage } from './WatchClient';

/** Anonymous player shell — cacheable HTML so Cloudflare can HIT /watch. */
export const revalidate = 60;

export default function WatchRoutePage() {
  return (
    <Suspense>
      <WatchPage />
    </Suspense>
  );
}
