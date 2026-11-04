function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inline(value: string): string {
  let text = escapeHtml(value.trim());
  text = text.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  return text;
}

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

function imageExtension(src: string): string {
  const pathOnly = src.split(/[?#]/)[0] ?? '';
  const dot = pathOnly.lastIndexOf('.');
  if (dot < 0) return '';
  return pathOnly.slice(dot).toLowerCase();
}

/** 相对路径走导师配图；http(s) 图片地址用于攻略库上传到 COS 的插图。 */
function imageSrc(raw: string): string | undefined {
  const src = raw.trim();
  if (!src || src.includes('..') || src.includes('\\') || !IMAGE_EXT.has(imageExtension(src))) {
    return undefined;
  }
  if (/^https?:\/\//i.test(src)) return src;
  if (src.includes('//') || /^[a-z]+:/i.test(src)) return undefined;
  const segments = src.split('/').filter(Boolean);
  if (!segments.length) return undefined;
  return `/mentor-assets/${segments.map((segment) => encodeURIComponent(segment)).join('/')}`;
}

function imageMarkup(alt: string, rawSrc: string): string | undefined {
  const src = imageSrc(rawSrc);
  if (!src) return undefined;
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" />`;
}

function splitTableRow(line: string): string[] {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|')) row = row.slice(0, -1);
  return row.split('|').map((cell) => cell.trim());
}

function isAlignRow(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell));
}

function renderTable(lines: string[]): string {
  const rows = lines.filter((line) => !isAlignRow(line));
  if (!rows.length) return '';
  const head = splitTableRow(rows[0]);
  const body = rows.slice(1);
  const thead = `<thead><tr>${head.map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr></thead>`;
  const tbody = body
    .map((line) => `<tr>${splitTableRow(line).map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`)
    .join('');
  return `<div class="article-table-wrap"><table>${thead}<tbody>${tbody}</tbody></table></div>`;
}

/** 把攻略 Markdown 转成站内文章 HTML。只覆盖现有攻略用到的写法。 */
export function renderMentorMarkdown(markdown: string): string {
  const lines = markdown.replace(/^\uFEFF/, '').split(/\r?\n/);
  const blocks: string[] = [];
  let i = 0;

  const collectWhile = (test: (line: string) => boolean): string[] => {
    const chunk: string[] = [];
    while (i < lines.length && test(lines[i])) {
      chunk.push(lines[i]);
      i += 1;
    }
    return chunk;
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed.startsWith('```')) {
      i += 1;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      blocks.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    if (trimmed === '---' || trimmed === '***') {
      blocks.push('<hr />');
      i += 1;
      continue;
    }

    if (trimmed.startsWith('|')) {
      const tableLines = collectWhile((row) => row.trim().startsWith('|'));
      blocks.push(renderTable(tableLines));
      continue;
    }

    if (trimmed.startsWith('>')) {
      const quoteLines = collectWhile((row) => row.trim().startsWith('>'));
      const inner = quoteLines
        .map((row) => inline(row.trim().replace(/^>\s?/, '')))
        .filter(Boolean)
        .map((row) => `<p>${row}</p>`)
        .join('');
      blocks.push(`<blockquote>${inner}</blockquote>`);
      continue;
    }

    if (trimmed.startsWith('- ')) {
      const items = collectWhile((row) => row.trim().startsWith('- '));
      blocks.push(`<ul>${items.map((item) => `<li>${inline(item.trim().slice(2))}</li>`).join('')}</ul>`);
      continue;
    }

    const image = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      const markup = imageMarkup(image[1], image[2]);
      if (markup) blocks.push(markup);
      i += 1;
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items = collectWhile((row) => /^\d+\.\s+/.test(row.trim()));
      blocks.push(
        `<ol>${items
          .map((item) => `<li>${inline(item.trim().replace(/^\d+\.\s+/, ''))}</li>`)
          .join('')}</ol>`,
      );
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    if (paragraph.length) {
      blocks.push(`<p>${inline(paragraph.join(' '))}</p>`);
    }
  }

  return blocks.join('\n');
}

function isBlockStart(line: string): boolean {
  const trimmed = line.trim();
  return (
    /^(#{1,3})\s+/.test(trimmed) ||
    trimmed === '---' ||
    trimmed === '***' ||
    trimmed.startsWith('```') ||
    trimmed.startsWith('|') ||
    trimmed.startsWith('>') ||
    trimmed.startsWith('- ') ||
    /^!\[([^\]]*)\]\(([^)]+)\)$/.test(trimmed) ||
    /^\d+\.\s+/.test(trimmed)
  );
}
