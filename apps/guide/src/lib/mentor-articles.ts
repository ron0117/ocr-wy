import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { MENTORS, type MentorEntry } from './mentors';

function articlesDir(): string {
  const candidates = [
    path.join(process.cwd(), 'src', 'lib', 'mentors-article'),
    path.join(process.cwd(), 'apps', 'guide', 'src', 'lib', 'mentors-article'),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  return candidates[0];
}

function isSafeArticleFile(name: string): boolean {
  return !name.includes('..') && !name.includes('/') && !name.includes('\\') && name.endsWith('.md');
}

export function mentorWithArticle(slug: string): MentorEntry | undefined {
  const mentor = MENTORS.find((item) => item.slug === slug);
  if (!mentor || mentor.isWebsite || !mentor.articleFile || !isSafeArticleFile(mentor.articleFile)) {
    return undefined;
  }
  return mentor;
}

export function loadMentorArticleMarkdown(articleFile: string): string | undefined {
  if (!isSafeArticleFile(articleFile)) return undefined;
  const file = path.join(articlesDir(), articleFile);
  if (!existsSync(file)) return undefined;
  return readFileSync(file, 'utf8');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inline(value: string): string {
  let text = escapeHtml(value.trim());
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
  return text;
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

/** 把导师攻略 Markdown 转成站内文章 HTML。只覆盖现有攻略用到的写法。 */
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
    trimmed.startsWith('|') ||
    trimmed.startsWith('>') ||
    trimmed.startsWith('- ') ||
    /^\d+\.\s+/.test(trimmed)
  );
}
