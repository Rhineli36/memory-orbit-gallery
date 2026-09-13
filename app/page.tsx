import Gallery from './gallery';
import { env } from 'cloudflare:workers';
import { getChatGPTUser } from './chatgpt-auth';
import { isGalleryOwner } from './owner';
import { initialPhotos, type Photo } from './photos';

export const dynamic = 'force-dynamic';

async function loadSavedPhotos(): Promise<Photo[]> {
  try {
    if (!env.DB) return initialPhotos;
    const row = await env.DB.prepare('SELECT photos_json AS photosJson FROM gallery_state WHERE id = ?')
      .bind(1)
      .first<{ photosJson: string }>();
    if (!row) return initialPhotos;
    const saved = JSON.parse(row.photosJson) as unknown;
    return Array.isArray(saved) ? saved as Photo[] : initialPhotos;
  } catch (error) {
    console.error('gallery page load failed', error);
    return initialPhotos;
  }
}

export default async function Home() {
  const [user, photos] = await Promise.all([getChatGPTUser(), loadSavedPhotos()]);
  return <Gallery isOwner={isGalleryOwner(user?.email)} initialGallery={photos} />;
}
