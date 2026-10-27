import QRCode from 'qrcode';

const POSTER_WIDTH = 360;
const QR_SIZE = 240;
const PADDING = 24;
const PRIMARY = '#3a8dde';
const FONT =
  '"PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif';

export type ActivitySharePosterInput = {
  url: string;
  title: string;
  startsAt: string;
};

function formatStartsAt(value: string) {
  const text = new Date(value).toLocaleString('zh-CN', { hour12: false });
  return `开始时间：${text}`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapTitle(ctx: CanvasRenderingContext2D, title: string, maxWidth: number) {
  const trimmed = title.trim();
  if (!trimmed) return ['活动报名'];

  ctx.font = `700 18px ${FONT}`;
  const lines: string[] = [];
  let line = '';
  for (const char of trimmed) {
    const next = line + char;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = char;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function drawCenterLogo(ctx: CanvasRenderingContext2D, qrTop: number) {
  const logoSize = Math.round(QR_SIZE * 0.22);
  const pad = Math.round(logoSize * 0.14);
  const outer = logoSize + pad * 2;
  const centerX = POSTER_WIDTH / 2;
  const centerY = qrTop + QR_SIZE / 2;
  const radius = Math.round(logoSize * 0.22);

  roundRect(ctx, centerX - outer / 2, centerY - outer / 2, outer, outer, radius + 3);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  roundRect(
    ctx,
    centerX - logoSize / 2,
    centerY - logoSize / 2,
    logoSize,
    logoSize,
    radius,
  );
  ctx.fillStyle = PRIMARY;
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.max(11, Math.round(logoSize * 0.34))}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('无忧', centerX, centerY + 0.5);
}

/** 生成含标题、开始时间与居中品牌图标的报名分享图（PNG Data URL） */
export async function buildActivitySharePoster(input: ActivitySharePosterInput): Promise<string> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前环境不支持 Canvas');

  const maxTextWidth = POSTER_WIDTH - PADDING * 2;
  const titleLines = wrapTitle(ctx, input.title, maxTextWidth);
  const titleBlockHeight = titleLines.length * 26 + 8 + 20;
  const height = PADDING + titleBlockHeight + 16 + QR_SIZE + 52 + PADDING;

  canvas.width = POSTER_WIDTH;
  canvas.height = height;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#dce8f3';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);

  let y = PADDING;
  ctx.fillStyle = '#1d4f7a';
  ctx.font = `700 18px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (const line of titleLines) {
    ctx.fillText(line, POSTER_WIDTH / 2, y + 18);
    y += 26;
  }

  y += 8;
  ctx.fillStyle = '#5d7f99';
  ctx.font = `14px ${FONT}`;
  ctx.fillText(formatStartsAt(input.startsAt), POSTER_WIDTH / 2, y + 14);
  y += 20 + 16;

  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, input.url, {
    width: QR_SIZE,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: '#1a2332', light: '#ffffff' },
  });

  const qrX = (POSTER_WIDTH - QR_SIZE) / 2;
  ctx.drawImage(qrCanvas, qrX, y, QR_SIZE, QR_SIZE);
  drawCenterLogo(ctx, y);

  ctx.fillStyle = '#606266';
  ctx.font = `13px ${FONT}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('微信扫一扫 · 活动报名', POSTER_WIDTH / 2, y + QR_SIZE + 22);

  ctx.fillStyle = '#909399';
  ctx.font = `12px ${FONT}`;
  ctx.fillText('无忧俱乐部', POSTER_WIDTH / 2, y + QR_SIZE + 44);

  return canvas.toDataURL('image/png');
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}
