import { BackNavLink } from '@/components/back-nav-link';
import {
  loadMentorArticleMarkdown,
  mentorWithArticle,
  renderMentorMarkdown,
} from '@/lib/mentor-articles';
import { MENTORS } from '@/lib/mentors';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import '../../guides/guides.css';
import '../../guides/article.css';

export function generateStaticParams() {
  return MENTORS.filter((mentor) => !mentor.isWebsite && mentor.articleFile).map((mentor) => ({
    slug: mentor.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const mentor = mentorWithArticle(slug);
  if (!mentor) return { title: '导师攻略' };
  return { title: `${mentor.name}攻略 · 无忧玩家工具` };
}

export default async function MentorArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const mentor = mentorWithArticle(slug);
  if (!mentor?.articleFile) notFound();

  const markdown = loadMentorArticleMarkdown(mentor.articleFile);
  if (!markdown) notFound();

  return (
    <div className="guides-page article-read">
      <BackNavLink href="/">返回首页</BackNavLink>
      <article className="article-prose" dangerouslySetInnerHTML={{ __html: renderMentorMarkdown(markdown) }} />
    </div>
  );
}
