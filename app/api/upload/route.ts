import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { isGalleryOwner } from '@/app/owner';
import type { Photo } from '@/app/photos';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!isGalleryOwner(user?.email)) return Response.json({ error: '只有相册主人可以上传' }, { status: 403 });
  if (!env.BUCKET) return Response.json({ error: '照片存储暂时不可用' }, { status: 503 });

  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File) || !file.type.startsWith('image/') || file.size === 0 || file.size > MAX_FILE_SIZE) {
      return Response.json({ error: '请选择不超过 20MB 的图片' }, { status: 400 });
    }
    const extension = file.name.match(/\.([a-zA-Z0-9]{1,8})$/)?.[1]?.toLowerCase() ?? 'image';
    const key = `${crypto.randomUUID()}.${extension}`;
    await env.BUCKET.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
    const photo: Photo = {
        id: `upload-${crypto.randomUUID()}`,
        src: `/api/photo/${key}`,
        title: file.name.replace(/\.[^.]+$/, ''),
        story: '',
        note: '刚刚加入这颗影像星球。',
        date: new Date().toLocaleDateString('zh-CN'),
    };

    if (env.DB) {
      const row = await env.DB.prepare('SELECT photos_json AS photosJson FROM gallery_state WHERE id = ?')
        .bind(1)
        .first<{ photosJson: string }>();
      const parsed = row ? JSON.parse(row.photosJson) as unknown : [];
      const current = Array.isArray(parsed) ? parsed as Photo[] : [];
      const retained = current.some((item) => item.src.startsWith('/api/photo/')) ? current : [];
      const next = [...retained, photo].slice(0, 200);
      const now = Date.now();
      await env.DB.prepare(`INSERT INTO gallery_state (id, photos_json, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET photos_json = excluded.photos_json, updated_at = excluded.updated_at`)
        .bind(1, JSON.stringify(next), now).run();
    }

    return Response.json({ photo, saved: Boolean(env.DB) });
  } catch (error) {
    console.error('photo upload failed', error);
    return Response.json({ error: '上传失败，请稍后重试' }, { status: 503 });
  }
}
