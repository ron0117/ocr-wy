import { BackNavLink } from '@/components/back-nav-link';
import { guideFetch } from '@/lib/api';
import type { ClubRankingDto } from '@ocr/guide-types';
import './club-rankings.css';

function formatScore(score: number) {
  return score.toLocaleString('en-US');
}

export default async function ClubRankingsPage() {
  let data: ClubRankingDto | null = null;
  let failed = false;
  try {
    data = await guideFetch<ClubRankingDto>('/club-rankings', { cache: 'no-store' });
  } catch {
    failed = true;
  }
  const clubs = data?.clubs ?? [];

  return (
    <div className="club-rankings">
      <BackNavLink href="/">首页</BackNavLink>
      <h1>俱乐部排行</h1>
      {failed ? <p className="club-rankings-empty">暂时无法加载</p> : null}
      {!failed && clubs.length === 0 ? <p className="club-rankings-empty">暂无排行</p> : null}
      {!failed && clubs.length > 0 ? (
        <div className="club-rankings-scroll">
          <table>
            <thead>
              <tr>
                <th>排名</th>
                <th>俱乐部</th>
                <th>区服</th>
                <th>会长</th>
                <th>人数</th>
                <th>评分</th>
              </tr>
            </thead>
            <tbody>
              {clubs.map((row) => (
                <tr key={row.rank} className={row.rank <= 3 ? `club-rankings-top club-rankings-top--${row.rank}` : undefined}>
                  <td className="club-rankings-rank">{row.rank}</td>
                  <td>{row.name}</td>
                  <td>{row.server}</td>
                  <td>{row.leader}</td>
                  <td className="club-rankings-num">{row.memberCount}</td>
                  <td className="club-rankings-num">{formatScore(row.score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
