import { env } from 'cloudflare:workers';
import type { Photo } from '@/app/photos';

export const dynamic = 'force-dynamic';

const MAX_PHOTOS = 200;

function photoPath(key: string) {
  return `/api/photo/${key.split('/').map(encodeURIComponent).join('/')}`;
}

export async function POST() {
  if (!env.BUCKET || !env.DB) {
    return Response.json({ error: '云端照片存储暂时不可用' }, { status: 503 });
  }

  try {
    const savedRow = await env.DB.prepare('SELECT photos_json AS photosJson FROM gallery_state WHERE id = ?')
      .bind(1)
      .first<{ photosJson: string }>();
    const saved = savedRow ? JSON.parse(savedRow.photosJson) as unknown : [];
    if (Array.isArray(saved) && saved.some((photo) => (
      typeof photo === 'object' && photo !== null && 'src' in photo &&
      typeof photo.src === 'string' && photo.src.startsWith('/api/photo/')
    ))) {
      return Response.json({ photos: saved as Photo[], recovered: false, source: 'database' });
    }

    const objects: R2Object[] = [];
    let cursor: string | undefined;
    do {
      const page = await env.BUCKET.list({ limit: 1000, cursor });
      objects.push(...page.objects);
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor && objects.length < MAX_PHOTOS);

    const photos: Photo[] = objects
      .sort((left, right) => left.uploaded.getTime() - right.uploaded.getTime())
      .slice(0, MAX_PHOTOS)
      .map((object, index) => ({
        id: `recovered-${object.key}`,
        src: photoPath(object.key),
        title: `珍藏照片 ${String(index + 1).padStart(2, '0')}`,
        story: '',
        note: '',
        date: object.uploaded.toLocaleDateString('zh-CN'),
      }));

    console.log('gallery recovery scan', { objectCount: objects.length, photoCount: photos.length });
    if (!photos.length) return Response.json({ photos: [], recovered: false });

    await env.DB.prepare(`INSERT INTO gallery_state (id, photos_json, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET photos_json = excluded.photos_json, updated_at = excluded.updated_at`)
      .bind(1, JSON.stringify(photos), Date.now()).run();

    return Response.json({ photos, recovered: true });
  } catch (error) {
    console.error('gallery recovery failed', error);
    return Response.json({ error: '恢复云端照片失败' }, { status: 503 });
  }
}
