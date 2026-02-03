/**
 * Dynamic Open Graph image for social sharing
 */

import { ImageResponse } from 'next/og';

export const alt = 'Anime Village - Watch Anime Online Free';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 48,
        }}
      >
        <div
          style={{
            fontSize: 64,
            fontWeight: 'bold',
            color: 'white',
            marginBottom: 16,
          }}
        >
          Anime Village
        </div>
        <div
          style={{
            fontSize: 28,
            color: '#94a3b8',
            marginBottom: 24,
          }}
        >
          Watch Anime Online Free
        </div>
        <div
          style={{
            fontSize: 20,
            color: '#64748b',
          }}
        >
          One Piece • Naruto • JJK • Demon Slayer • 10000+ anime
        </div>
      </div>
    ),
    { ...size }
  );
}
