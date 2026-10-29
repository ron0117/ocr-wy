import { sealIconSrcForName } from '@/lib/seals-manifest';

type GridProps = {
  sealNames: string[];
};

export function SealsDisplayGrid({ sealNames }: GridProps) {
  return (
    <ul className="import-seals-grid">
      {sealNames.map((name) => {
        const iconSrc = sealIconSrcForName(name);
        const detailHref = `/seals/${encodeURIComponent(name.trim())}`;
        return (
          <li key={name}>
            <a className="import-seal-card" href={detailHref}>
              {iconSrc ? (
                <img
                  className="import-seal-icon"
                  src={iconSrc}
                  alt=""
                  width={56}
                  height={56}
                />
              ) : (
                <span className="import-seal-icon import-seal-icon--placeholder" aria-hidden>
                  ◈
                </span>
              )}
              <span className="import-seal-name">{name}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

type SectionProps = {
  sealNames: string[];
  /** build：配装页独立面板；detail：连招码详情内嵌区块 */
  variant?: 'build' | 'detail';
};

export function SealsDisplaySection({ sealNames, variant = 'build' }: SectionProps) {
  if (!sealNames.length) return null;

  const lead =
    variant === 'build'
      ? `自分享文案解析，共 ${sealNames.length} 件`
      : `共 ${sealNames.length} 件`;

  if (variant === 'detail') {
    return (
      <section className="code-detail-section import-seals-panel" aria-label="封印物">
        <h2>封印物</h2>
        <p className="import-seals-lead muted">{lead}</p>
        <SealsDisplayGrid sealNames={sealNames} />
      </section>
    );
  }

  return (
    <section className="build-panel import-seals-panel" aria-label="解析出的封印物">
      <h2>封印物</h2>
      <p className="import-seals-lead muted">{lead}</p>
      <SealsDisplayGrid sealNames={sealNames} />
    </section>
  );
}
