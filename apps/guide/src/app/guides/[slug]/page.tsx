import { guideFetch } from '@/lib/api';
import type { GuideArticleDto, PathwayDto } from '@ocr/guide-types';
import { BackNavLink } from '@/components/back-nav-link';
import { notFound } from 'next/navigation';
import '../guides.css';
import '../article.css';

export default async function GuideArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let article: GuideArticleDto;
  try {
    article = await guideFetch<GuideArticleDto>(
      `/articles/${encodeURIComponent(slug)}`,
      { cache: 'no-store' },
    );
  } catch {
    notFound();
  }

  const pathways = await guideFetch<PathwayDto[]>('/pathways').catch(() => [] as PathwayDto[]);
  const pathwayLabel = article.pathwaySlug
    ? pathways.find((p) => p.slug === article.pathwaySlug)?.professionLabel
    : undefined;

  const savedAt = article.createdAt.slice(0, 10);

  return (
    <div className="guides-page article-read">
      <BackNavLink href="/guides" refresh>
        返回攻略库
      </BackNavLink>

      <header className="article-read-header">
        {pathwayLabel ? (
          <span className="guide-card-tag">{pathwayLabel}</span>
        ) : null}
        <h1>{article.title}</h1>
        <p className="muted article-read-meta">
          {article.authorName} · {savedAt}
        </p>
        {article.summary ? (
          <p className="article-read-summary">{article.summary}</p>
        ) : null}
      </header>

      {article.coverUrl ? (
        <img className="article-read-cover" src={article.coverUrl} alt="" />
      ) : null}

      <article
        className="article-prose"
        dangerouslySetInnerHTML={{ __html: article.bodyHtml }}
      />
    </div>
  );
}
