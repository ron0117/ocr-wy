import { guideFetch } from '@/lib/api';
import { formatViewCount } from '@/lib/format-views';
import type { GuideArticleListItemDto, PathwayDto } from '@ocr/guide-types';
import './guides.css';
import './article.css';

export const dynamic = 'force-dynamic';

export default async function GuidesPage() {
  const [articles, pathways] = await Promise.all([
    guideFetch<GuideArticleListItemDto[]>('/articles?limit=50', { cache: 'no-store' }).catch(
      () => [] as GuideArticleListItemDto[],
    ),
    guideFetch<PathwayDto[]>('/pathways').catch(() => [] as PathwayDto[]),
  ]);

  const pathwayName = new Map(pathways.map((p) => [p.slug, p.professionLabel]));

  return (
    <div className="guides-page">
      <div className="guides-section-head">
        <header className="page-header">
          <h1>攻略库</h1>
          <p className="muted page-header-lead">玩家投稿攻略 {articles.length} 篇</p>
        </header>
        <a className="button button-gold" href="/guides/write">
          写攻略
        </a>
      </div>

      {articles.length === 0 ? (
        <p className="empty-hint muted">
          还没有玩家攻略，点击「写攻略」发布第一篇。
        </p>
      ) : (
        <ul className="guide-list">
          {articles.map((item) => (
            <li key={item.id}>
              <a className="guide-card" href={`/guides/${encodeURIComponent(item.slug)}`}>
                <div className="guide-card-top">
                  <span className="guide-card-tag">玩家投稿</span>
                  {item.pathwaySlug ? (
                    <span className="guide-card-tag guide-card-tag--muted">
                      {pathwayName.get(item.pathwaySlug) ?? item.pathwaySlug}
                    </span>
                  ) : null}
                </div>
                <h2 className="guide-card-title">{item.title}</h2>
                <p className="guide-card-meta muted">
                  {item.authorName} · {item.createdAt.slice(0, 10)}
                  {' · 阅读 '}
                  {formatViewCount(item.viewCount ?? 0)}
                </p>
                {item.summary ? (
                  <p className="article-card-excerpt">{item.summary}</p>
                ) : null}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
