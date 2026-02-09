/**
 * Cloudinary upload helpers
 * Server-side only - use in API routes
 */

import { v2 as cloudinary } from 'cloudinary';
import { CLOUDINARY, isCloudinaryConfigured } from './config';
import { CLOUDINARY_FOLDERS } from './folders';

cloudinary.config({
  cloud_name: CLOUDINARY.cloudName,
  api_key: CLOUDINARY.apiKey,
  api_secret: CLOUDINARY.apiSecret,
});

export interface UploadAvatarResult {
  url: string;
  publicId: string;
  secureUrl: string;
}

/**
 * Upload avatar image to Cloudinary
 * Path: anime-world/avatars/{userId}
 * Used for profile, comments, replies, header - single source of truth
 */
export async function uploadAvatar(userId: string, fileBuffer: Buffer, mimeType: string): Promise<UploadAvatarResult> {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary is not configured');
  }

  const folder = CLOUDINARY_FOLDERS.avatars(userId);
  const dataUri = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: 'image',
    overwrite: true,
    transformation: [
      { width: 400, height: 400, crop: 'fill', gravity: 'face' },
    ],
  });

  return {
    url: result.secure_url,
    secureUrl: result.secure_url,
    publicId: result.public_id,
  };
}

/**
 * Extract Cloudinary public_id from a Cloudinary URL
 * Returns null if URL is not from our Cloudinary or format is invalid
 */
export function extractPublicIdFromCloudinaryUrl(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const cloudName = CLOUDINARY.cloudName;
  if (!cloudName) return null;
  const prefix = `https://res.cloudinary.com/${cloudName}/`;
  if (!url.startsWith(prefix)) return null;
  const afterUpload = url.split('/image/upload/')[1];
  if (!afterUpload) return null;
  const withoutVersion = afterUpload.replace(/^v\d+\//, '');
  return withoutVersion.replace(/\.[^.]+$/, '') || null;
}

/**
 * Delete avatar by public ID (e.g. when user removes profile photo)
 */
export async function deleteAvatar(publicId: string): Promise<void> {
  if (!isCloudinaryConfigured()) return;
  await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
}
