import { loadPuppetCatalog } from '@/lib/puppets-catalog';
import { BuildWorkbench } from './workbench';

export default function BuildPage({
  searchParams,
}: {
  searchParams: Promise<{ pathway?: string; loadout?: string }>;
}) {
  const puppets = loadPuppetCatalog().items.map((item) => ({
    name: item.name,
    rarity: item.rarity,
    rarityLabel: item.rarityLabel,
    iconUrl: item.iconUrl,
  }));
  return <BuildWorkbench searchParams={searchParams} puppets={puppets} />;
}
