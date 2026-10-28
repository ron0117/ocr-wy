import { guideFetch } from '@/lib/api';
import type { CurrentVersionDto } from '@ocr/guide-types';
import './home.css';

const FEATURES = [
  {
    href: '/guides',
    title: '攻略库',
    desc: '推荐配装与玩法整理，按途径查阅',
    icon: 'book',
    enabled: true,
  },
  {
    href: '/codes',
    title: '连招码',
    desc: '浏览玩家分享的一键码，也可自己发布',
    icon: 'combo',
    enabled: true,
  },
  {
    href: '/seals',
    title: '封印物',
    desc: '18 件封印物图鉴，能力与负面效果一览',
    icon: 'seal',
    enabled: true,
  },
  {
    href: undefined,
    title: '敬请期待',
    desc: '更多工具与资料查询正在筹备',
    icon: 'soon',
    enabled: false,
  },
] as const;

function FeatureIcon({ kind }: { kind: (typeof FEATURES)[number]['icon'] }) {
  const common = {
    width: 28,
    height: 28,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (kind === 'book') {
    return (
      <svg aria-hidden {...common}>
        <path d="M5 4h7a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3V4Z" />
        <path d="M19 4h-7a3 3 0 0 0-3 3v13h7a3 3 0 0 1 3 3V4Z" />
      </svg>
    );
  }
  if (kind === 'combo') {
    return (
      <svg aria-hidden {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 9h10M7 13h6" />
      </svg>
    );
  }
  if (kind === 'seal') {
    return (
      <svg aria-hidden {...common}>
        <path d="M12 3 4 7v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V7l-8-4Z" />
        <path d="M9.5 12.5 11 14l3.5-4" />
      </svg>
    );
  }
  return (
    <svg aria-hidden {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4l2.5 2.5" />
    </svg>
  );
}

export default async function HomePage() {
  let version: CurrentVersionDto | null = null;
  try {
    version = await guideFetch<CurrentVersionDto>('/meta/current-version');
  } catch {
    version = null;
  }

  return (
    <div className="home-page">
      <section className="home-banner">
        <div className="home-banner-inner">
          <p className="home-banner-kicker">Lord of the Mysteries · 粉丝工具</p>
          <h1>无忧玩家工具</h1>
          <p className="home-banner-lead">查攻略 · 配连招 · 分享一键码</p>
          {version ? (
            <p className="home-banner-meta muted">
              数据版本 {version.semver}
              {version.verifiedAt ? ` · 核验 ${version.verifiedAt.slice(0, 10)}` : null}
            </p>
          ) : (
            <p className="home-banner-meta muted">尚未导入数据，请先运行 guide:import。</p>
          )}
        </div>
      </section>

      <section className="home-section">
        <h2 className="home-section-title">资料查询</h2>
        <div className="home-feature-grid">
          {FEATURES.map((f) => {
            const inner = (
              <>
                <span className="home-feature-icon">
                  <FeatureIcon kind={f.icon} />
                </span>
                <span className="home-feature-title">{f.title}</span>
                <span className="home-feature-desc">{f.desc}</span>
              </>
            );
            if (f.enabled && f.href) {
              return (
                <a key={f.title} className="home-feature-card" href={f.href}>
                  {inner}
                </a>
              );
            }
            return (
              <div key={f.title} className="home-feature-card home-feature-card--disabled">
                {inner}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
