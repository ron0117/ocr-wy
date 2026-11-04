import { readFile } from 'fs/promises';
import path from 'path';
import { mentorArticlesRoot } from '@/lib/mentor-articles';

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await context.params;
  const root = path.resolve(mentorArticlesRoot());
  const filePath = path.resolve(root, ...segments);
  const relative = path.relative(root, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return new Response('Not found', { status: 404 });
  }

  const type = MIME[path.extname(filePath).toLowerCase()];
  if (!type) return new Response('Not found', { status: 404 });

  try {
    const buf = await readFile(filePath);
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
