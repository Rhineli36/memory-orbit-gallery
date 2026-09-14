import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { isGalleryOwner } from '@/app/owner';
import type { Photo } from '@/app/photos';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ key: string }> }) {
  if (!env.BUCKET) return new Response('照片存储暂时不可用', { status: 503 });
  const { key } = await context.params;
  if (!/^[a-zA-Z0-9._-]+$/.test(key)) return new Response('无效的照片地址', { status: 400 });
  const object = await env.BUCKET.get(key);
  if (!object) return new Response('没有找到照片', { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(object.body, { headers });
}

export async function DELETE(_request: Request, context: { params: Promise<{ key: string }> }) {
  const user = await getChatGPTUser();
  if (!isGalleryOwner(user?.email)) return Response.json({ error: '只有相册主人可以删除照片' }, { status: 403 });
  if (!env.BUCKET) return Response.json({ error: '照片存储暂时不可用' }, { status: 503 });

  const { key } = await context.params;
  if (!/^[a-zA-Z0-9._-]+$/.test(key)) return Response.json({ error: '无效的照片地址' }, { status: 400 });
  await env.BUCKET.delete(key);

  if (env.DB) {
    const row = await env.DB.prepare('SELECT photos_json AS photosJson FROM gallery_state WHERE id = ?')
      .bind(1)
      .first<{ photosJson: string }>();
    if (row) {
      const parsed = JSON.parse(row.photosJson) as unknown;
      const current = Array.isArray(parsed) ? parsed as Photo[] : [];
      const src = `/api/photo/${key}`;
      const next = current.filter((photo) => photo.src !== src);
      await env.DB.prepare('UPDATE gallery_state SET photos_json = ?, updated_at = ? WHERE id = ?')
        .bind(JSON.stringify(next), Date.now(), 1)
        .run();
    }
  }

  return Response.json({ deleted: true });
}
