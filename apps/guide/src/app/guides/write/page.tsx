import { guideFetch } from '@/lib/api';
import type { PathwayDto } from '@ocr/guide-types';
import { ArticleWriteForm } from './article-write-form';
import '../guides.css';
import '../article.css';

export default async function GuideWritePage() {
  const pathways = await guideFetch<PathwayDto[]>('/pathways').catch(() => [] as PathwayDto[]);

  return (
    <div className="guides-page">
      <ArticleWriteForm pathways={pathways} />
    </div>
  );
}
