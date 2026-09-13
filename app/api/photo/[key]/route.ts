import { env } from 'cloudflare:workers';

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
