import { loadSealCatalog, sealIconUrl, type SealCategory } from '@/lib/seals-catalog';
import './seals.css';

const CATEGORY_ORDER: { key: SealCategory; title: string }[] = [
  { key: 'attack', title: '攻击封印物（6 件）' },
  { key: 'defense', title: '防御封印物（6 件）' },
  { key: 'special', title: '特化封印物（6 件）' },
];

export default function SealsPage() {
  const catalog = loadSealCatalog();

  return (
    <div className="seals-page">
      <header className="page-header">
        <h1>封印物图鉴</h1>
        <p className="muted seals-intro">
          共 {catalog.length} 件封印物：攻击、防御、特化各 6 件。能力与负面效果摘自游戏内截图整理，数值随版本与角色面板可能变化。
        </p>
      </header>

      {CATEGORY_ORDER.map(({ key, title }) => {
        const items = catalog.filter((s) => s.category === key);
        return (
          <section key={key} className="seals-category">
            <h2 className="seals-category-title">{title}</h2>
            <ul className="seals-grid">
              {items.map((item) => (
                <li key={item.index}>
                  <a
                    className="seal-card"
                    href={`/seals/${encodeURIComponent(item.name)}`}
                  >
                    {item.iconPath ? (
                      <img
                        className="seal-card-icon"
                        src={sealIconUrl(item.iconPath)}
                        alt=""
                        width={64}
                        height={64}
                      />
                    ) : null}
                    <span className="seal-card-name">{item.name}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
