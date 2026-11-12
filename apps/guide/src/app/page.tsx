import { guideFetch } from '@/lib/api';
import type { CurrentVersionDto } from '@ocr/guide-types';
import { MentorSection } from './mentor-section';
import { ScheduleSection } from './schedule-section';
import './home.css';

const FEATURES = [
  {
    href: '/strategic-skills',
    title: '战略服技能',
    desc: '6 大职业战略技能与完整军衔强化',
    icon: 'strategy',
    enabled: true,
  },
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
    href: '/puppets',
    title: '秘偶图鉴',
    desc: '按红、橙、金、紫查看秘偶技能与推荐',
    icon: 'puppet',
    enabled: true,
  },
  {
    href: '/club-rankings',
    title: '俱乐部排行',
    desc: '查看全区服俱乐部排行',
    icon: 'rank',
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
  if (kind === 'puppet') {
    return (
      <svg aria-hidden {...common}>
        <circle cx="12" cy="5.5" r="2.2" />
        <path d="M12 7.7v2.2M8 14.2 12 10l4 4.2M8 14.2l-1.2 5.2M16 14.2l1.2 5.2M9.2 12.2h5.6" />
      </svg>
    );
  }
  if (kind === 'rank') {
    return (
      <svg aria-hidden {...common}>
        <path d="M4 19V9M10 19V5M16 19v-7M20 19H2" />
      </svg>
    );
  }
  if (kind === 'strategy') {
    return (
      <svg aria-hidden {...common}>
        <path d="M12 3 4.5 7v5c0 4.7 3 8 7.5 9.5 4.5-1.5 7.5-4.8 7.5-9.5V7L12 3Z" />
        <path d="m8.5 15 7-7M9 9h.01M15 15h.01" />
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

      <MentorSection />

      <ScheduleSection />
    </div>
  );
}
