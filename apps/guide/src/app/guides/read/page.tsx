import { GuideArticleView, decodeGuideSlug } from '../article-view';

export const dynamic = 'force-dynamic';

export default async function GuideReadPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;
  return <GuideArticleView slug={decodeGuideSlug(slug ?? '')} />;
}
