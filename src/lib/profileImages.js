export const PROFILE_IMAGE_BUCKET = "business-profile-images"
export const MAX_PROFILE_IMAGE_BYTES = 10 * 1024 * 1024
export const PROFILE_IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" }

export function validateProfileImage(file) {
  if (!file || file.size === 0) return "Choose a non-empty image file."
  if (file.size > MAX_PROFILE_IMAGE_BYTES) return "Each image must be 10 MB or smaller."
  if (!PROFILE_IMAGE_TYPES[file.type]) return "Choose a JPG, PNG, WebP, or GIF image."
  return null
}
