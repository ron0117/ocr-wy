import { GuideArticleView, decodeGuideSlug } from '../article-view';

export const dynamic = 'force-dynamic';

export default async function GuideArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <GuideArticleView slug={decodeGuideSlug(slug)} />;
}
