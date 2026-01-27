/**
 * Health Check Endpoint
 * Use this to monitor if your app is running correctly
 * URL: /api/health
 */

import { NextResponse } from 'next/server';
import { isHiAnimeAvailable } from '@/lib/api/hianime';

export async function GET() {
  const startTime = Date.now();
  
  try {
    // Check HiAnime API availability
    const hiAnimeUp = await Promise.race([
      isHiAnimeAvailable(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
      )
    ]).catch(() => false);

    const responseTime = Date.now() - startTime;

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: `${responseTime}ms`,
      services: {
        hiAnime: hiAnimeUp ? 'up' : 'down',
        proxy: 'up', // If this endpoint responds, proxy is working
      },
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };

    return NextResponse.json(health, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
