/**
 * Subtitle Cache Statistics API
 * Returns information about cached subtitles
 */

import { NextResponse } from 'next/server';
import { getCacheStats, clearOldCache } from '@/lib/utils/subtitle-cache';

export async function GET() {
  try {
    const stats = await getCacheStats();

    // Format the file sizes
    const formatSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    return NextResponse.json({
      success: true,
      cache: {
        totalFiles: stats.totalFiles,
        totalSize: formatSize(stats.totalSize),
        totalSizeBytes: stats.totalSize,
        oldestFile: stats.oldestFile,
        newestFile: stats.newestFile,
      },
      message: `${stats.totalFiles} subtitle files cached, using ${formatSize(stats.totalSize)} of storage`,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * Clear old cache files
 * DELETE /api/cache-stats?days=30
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    const deletedCount = await clearOldCache(days);

    return NextResponse.json({
      success: true,
      message: `Deleted ${deletedCount} old cache files`,
      deletedCount,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
