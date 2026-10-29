'use client';

import type { GameShareImportView } from '@ocr/guide-types';

type Props = {
  planTitle: string;
  draft: string;
  importError: string | null;
  imported: GameShareImportView | null;
  saveError: string | null;
  saving: boolean;
  onPlanTitleChange: (value: string) => void;
  onDraftChange: (value: string) => void;
  onImport: () => void;
  onSave: () => void;
  onClear: () => void;
};

function formatImportedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return iso;
  }
}

export function ImportViewPanel({
  planTitle,
  draft,
  importError,
  imported,
  saveError,
  saving,
  onPlanTitleChange,
  onDraftChange,
  onImport,
  onSave,
  onClear,
}: Props) {
  return (
    <section className="build-panel import-panel">
      <h2>导入查看</h2>
      <p className="combo-hint muted">
        粘贴游戏内复制的整段文案（推荐方案或一键辅助分享均可）。
      </p>

      <label className="import-draft-label">
        方案名称
        <input
          type="text"
          className="import-plan-input"
          value={planTitle}
          maxLength={80}
          placeholder="方案名称"
          onChange={(e) => onPlanTitleChange(e.target.value)}
        />
      </label>

      <label className="import-draft-label">
        分享文案
        <textarea
          className="import-draft-text"
          value={draft}
          rows={8}
          placeholder={'复制该消息…\n[[分享码]]\n技能：… 或 一键辅助：…'}
          onChange={(e) => onDraftChange(e.target.value)}
        />
      </label>

      <div className="import-actions">
        <button type="button" className="btn-primary" onClick={onImport}>
          解析导入
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={!imported || saving || !planTitle.trim()}
          onClick={onSave}
        >
          {saving ? '保存中…' : '保存到连招码'}
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={!draft && !imported}
          onClick={onClear}
        >
          清空
        </button>
      </div>

      {importError ? <div className="build-error import-error">{importError}</div> : null}
      {saveError ? <div className="build-error import-error">{saveError}</div> : null}

      {imported ? (
        <div className="import-result">
          <div className="import-author-card">
            <div className="import-author-name">{imported.author}</div>
            <div className="import-author-meta muted">
              导入时间 {formatImportedAt(imported.importedAt)}
            </div>
          </div>

          {imported.planTitle && imported.shareKind === 'assist' ? (
            <p className="import-extra muted">
              方案「{imported.planTitle}」
              {imported.assistConfig?.description
                ? ` · ${imported.assistConfig.description}`
                : null}
            </p>
          ) : null}

          {imported.shareKind === 'assist' && imported.assistConfig?.actions.length ? (
            <>
              <h3 className="import-subtitle">一键辅助步骤</h3>
              <ol className="combo-list combo-list-readonly">
                {imported.assistConfig.actions.map((step, idx) => (
                  <li key={`${step.actionParam}-${idx}`} className="combo-item">
                    <span className="combo-index">{idx + 1}</span>
                    <div className="combo-item-body">
                      <div className="combo-item-title">{step.name}</div>
                      <div className="combo-item-slug">
                        {step.externalId ? `ID ${step.externalId}` : `参数 ${step.actionParam}`}
                        {step.actionName ? ` · 动作 ${step.actionName}` : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          ) : imported.comboSteps.length ? (
            <>
              <h3 className="import-subtitle">连招顺序</h3>
              <ol className="combo-list combo-list-readonly">
                {imported.comboSteps.map((name, idx) => (
                  <li key={`${name}-${idx}`} className="combo-item">
                    <span className="combo-index">{idx + 1}</span>
                    <div className="combo-item-body">
                      <div className="combo-item-title">{name}</div>
                      {imported.skills[idx]?.externalId ? (
                        <div className="combo-item-slug">
                          ID {imported.skills[idx]!.externalId}
                          {imported.skills[idx]!.barSlot
                            ? ` · 栏位 ${imported.skills[idx]!.barSlot}`
                            : null}
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="build-empty">未能解析出技能连招或一键辅助步骤</p>
          )}

          {imported.awakening.map((g) => (
            <p key={g.label} className="import-extra muted">
              觉醒（{g.label}）：{g.names.join('、')}
            </p>
          ))}
          {imported.assistLabel ? (
            <p className="import-extra muted">一键辅助：{imported.assistLabel}</p>
          ) : null}
        </div>
      ) : (
        <p className="build-empty">尚未导入方案，粘贴文案后点击「解析导入」。</p>
      )}
    </section>
  );
}
