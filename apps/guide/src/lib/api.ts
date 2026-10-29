const serverBase =
  process.env.GUIDE_API_URL?.replace(/\/$/, '') ??
  'http://127.0.0.1:3001';

export function apiBase() {
  if (typeof window === 'undefined') {
    return `${serverBase}/api/v1`;
  }
  const pub = process.env.NEXT_PUBLIC_GUIDE_API_URL;
  if (pub) return `${pub.replace(/\/$/, '')}/api/v1`;
  return '/api/v1';
}

export async function guideFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    ...(init?.cache === 'no-store' ? { cache: 'no-store' as const } : { next: { revalidate: 60 } }),
  });
  if (!res.ok) {
    throw new Error(`${path} ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function guidePost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `${path} ${res.status}`;
    try {
      const data = (await res.json()) as { message?: string | string[] };
      const m = data.message;
      if (typeof m === 'string') message = m;
      else if (Array.isArray(m)) message = m.join('；');
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function guideUploadWikiImage(file: File) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${apiBase()}/uploads/wiki-image`, {
    method: 'POST',
    body: fd,
  });
  if (!res.ok) {
    let message = '图片上传失败';
    try {
      const data = (await res.json()) as { message?: string | string[] };
      const m = data.message;
      if (typeof m === 'string') message = m;
      else if (Array.isArray(m)) message = m.join('；');
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json() as Promise<{ url: string; objectKey: string }>;
}
