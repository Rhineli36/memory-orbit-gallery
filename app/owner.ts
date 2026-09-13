const OWNER_EMAIL = 'rhineli362@gmail.com';

export function isGalleryOwner(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === OWNER_EMAIL;
}
