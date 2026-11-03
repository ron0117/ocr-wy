import { CopyShareTextButton } from '@/components/copy-share-text-button';
import { PuppetsDisplaySection } from '@/components/puppets-display';
import { SealsDisplaySection } from '@/components/seals-display';
import { enrichImportWithSkills } from '@/lib/game-share';
import { parseGameSharePaste, type ShareDto, type SkillDto } from '@ocr/guide-types';

type Props = {
  share: ShareDto;
  skills: SkillDto[];
};

function formatSavedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return iso;
  }
}

export function ComboShareDetail({ share, skills }: Props) {
  let parseError: string | null = null;
  let view = null;
  try {
    const parsed = parseGameSharePaste(share.shareText);
    view = enrichImportWithSkills(parsed, skills, share.createdAt);
  } catch (e) {
    parseError = e instanceof Error ? e.message : '文案解析失败';
  }

  const scenarioLabel = share.scenarioName ?? share.scenarioCode ?? '—';

  return (
    <div className="code-detail">
      <header className="code-detail-header">
        <p className="code-detail-tags">
          <span className="build-badge">途径 · {share.pathwayProfessionLabel}</span>
          <span className="build-badge build-badge-muted">
            场景 · {scenarioLabel}
          </span>
        </p>
        <h1>{share.title ?? share.authorName ?? '连招分享'}</h1>
        <p className="muted code-detail-meta">
          保存于 {formatSavedAt(share.createdAt)}
          {share.comboStepCount ? ` · ${share.comboStepCount} 步连招` : null}
        </p>
      </header>

      <PuppetsDisplaySection names={share.deployedPuppets ?? []} />

      {parseError ? (
        <div className="build-error">{parseError}</div>
      ) : view ? (
        <>
          <div className="import-author-card">
            <div className="import-author-name">{view.author}</div>
            {view.planTitle ? (
              <p className="muted import-author-meta">方案「{view.planTitle}」</p>
            ) : null}
          </div>

          {view.shareKind === 'assist' && view.assistConfig?.description ? (
            <p className="import-extra muted">{view.assistConfig.description}</p>
          ) : null}

          {view.shareKind === 'assist' && view.assistConfig?.actions.length ? (
            <section className="code-detail-section">
              <h2>一键辅助步骤</h2>
              <ol className="combo-list combo-list-readonly">
                {view.assistConfig.actions.map((step, idx) => (
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
            </section>
          ) : view.comboSteps.length ? (
            <section className="code-detail-section">
              <h2>连招顺序</h2>
              <ol className="combo-list combo-list-readonly">
                {view.comboSteps.map((name, idx) => (
                  <li key={`${name}-${idx}`} className="combo-item">
                    <span className="combo-index">{idx + 1}</span>
                    <div className="combo-item-body">
                      <div className="combo-item-title">{name}</div>
                      {view.skills[idx]?.externalId ? (
                        <div className="combo-item-slug">
                          ID {view.skills[idx]!.externalId}
                          {view.skills[idx]!.barSlot
                            ? ` · 栏位 ${view.skills[idx]!.barSlot}`
                            : null}
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <SealsDisplaySection sealNames={view.seals} variant="detail" />

          {view.awakening.map((g) => (
            <p key={g.label} className="import-extra muted">
              觉醒（{g.label}）：{g.names.join('、')}
            </p>
          ))}
          {view.assistLabel ? (
            <p className="import-extra muted">一键辅助：{view.assistLabel}</p>
          ) : null}

          <section className="code-detail-section">
            <div className="code-detail-section-head">
              <h2>原始分享文案</h2>
              <CopyShareTextButton text={share.shareText} />
            </div>
            <pre className="code-detail-raw">{share.shareText}</pre>
          </section>
        </>
      ) : null}
    </div>
  );
}
