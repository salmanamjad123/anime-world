/**
 * Dynamic Open Graph image for social sharing
 */

import { ImageResponse } from 'next/og';

export const alt = 'Anime Village - Free Anime Streaming';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(145deg, #050506 0%, #1a0a10 45%, #08080a 100%)',
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
            color: '#fb7185',
            marginBottom: 24,
          }}
        >
          Watch Anime Online Free
        </div>
        <div
          style={{
            fontSize: 20,
            color: '#a1a1aa',
          }}
        >
          One Piece • Naruto • JJK • Demon Slayer • 10000+ anime
        </div>
      </div>
    ),
    { ...size }
  );
}
