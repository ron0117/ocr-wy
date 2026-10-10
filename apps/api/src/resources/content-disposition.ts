export function contentDisposition(filename: string): string {
  const fallback = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
  return `attachment; filename="${fallback || 'download'}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
