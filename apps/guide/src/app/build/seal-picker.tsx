'use client';

import { useMemo, useState } from 'react';

export type SealChoice = {
  name: string;
  category: 'attack' | 'defense' | 'special';
  categoryLabel: string;
  iconUrl: string | null;
};

const CATEGORY_ORDER: SealChoice['category'][] = ['attack', 'defense', 'special'];

const TABS: { key: SealChoice['category']; label: string }[] = [
  { key: 'attack', label: '攻击' },
  { key: 'defense', label: '防御' },
  { key: 'special', label: '特化' },
];

export function orderSealNames(names: string[], catalog: SealChoice[]): string[] {
  const categoryOf = new Map(catalog.map((item) => [item.name, item.category]));
  return [...names].sort(
    (a, b) =>
      CATEGORY_ORDER.indexOf(categoryOf.get(a) ?? 'special') -
      CATEGORY_ORDER.indexOf(categoryOf.get(b) ?? 'special'),
  );
}

type Props = {
  seals: SealChoice[];
  selected: string[];
  hint: string | null;
  onToggle: (name: string) => void;
};

export function SealPicker({ seals, selected, hint, onToggle }: Props) {
  const [category, setCategory] = useState<SealChoice['category']>('attack');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim();
    return seals.filter((item) => {
      if (item.category !== category) return false;
      if (!q) return true;
      return item.name.includes(q);
    });
  }, [seals, category, query]);

  return (
    <section className="build-panel puppet-picker" aria-label="封印物">
      <h2>封印物</h2>
      <p className="combo-hint muted">
        攻击、防御、特化各最多 1 件，顺序固定为攻击、防御、特化。同一类再选会换掉原来的。这是站内推荐，不会改写游戏分享码。
      </p>

      {selected.length ? (
        <ul className="puppet-picker-selected">
          {selected.map((name, index) => {
            const item = seals.find((seal) => seal.name === name);
            return (
              <li key={name}>
                <button type="button" className="puppet-picker-chip" onClick={() => onToggle(name)}>
                  <span>
                    {index + 1}. {name}
                  </span>
                  <span className="muted">{item?.categoryLabel ?? ''}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="build-empty">尚未选择封印物</p>
      )}

      <div className="puppet-picker-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={category === tab.key}
            className={category === tab.key ? 'puppet-picker-tab is-active' : 'puppet-picker-tab'}
            onClick={() => setCategory(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <label className="import-draft-label">
        搜索当前分类
        <input
          type="search"
          className="import-plan-input"
          value={query}
          placeholder="输入封印物名"
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {hint ? <p className="puppet-picker-hint">{hint}</p> : null}

      {visible.length === 0 ? (
        <p className="muted">暂无数据</p>
      ) : (
        <ul className="puppet-picker-grid">
          {visible.map((item) => {
            const on = selected.includes(item.name);
            return (
              <li key={item.name}>
                <button
                  type="button"
                  className={on ? 'puppet-picker-card is-on' : 'puppet-picker-card'}
                  aria-pressed={on}
                  onClick={() => onToggle(item.name)}
                >
                  {item.iconUrl ? (
                    <img src={item.iconUrl} alt="" width={48} height={48} />
                  ) : (
                    <span className="puppet-picker-placeholder" aria-hidden>
                      ◈
                    </span>
                  )}
                  <span>{item.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function sealsFromPaste(
  names: string[],
  catalog: SealChoice[],
): { selected: string[]; hint: string | null } {
  const byName = new Map(catalog.map((item) => [item.name, item]));
  const picked = new Map<SealChoice['category'], string>();
  let replaced = false;
  for (const name of names) {
    const item = byName.get(name.trim());
    if (!item || picked.get(item.category) === item.name) continue;
    if (picked.has(item.category)) replaced = true;
    picked.set(item.category, item.name);
  }
  const selected = orderSealNames([...picked.values()], catalog);
  if (names.length > 0 && selected.length === 0) {
    return { selected: [], hint: '文案里的封印物不在图鉴中，请从下面选择' };
  }
  if (replaced) {
    return { selected, hint: '同一类只保留最后一件，已按攻击、防御、特化排好' };
  }
  return { selected, hint: null };
}
