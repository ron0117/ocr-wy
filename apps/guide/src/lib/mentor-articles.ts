import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { MENTORS, type MentorEntry } from './mentors';

export function mentorArticlesRoot(): string {
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
  const file = path.join(mentorArticlesRoot(), articleFile);
  if (!existsSync(file)) return undefined;
  return readFileSync(file, 'utf8');
}

export { renderMentorMarkdown } from './render-markdown';
