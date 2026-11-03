import {
  loadPuppetCatalog,
  type PuppetRarity,
} from '@/lib/puppets-catalog';
import './puppets.css';

const RARITY_ORDER: { key: PuppetRarity; title: string }[] = [
  { key: 'red', title: '红色' },
  { key: 'orange', title: '橙色' },
  { key: 'gold', title: '金色' },
  { key: 'purple', title: '紫色' },
];

export default function PuppetsPage() {
  const { items, usageNotes } = loadPuppetCatalog();

  return (
    <div className="puppets-page">
      <header className="page-header">
        <h1>秘偶图鉴</h1>
        <p className="muted puppets-intro">
          共 {items.length} 只秘偶，按红、橙、金、紫分档。技能描述默认 1 阶，数值以游戏内图鉴为准。
        </p>
        {usageNotes.length ? (
          <ul className="puppets-usage">
            {usageNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
      </header>

      {RARITY_ORDER.map(({ key, title }) => {
        const group = items.filter((item) => item.rarity === key);
        return (
          <section key={key} className="puppets-category">
            <h2 className={`puppets-category-title puppet-rarity--${key}`}>
              {title}（{group.length}）
            </h2>
            {group.length === 0 ? (
              <p className="muted">暂无数据</p>
            ) : (
              <ul className="puppets-grid">
                {group.map((item) => (
                  <li key={item.name}>
                    <a
                      className={`puppet-card puppet-rarity--${key}`}
                      href={`/puppets/${encodeURIComponent(item.name)}`}
                    >
                      {item.iconUrl ? (
                        <img
                          className="puppet-card-icon"
                          src={item.iconUrl}
                          alt=""
                          width={64}
                          height={64}
                        />
                      ) : (
                        <span className="puppet-card-icon puppet-card-icon--placeholder" aria-hidden>
                          ◈
                        </span>
                      )}
                      <span className="puppet-card-name">{item.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
