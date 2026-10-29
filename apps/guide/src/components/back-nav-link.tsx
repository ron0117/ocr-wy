'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import './back-nav.css';

function BackChevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14.5 5 8 12l6.5 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Props = {
  href: string;
  children: ReactNode;
  /** 返回列表页时刷新 Server Component 数据 */
  refresh?: boolean;
  className?: string;
};

export function BackNavLink({ href, children, refresh, className }: Props) {
  const router = useRouter();
  const classes = ['back-nav', className].filter(Boolean).join(' ');

  return (
    <Link
      href={href}
      className={classes}
      onClick={
        refresh
          ? (e) => {
              e.preventDefault();
              router.push(href);
              router.refresh();
            }
          : undefined
      }
    >
      <span className="back-nav-icon">
        <BackChevron />
      </span>
      <span className="back-nav-label">{children}</span>
    </Link>
  );
}
