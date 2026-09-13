import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';

export const dynamic = 'force-dynamic';

const OWNER_USER_ID = '65dcc69f-6c68-4973-aac5-f9f83d44399c';
const MAX_FILE_SIZE = 20 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (user?.userId !== OWNER_USER_ID) return Response.json({ error: '只有相册主人可以上传' }, { status: 403 });
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
    return Response.json({
      photo: {
        id: `upload-${crypto.randomUUID()}`,
        src: `/api/photo/${key}`,
        title: file.name.replace(/\.[^.]+$/, ''),
        story: '',
        note: '刚刚加入这颗影像星球。',
        date: new Date().toLocaleDateString('zh-CN'),
      },
    });
  } catch (error) {
    console.error('photo upload failed', error);
    return Response.json({ error: '上传失败，请稍后重试' }, { status: 503 });
  }
}
