import { BackNavLink } from '@/components/back-nav-link';
import { getSealByName, loadSealCatalog, renderSealParagraphs, sealIconUrl } from '@/lib/seals-catalog';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import '../seals.css';

function SealBody({ text }: { text: string }) {
  const lines = renderSealParagraphs(text);
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`}>
        {listItems.map((item) => (
          <li key={item}>{item.replace(/^-\s*/, '')}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  for (const line of lines) {
    if (line.startsWith('- ')) {
      listItems.push(line);
      continue;
    }
    flushList();
    blocks.push(<p key={`p-${blocks.length}`}>{line}</p>);
  }
  flushList();

  return <>{blocks}</>;
}

export function generateStaticParams() {
  return loadSealCatalog().map((s) => ({ name: s.name }));
}

export default async function SealDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const seal = getSealByName(name);
  if (!seal) notFound();

  return (
    <div className="seals-page">
      <BackNavLink href="/seals">返回图鉴</BackNavLink>

      <div className="seal-detail-header">
        {seal.iconPath ? (
          <img
            className="seal-detail-icon"
            src={sealIconUrl(seal.iconPath)}
            alt=""
            width={88}
            height={88}
          />
        ) : null}
        <div className="seal-detail-meta">
          <h1>{seal.name}</h1>
          <span className="seal-detail-tag">
            {seal.categoryLabel} · 第 {seal.index} 件
          </span>
        </div>
      </div>

      <section className="seal-detail-section">
        <h2>非凡能力</h2>
        <SealBody text={seal.ability} />
      </section>

      <section className="seal-detail-section">
        <h2>负面效果</h2>
        {seal.negative ? (
          <SealBody text={seal.negative} />
        ) : (
          <p className="muted">暂无录入</p>
        )}
        {seal.negativeIncomplete ? (
          <p className="seal-detail-note">部分文案在原始截图中被界面遮挡，待补图后更新。</p>
        ) : null}
      </section>
    </div>
  );
}
