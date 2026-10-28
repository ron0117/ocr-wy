import type { ReactNode } from 'react';

const MAIN_NAV = [
  { href: '/', label: '首页', icon: 'home' as const },
  { href: '/guides', label: '攻略', icon: 'book' as const },
  { href: '/codes', label: '连招', icon: 'combo' as const },
  { href: '/build?pathway=sun', label: '配装', icon: 'build' as const },
] as const;

function NavIcon({ kind }: { kind: (typeof MAIN_NAV)[number]['icon'] }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (kind) {
    case 'home':
      return (
        <svg aria-hidden {...common}>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
        </svg>
      );
    case 'book':
      return (
        <svg aria-hidden {...common}>
          <path d="M5 4h7a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3V4Z" />
          <path d="M19 4h-7a3 3 0 0 0-3 3v13h7a3 3 0 0 1 3 3V4Z" />
        </svg>
      );
    case 'combo':
      return (
        <svg aria-hidden {...common}>
          <path d="M8 6h13M8 12h13M8 18h13" />
          <path d="M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
      );
    case 'build':
      return (
        <svg aria-hidden {...common}>
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
        </svg>
      );
  }
}

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="site-header">
        <a className="site-brand" href="/">
          <span className="site-brand-mark" aria-hidden>
            ◈
          </span>
          无忧玩家工具
        </a>
        <nav className="site-nav site-nav--desktop" aria-label="主导航">
          {MAIN_NAV.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <span className="muted site-tagline">非官方 · 与版权方无隶属关系</span>
      </header>
      <main className="site-main">{children}</main>
      <footer className="site-footer">
        <a href="/legal/disclaimer">免责声明</a>
      </footer>
      <nav className="bottom-nav" aria-label="底部导航">
        {MAIN_NAV.map((item) => (
          <a key={item.href} className="bottom-nav-item" href={item.href}>
            <NavIcon kind={item.icon} />
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
    </>
  );
}
