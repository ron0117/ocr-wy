import { guideFetch } from '@/lib/api';
import type { PathwayDto } from '@ocr/guide-types';
import './pathways.css';

export default async function PathwaysPage() {
  const pathways = await guideFetch<PathwayDto[]>('/pathways').catch(() => []);

  return (
    <div className="pathways-page">
      <h1 className="pathways-title">公测开放途径</h1>
      <p className="pathways-sub muted">
        共 {pathways.length} 条 · 点击进入配装（显示名为游戏内起始职业）
      </p>
      <ul className="pathway-grid">
        {pathways.map((p) => (
          <li key={p.slug}>
            <a
              className="pathway-card"
              href={`/build?pathway=${encodeURIComponent(p.slug)}`}
            >
              {p.deityLabel ? (
                <div className="pathway-card-deity">{p.deityLabel}</div>
              ) : null}
              <div className="pathway-card-profession">{p.professionLabel}</div>
              <div className="pathway-card-route">{p.routeLabel}</div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
