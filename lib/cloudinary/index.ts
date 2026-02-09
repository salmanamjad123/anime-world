/**
 * Cloudinary - project-wide media
 * Avatars, comments, replies, user content
 */

export { CLOUDINARY, isCloudinaryConfigured, getCloudinaryUrl } from './config';
export { CLOUDINARY_FOLDERS } from './folders';
export { uploadAvatar, deleteAvatar, extractPublicIdFromCloudinaryUrl, type UploadAvatarResult } from './upload';
