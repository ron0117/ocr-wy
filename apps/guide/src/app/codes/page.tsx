import { guideFetch } from '@/lib/api';
import { formatViewCount } from '@/lib/format-views';
import { codesListHref, sharesListApiQuery } from '@/lib/codes-query';
import type { PathwayDto, PlayScenarioDto, ShareListPageDto } from '@ocr/guide-types';
import Link from 'next/link';
import './codes.css';

const PAGE_SIZE = 15;

export default async function CodesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pathway?: string; scenario?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const pathwayFilter = sp.pathway?.trim() ?? '';
  const scenarioFilter = sp.scenario?.trim() ?? '';

  const filterQuery = {
    page,
    pathway: pathwayFilter || undefined,
    scenario: scenarioFilter || undefined,
  };

  const [list, pathways, scenarios] = await Promise.all([
    guideFetch<ShareListPageDto>(
      sharesListApiQuery({ ...filterQuery, pageSize: PAGE_SIZE }),
      { cache: 'no-store' },
    ).catch(() => ({
      items: [],
      page: 1,
      pageSize: PAGE_SIZE,
      total: 0,
      totalPages: 1,
    })),
    guideFetch<PathwayDto[]>('/pathways').catch(() => [] as PathwayDto[]),
    guideFetch<PlayScenarioDto[]>('/scenarios').catch(() => [] as PlayScenarioDto[]),
  ]);

  const hasFilter = Boolean(pathwayFilter || scenarioFilter);
  const pagerBase = { pathway: pathwayFilter || undefined, scenario: scenarioFilter || undefined };

  return (
    <div className="codes-page">
      <header className="codes-header">
        <div>
          <h1>连招码</h1>
          <p className="muted codes-lead">
            已保存的一键分享文案，共 {list.total} 条
            {hasFilter ? '（已筛选）' : null}
          </p>
        </div>
        <a className="button button-gold" href="/build?pathway=sun">
          分享我的连招
        </a>
      </header>

      <form className="codes-filters" method="get" action="/codes">
        <label>
          途径
          <select name="pathway" defaultValue={pathwayFilter}>
            <option value="">全部途径</option>
            {pathways.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.professionLabel}
              </option>
            ))}
          </select>
        </label>
        <label>
          场景
          <select name="scenario" defaultValue={scenarioFilter}>
            <option value="">全部场景</option>
            {scenarios.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="codes-filters-actions">
          <button type="submit" className="button">
            筛选
          </button>
          {hasFilter ? (
            <Link className="button btn-ghost" href="/codes" prefetch={false}>
              清除
            </Link>
          ) : null}
        </div>
      </form>

      {list.items.length === 0 ? (
        <div className="codes-empty">
          <p className="muted">
            {hasFilter
              ? '当前筛选条件下没有连招码，试试调整途径或场景。'
              : '还没有保存的连招码，在配装工作台粘贴游戏文案并保存。'}
          </p>
          {hasFilter ? (
            <Link className="button" href="/codes" prefetch={false}>
              查看全部
            </Link>
          ) : (
            <a className="button button-gold" href="/build?pathway=sun">
              去配装工作台
            </a>
          )}
        </div>
      ) : (
        <ul className="codes-list">
          {list.items.map((item) => (
            <li key={item.id}>
              <Link className="codes-card" href={`/codes/${item.id}`}>
                <div className="codes-card-main">
                  <h2 className="codes-card-title">
                    {item.title ?? item.authorName ?? '未命名连招'}
                  </h2>
                  <p className="codes-card-meta muted">
                    途径 · {item.pathwayProfessionLabel}
                    {item.scenarioName || item.scenarioCode
                      ? ` · 场景 · ${item.scenarioName ?? item.scenarioCode}`
                      : null}
                    {' · '}
                    {item.comboStepCount} 步连招
                    {' · 查看 '}
                    {formatViewCount(item.viewCount ?? 0)}
                  </p>
                </div>
                <time className="codes-card-time muted" dateTime={item.createdAt}>
                  {item.createdAt.slice(0, 10)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {list.totalPages > 1 ? (
        <nav className="codes-pager" aria-label="分页">
          {page > 1 ? (
            <Link
              className="button"
              href={codesListHref({ ...pagerBase, page: page - 1 })}
              prefetch={false}
            >
              上一页
            </Link>
          ) : (
            <span className="button button--ghost" aria-disabled>
              上一页
            </span>
          )}
          <span className="codes-pager-info muted">
            第 {list.page} / {list.totalPages} 页 · 每页 {PAGE_SIZE} 条
          </span>
          {page < list.totalPages ? (
            <Link
              className="button"
              href={codesListHref({ ...pagerBase, page: page + 1 })}
              prefetch={false}
            >
              下一页
            </Link>
          ) : (
            <span className="button button--ghost" aria-disabled>
              下一页
            </span>
          )}
        </nav>
      ) : null}
    </div>
  );
}
