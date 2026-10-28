import { BuildWorkbench } from './workbench';

export default function BuildPage({
  searchParams,
}: {
  searchParams: Promise<{ pathway?: string; loadout?: string }>;
}) {
  return <BuildWorkbench searchParams={searchParams} />;
}
