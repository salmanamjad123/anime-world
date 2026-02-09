/**
 * Cloudinary folder structure - project-wide
 * Centralized so avatars, comments, replies, etc. use consistent paths
 */

const PROJECT_PREFIX = 'anime-world';

/**
 * Folder paths for different media types
 * Use these when uploading to keep structure clean and scalable
 */
export const CLOUDINARY_FOLDERS = {
  /** User profile avatars - used in profile, comments, replies, header */
  avatars: (userId: string) => `${PROJECT_PREFIX}/avatars/${userId}`,

  /** Future: comment attachments or reply images */
  comments: (userId: string) => `${PROJECT_PREFIX}/comments/${userId}`,

  /** Future: any other user-generated content */
  userContent: (userId: string, subfolder: string) => `${PROJECT_PREFIX}/user-content/${userId}/${subfolder}`,
} as const;
