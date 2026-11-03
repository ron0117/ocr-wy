import { loadPuppetCatalog } from '@/lib/puppets-catalog';
import { loadSealCatalog, sealIconUrl } from '@/lib/seals-catalog';
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
  const seals = loadSealCatalog().map((item) => ({
    name: item.name,
    category: item.category,
    categoryLabel: item.categoryLabel,
    iconUrl: item.iconPath ? sealIconUrl(item.iconPath) : null,
  }));
  return <BuildWorkbench searchParams={searchParams} puppets={puppets} seals={seals} />;
}
