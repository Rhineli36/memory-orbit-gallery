import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import type { Photo } from '@/app/photos';

export const dynamic = 'force-dynamic';

const OWNER_USER_ID = '65dcc69f-6c68-4973-aac5-f9f83d44399c';
const MAX_PHOTOS = 200;

function database(): D1Database {
  if (!env.DB) throw new Error('照片数据库暂时不可用');
  return env.DB;
}

async function ownerOnly() {
  const user = await getChatGPTUser();
  return user?.userId === OWNER_USER_ID;
}

function validPhoto(value: unknown): value is Photo {
  if (!value || typeof value !== 'object') return false;
  const photo = value as Record<string, unknown>;
  return ['id', 'src', 'title', 'note', 'story', 'date'].every((key) => typeof photo[key] === 'string')
    && (photo.src as string).startsWith('/')
    && (photo.id as string).length <= 120
    && (photo.src as string).length <= 500
    && (photo.title as string).length <= 200
    && (photo.note as string).length <= 4000
    && (photo.story as string).length <= 4000
    && (photo.date as string).length <= 200;
}

export async function GET() {
  try {
    const row = await database().prepare('SELECT photos_json AS photosJson, updated_at AS updatedAt FROM gallery_state WHERE id = ?').bind(1).first<{ photosJson: string; updatedAt: number }>();
    if (!row) return Response.json({ initialized: false, photos: [] });
    return Response.json({ initialized: true, photos: JSON.parse(row.photosJson), updatedAt: row.updatedAt });
  } catch (error) {
    console.error('gallery load failed', error);
    return Response.json({ error: '相册暂时无法读取' }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  if (!(await ownerOnly())) return Response.json({ error: '只有相册主人可以修改' }, { status: 403 });
  try {
    const body = await request.json() as { photos?: unknown };
    if (!Array.isArray(body.photos) || body.photos.length > MAX_PHOTOS || !body.photos.every(validPhoto)) {
      return Response.json({ error: '相册数据格式不正确' }, { status: 400 });
    }

    const db = database();
    const previous = await db.prepare('SELECT photos_json AS photosJson FROM gallery_state WHERE id = ?').bind(1).first<{ photosJson: string }>();
    const now = Date.now();
    await db.prepare(`INSERT INTO gallery_state (id, photos_json, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET photos_json = excluded.photos_json, updated_at = excluded.updated_at`)
      .bind(1, JSON.stringify(body.photos), now).run();

    if (env.BUCKET && previous) {
      const oldPhotos = JSON.parse(previous.photosJson) as Photo[];
      const retained = new Set(body.photos.map((photo) => (photo as Photo).src));
      const removedKeys = oldPhotos
        .map((photo) => photo.src.match(/^\/api\/photo\/([a-zA-Z0-9._-]+)$/)?.[1])
        .filter((key): key is string => Boolean(key) && !retained.has(`/api/photo/${key}`));
      await Promise.all(removedKeys.map((key) => env.BUCKET!.delete(key)));
    }

    return Response.json({ saved: true, updatedAt: now });
  } catch (error) {
    console.error('gallery save failed', error);
    return Response.json({ error: '保存失败，请稍后重试' }, { status: 503 });
  }
}
