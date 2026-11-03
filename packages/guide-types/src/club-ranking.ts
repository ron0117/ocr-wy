export interface ClubRankingRow {
  rank: number;
  name: string;
  server: string;
  leader: string;
  memberCount: number;
  score: number;
}

export interface ClubRankingDto {
  clubs: ClubRankingRow[];
}

export type ClubRankingNormalizeResult =
  | { ok: true; clubs: ClubRankingRow[] }
  | { ok: false; message: string };

const MIN_COUNT = 1;
const MAX_COUNT = 200;
const MAX_TEXT = 64;
const MAX_INT = 2_000_000_000;

function fail(message: string): ClubRankingNormalizeResult {
  return { ok: false, message };
}

function isIntInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function readText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_TEXT) return null;
  return trimmed;
}

/** 校验并规范化 clubs。失败时返回原因，不抛异常。 */
export function normalizeClubRankingClubs(input: unknown): ClubRankingNormalizeResult {
  if (!Array.isArray(input)) return fail('clubs 必须是数组');
  if (input.length < MIN_COUNT) return fail('clubs 不能为空');
  if (input.length > MAX_COUNT) return fail('clubs 最多 200 条');

  const clubs: ClubRankingRow[] = [];
  const seen = new Set<number>();

  for (let index = 0; index < input.length; index += 1) {
    const row = input[index];
    const label = `第 ${index + 1} 条`;
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      return fail(`${label}格式不正确`);
    }
    const source = row as Record<string, unknown>;
    if (!isIntInRange(source.rank, 1, MAX_INT)) return fail(`${label}的排名无效`);
    if (seen.has(source.rank)) return fail(`排名 ${source.rank} 重复`);
    const name = readText(source.name);
    const server = readText(source.server);
    const leader = readText(source.leader);
    if (!name) return fail(`${label}的俱乐部名称无效`);
    if (!server) return fail(`${label}的区服无效`);
    if (!leader) return fail(`${label}的会长无效`);
    if (!isIntInRange(source.memberCount, 0, MAX_INT)) return fail(`${label}的人数无效`);
    if (!isIntInRange(source.score, 0, MAX_INT)) return fail(`${label}的评分无效`);
    seen.add(source.rank);
    clubs.push({
      rank: source.rank,
      name,
      server,
      leader,
      memberCount: source.memberCount,
      score: source.score,
    });
  }

  clubs.sort((a, b) => a.rank - b.rank);
  return { ok: true, clubs };
}
