import { BackNavLink } from '@/components/back-nav-link';
import { ComboShareDetail } from '@/components/combo-share-detail';
import { guideFetch } from '@/lib/api';
import type { ShareDto, SkillDto } from '@ocr/guide-types';
import { notFound } from 'next/navigation';
import '@/app/build/build.css';
import '../code-detail.css';

export default async function CodeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let share: ShareDto;
  try {
    share = await guideFetch<ShareDto>(`/shares/${id}`, { cache: 'no-store' });
  } catch {
    notFound();
  }

  const skills = await guideFetch<SkillDto[]>(
    `/skills?pathway=${encodeURIComponent(share.pathwaySlug)}`,
  ).catch(() => [] as SkillDto[]);

  return (
    <div className="codes-page">
      <BackNavLink href="/codes" refresh>
        返回连招码列表
      </BackNavLink>
      <ComboShareDetail share={share} skills={skills} />
    </div>
  );
}
