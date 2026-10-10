import sharp from 'sharp';

const SIGNATURES = [
  { mime: 'image/png', ext: 'png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/jpeg', ext: 'jpg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/webp', ext: 'webp', bytes: [0x52, 0x49, 0x46, 0x46] },
] as const;

export interface DetectedImage {
  mime: 'image/png' | 'image/jpeg' | 'image/webp';
  ext: 'png' | 'jpg' | 'webp';
}

function matches(buffer: Buffer, bytes: readonly number[]): boolean {
  if (buffer.length < bytes.length) return false;
  return bytes.every((byte, index) => buffer[index] === byte);
}

export async function detectImageType(buffer: Buffer): Promise<DetectedImage | null> {
  const signature = SIGNATURES.find((item) => matches(buffer, item.bytes));
  if (!signature) return null;
  if (signature.ext === 'webp') {
    const webp = buffer.subarray(8, 12).toString('ascii');
    if (webp !== 'WEBP') return null;
  }

  try {
    const pipeline = sharp(buffer, {
      limitInputPixels: 40_000_000,
      failOn: 'error',
    });
    const meta = await pipeline.metadata();
    if (!meta.width || !meta.height || !meta.format) return null;
    if (meta.width * meta.height > 40_000_000) return null;
    await pipeline.stats();

    if (signature.ext === 'png' && meta.format !== 'png') return null;
    if (signature.ext === 'jpg' && meta.format !== 'jpeg') return null;
    if (signature.ext === 'webp' && meta.format !== 'webp') return null;
    return { mime: signature.mime, ext: signature.ext };
  } catch {
    return null;
  }
}

export function sanitizeFilename(name: string): string {
  const base = name.replace(/\\/g, '/').split('/').pop() ?? 'image';
  const decoded = decodeFilename(base);
  const cleaned = decoded
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>:"|?*]/g, '_')
    .trim();
  return (cleaned || 'image').slice(0, 120);
}

function decodeFilename(name: string): string {
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  if (decoded.includes('\uFFFD')) return name;
  return decoded;
}
