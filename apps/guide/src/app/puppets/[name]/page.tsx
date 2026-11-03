import { BackNavLink } from '@/components/back-nav-link';
import {
  displayPuppetValue,
  getPuppetByName,
  loadPuppetCatalog,
} from '@/lib/puppets-catalog';
import { notFound } from 'next/navigation';
import '../puppets.css';

export function generateStaticParams() {
  return loadPuppetCatalog().items.map((item) => ({ name: item.name }));
}

export default async function PuppetDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const puppet = getPuppetByName(name);
  if (!puppet) notFound();

  const facts: { label: string; value: string }[] = [
    { label: '冷却（秒）', value: displayPuppetValue(puppet.cooldown) },
    { label: '释放射程（米）', value: displayPuppetValue(puppet.castRange) },
    { label: '作用半径（米）', value: displayPuppetValue(puppet.radius) },
    { label: '属性1', value: displayPuppetValue(puppet.attr1) },
    { label: '属性2', value: displayPuppetValue(puppet.attr2) },
    { label: '定位', value: displayPuppetValue(puppet.role) },
    { label: 'PVP/PVE', value: displayPuppetValue(puppet.mode) },
  ];

  return (
    <div className="puppets-page">
      <BackNavLink href="/puppets">返回图鉴</BackNavLink>

      <div className="puppet-detail-header">
        {puppet.iconUrl ? (
          <img
            className="puppet-detail-icon"
            src={puppet.iconUrl}
            alt=""
            width={88}
            height={88}
          />
        ) : (
          <span className="puppet-detail-icon puppet-card-icon--placeholder" aria-hidden>
            ◈
          </span>
        )}
        <div className="puppet-detail-meta">
          <h1>{puppet.name}</h1>
          <span className={`puppet-detail-tag puppet-rarity--${puppet.rarity}`}>
            {puppet.rarityLabel}
          </span>
        </div>
      </div>

      <section className="puppet-detail-section">
        <h2>{puppet.skillName || '技能'}</h2>
        <p>{displayPuppetValue(puppet.skillRank1)}</p>
      </section>

      <section className="puppet-detail-section">
        <h2>属性与定位</h2>
        <dl className="puppet-facts">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="puppet-detail-section">
        <h2>推荐与备注</h2>
        <p>{displayPuppetValue(puppet.note)}</p>
      </section>

      {puppet.ranks.length ? (
        <section className="puppet-detail-section">
          <h2>进阶</h2>
          <ul>
            {puppet.ranks.map((rank) => (
              <li key={rank.rank}>{`${rank.rank}阶：${rank.text}`}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
