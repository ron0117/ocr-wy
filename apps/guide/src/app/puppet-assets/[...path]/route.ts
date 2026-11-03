import { readFile } from 'fs/promises';
import path from 'path';
import { puppetsCatalogRoot } from '@/lib/puppets-path';

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await context.params;
  const root = path.resolve(puppetsCatalogRoot());
  const filePath = path.resolve(root, ...segments);
  const relative = path.relative(root, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const buf = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] ?? 'application/octet-stream';
    return new Response(buf, {
      headers: {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
