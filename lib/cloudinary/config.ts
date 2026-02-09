/**
 * Cloudinary configuration
 * Project-wide media uploads (avatars, future: comment attachments, etc.)
 */

const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

export const CLOUDINARY = {
  cloudName: cloudName ?? '',
  apiKey: apiKey ?? '',
  apiSecret: apiSecret ?? '',
} as const;

export function isCloudinaryConfigured(): boolean {
  return Boolean(cloudName && apiKey && apiSecret);
}

export function getCloudinaryUrl(publicId: string, options?: { width?: number; height?: number; crop?: string }): string {
  if (!cloudName) return '';
  const base = `https://res.cloudinary.com/${cloudName}/image/upload`;
  if (!options?.width && !options?.height) {
    return `${base}/${publicId}`;
  }
  const transforms = [
    options.crop ?? 'fill',
    options.width ? `w_${options.width}` : '',
    options.height ? `h_${options.height}` : '',
  ].filter(Boolean).join(',');
  return `${base}/${transforms}/${publicId}`;
}
