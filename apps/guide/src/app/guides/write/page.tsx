import { guideFetch } from '@/lib/api';
import {
  PATHWAY_PROFESSION_LABEL,
  PATHWAY_ROUTE_LABEL,
  type PathwayDto,
} from '@ocr/guide-types';
import { ArticleWriteForm } from './article-write-form';
import '../guides.css';
import '../article.css';

function fallbackPathways(): PathwayDto[] {
  return Object.entries(PATHWAY_PROFESSION_LABEL).map(([slug, professionLabel]) => ({
    slug,
    name: PATHWAY_ROUTE_LABEL[slug] ?? `${professionLabel}途径`,
    professionLabel,
    routeLabel: PATHWAY_ROUTE_LABEL[slug] ?? `${professionLabel}途径`,
    externalId: slug,
  }));
}

export default async function GuideWritePage() {
  const pathways = await guideFetch<PathwayDto[]>('/pathways').catch(() => [] as PathwayDto[]);
  const options = pathways.length > 0 ? pathways : fallbackPathways();

  return (
    <div className="guides-page">
      <ArticleWriteForm pathways={options} />
    </div>
  );
}
