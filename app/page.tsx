import Gallery from './gallery';
import { env } from 'cloudflare:workers';
import { getChatGPTUser } from './chatgpt-auth';
import { isGalleryOwner } from './owner';
import { initialPhotos, type Photo } from './photos';

export const dynamic = 'force-dynamic';

const MAX_PHOTOS = 200;

function containsUploadedPhotos(photos: Photo[]) {
  return photos.some((photo) => photo.src.startsWith('/api/photo/'));
}

async function recoverUploadedPhotos(): Promise<Photo[]> {
  if (!env.BUCKET) return [];

  const objects: R2Object[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.BUCKET.list({ limit: 1000, cursor });
    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor && objects.length < MAX_PHOTOS);

  return objects
    .sort((left, right) => left.uploaded.getTime() - right.uploaded.getTime())
    .slice(0, MAX_PHOTOS)
    .map((object, index) => ({
      id: `recovered-${object.key}`,
      src: `/api/photo/${object.key}`,
      title: `珍藏照片 ${String(index + 1).padStart(2, '0')}`,
      story: '',
      note: '',
      date: object.uploaded.toLocaleDateString('zh-CN'),
    }));
}

async function loadSavedPhotos(): Promise<Photo[]> {
  try {
    if (!env.DB) return initialPhotos;
    const row = await env.DB.prepare('SELECT photos_json AS photosJson FROM gallery_state WHERE id = ?')
      .bind(1)
      .first<{ photosJson: string }>();
    const saved = row ? JSON.parse(row.photosJson) as unknown : null;
    const photos = Array.isArray(saved) ? saved as Photo[] : initialPhotos;
    if (containsUploadedPhotos(photos)) return photos;

    const recovered = await recoverUploadedPhotos();
    if (!recovered.length) return photos;

    const now = Date.now();
    await env.DB.prepare(`INSERT INTO gallery_state (id, photos_json, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET photos_json = excluded.photos_json, updated_at = excluded.updated_at`)
      .bind(1, JSON.stringify(recovered), now).run();
    return recovered;
  } catch (error) {
    console.error('gallery page load failed', error);
    return initialPhotos;
  }
}

export default async function Home() {
  const [user, photos] = await Promise.all([getChatGPTUser(), loadSavedPhotos()]);
  return <Gallery isOwner={isGalleryOwner(user?.email)} initialGallery={photos} />;
}
