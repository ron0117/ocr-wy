'use client';

import { useMemo, useState } from 'react';

export type PuppetChoice = {
  name: string;
  rarity: 'red' | 'orange' | 'gold' | 'purple';
  rarityLabel: string;
  iconUrl: string | null;
};

const TABS: { key: PuppetChoice['rarity']; label: string }[] = [
  { key: 'red', label: '红色' },
  { key: 'orange', label: '橙色' },
  { key: 'gold', label: '金色' },
  { key: 'purple', label: '紫色' },
];

type Props = {
  puppets: PuppetChoice[];
  selected: string[];
  hint: string | null;
  onToggle: (name: string) => void;
};

export function PuppetPicker({ puppets, selected, hint, onToggle }: Props) {
  const [rarity, setRarity] = useState<PuppetChoice['rarity']>('orange');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim();
    return puppets.filter((item) => {
      if (item.rarity !== rarity) return false;
      if (!q) return true;
      return item.name.includes(q);
    });
  }, [puppets, rarity, query]);

  return (
    <section className="build-panel puppet-picker" aria-label="上阵秘偶">
      <h2>上阵秘偶</h2>
      <p className="combo-hint muted">可选 0～3 只，默认不选。这里是推荐搭配，不限制游戏内的 2 只上阵。</p>

      {selected.length ? (
        <ul className="puppet-picker-selected">
          {selected.map((name, index) => {
            const item = puppets.find((puppet) => puppet.name === name);
            return (
              <li key={name}>
                <button type="button" className="puppet-picker-chip" onClick={() => onToggle(name)}>
                  <span>
                    {index + 1}. {name}
                  </span>
                  <span className="muted">{item?.rarityLabel ?? ''}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="build-empty">尚未选择秘偶</p>
      )}

      <div className="puppet-picker-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={rarity === tab.key}
            className={rarity === tab.key ? 'puppet-picker-tab is-active' : 'puppet-picker-tab'}
            onClick={() => setRarity(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <label className="import-draft-label">
        搜索当前品质
        <input
          type="search"
          className="import-plan-input"
          value={query}
          placeholder="输入秘偶名"
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
