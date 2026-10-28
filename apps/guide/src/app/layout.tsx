import type { Metadata } from 'next';
import { SiteShell } from '@/components/site-shell';
import './globals.css';

export const metadata: Metadata = {
  title: '无忧玩家工具',
  description: '非官方粉丝工具 · 攻略库与连招码分享',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
