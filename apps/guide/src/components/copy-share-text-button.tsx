'use client';

import { useState } from 'react';

async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(area);
  if (!ok) throw new Error('copy failed');
}

export function CopyShareTextButton({ text }: { text: string }) {
  const [label, setLabel] = useState('一键复制');

  const onCopy = async () => {
    try {
      await writeClipboard(text);
      setLabel('已复制');
    } catch {
      setLabel('复制失败');
    }
    window.setTimeout(() => setLabel('一键复制'), 1600);
  };

  return (
    <button type="button" className="btn-ghost code-detail-copy" onClick={() => void onCopy()}>
      {label}
    </button>
  );
}
