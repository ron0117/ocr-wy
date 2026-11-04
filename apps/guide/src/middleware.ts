import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const RESERVED = new Set(['write', 'read']);

function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** 中文标题会进 slug。动态路由在生产环境对不上这类地址，先改写到纯英文路径。 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const prefix = '/guides/';
  if (!pathname.startsWith(prefix)) return NextResponse.next();

  const rest = pathname.slice(prefix.length);
  if (!rest || rest.includes('/')) return NextResponse.next();

  const slug = decodeSlug(rest);
  if (RESERVED.has(slug) || ![...slug].some((char) => char.charCodeAt(0) > 127)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = '/guides/read';
  url.searchParams.set('slug', slug);
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/guides/:slug'],
};
