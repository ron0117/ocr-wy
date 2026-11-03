import { BadRequestException } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

const FILE = '秘偶图鉴.md';

let cached: Set<string> | 'missing' | null = null;

function markdownPath(): string | null {
  const candidates = [
    path.join(process.cwd(), 'apps', 'guide-api', 'data', 'puppets', FILE),
    path.join(process.cwd(), '..', 'guide', 'data', 'puppets', FILE),
    path.join(process.cwd(), 'apps', 'guide', 'data', 'puppets', FILE),
  ];
  for (const file of candidates) {
    if (existsSync(file)) return file;
  }
  return null;
}

function splitRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return [];
  const parts = trimmed.split('|').map((cell) => cell.trim());
  if (parts[0] === '') parts.shift();
  if (parts[parts.length - 1] === '') parts.pop();
  return parts;
}

function isSeparator(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell));
}

/** 只抽取总表「秘偶」列。文件不存在时返回 null。 */
export function loadPuppetAllowlist(): Set<string> | null {
  if (cached === 'missing') return null;
  if (cached) return cached;
  const file = markdownPath();
  if (!file) {
    cached = 'missing';
    return null;
  }
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  let nameIndex = -1;
  const names = new Set<string>();
  for (const line of lines) {
    if (!line.trim().startsWith('|')) {
      if (nameIndex >= 0) break;
      continue;
    }
    const cells = splitRow(line);
    if (isSeparator(cells)) continue;
    if (nameIndex < 0) {
      if (cells.includes('品质') && cells.includes('秘偶')) {
        nameIndex = cells.indexOf('秘偶');
      }
      continue;
    }
    const name = cells[nameIndex]?.trim() ?? '';
    if (name) names.add(name);
  }
  cached = names;
  return names;
}

export function normalizeDeployedPuppets(input: string[] | undefined): string[] {
  const raw = input ?? [];
  if (raw.length > 3) {
    throw new BadRequestException('上阵秘偶最多 3 个');
  }
  const trimmed = raw.map((name) => (typeof name === 'string' ? name.trim() : ''));
  if (trimmed.some((name) => !name)) {
    throw new BadRequestException('上阵秘偶名称不能为空');
  }
  if (trimmed.some((name) => name.length > 40)) {
    throw new BadRequestException('上阵秘偶名称最长 40 字');
  }
  const deduped: string[] = [];
  for (const name of trimmed) {
    if (!deduped.includes(name)) deduped.push(name);
  }
  if (deduped.length === 0) return [];
  const allow = loadPuppetAllowlist();
  if (!allow) {
    throw new BadRequestException('秘偶名册不可用');
  }
  for (const name of deduped) {
    if (!allow.has(name)) {
      throw new BadRequestException(`未知秘偶：${name}`);
    }
  }
  return deduped;
}
