const MAX_EDGE = 1600;
const MAX_BYTES = 1_200_000;

export async function compressForVision(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const withinEdge = bitmap.width <= MAX_EDGE && bitmap.height <= MAX_EDGE;
    if (withinEdge && file.type === 'image/jpeg' && file.size <= MAX_BYTES) return file;

    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法读取图片');
    context.drawImage(bitmap, 0, 0, width, height);

    let quality = 0.85;
    let blob = await canvasToJpeg(canvas, quality);
    while (blob.size > MAX_BYTES && quality > 0.72) {
      quality = Math.round((quality - 0.06) * 100) / 100;
      blob = await canvasToJpeg(canvas, quality);
    }
    if (file.type === 'image/jpeg' && scale === 1 && blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified });
  } finally {
    bitmap.close();
  }
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('无法压缩图片'));
    }, 'image/jpeg', quality);
  });
}
