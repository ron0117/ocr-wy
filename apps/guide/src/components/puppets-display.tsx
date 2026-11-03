import { existsSync } from 'fs';
import path from 'path';
import { puppetIconUrl } from '@/lib/puppets-manifest';
import { puppetsCatalogRoot } from '@/lib/puppets-path';

function iconSrcForName(name: string): string | undefined {
  const trimmed = name.trim();
  if (!trimmed || trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('..')) {
    return undefined;
  }
  const file = path.join(puppetsCatalogRoot(), 'icons', `${trimmed}.png`);
  if (!existsSync(file)) return undefined;
  return puppetIconUrl(trimmed);
}

type GridProps = {
  names: string[];
};

export function PuppetsDisplayGrid({ names }: GridProps) {
  return (
    <ul className="import-seals-grid">
      {names.map((name) => {
        const iconSrc = iconSrcForName(name);
        const detailHref = `/puppets/${encodeURIComponent(name.trim())}`;
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
  names: string[];
  variant?: 'detail';
};

export function PuppetsDisplaySection({ names }: SectionProps) {
  if (!names.length) return null;

  return (
    <section className="code-detail-section import-seals-panel" aria-label="上阵秘偶">
      <h2>上阵秘偶</h2>
      <p className="import-seals-lead muted">共 {names.length} 只</p>
      <PuppetsDisplayGrid names={names} />
    </section>
  );
}
