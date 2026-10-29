'use client';

import {
  calcLoadoutStats,
  parseGameSharePaste,
  type CurrentVersionDto,
  type GameShareImportView,
  type GearDto,
  type LoadoutDto,
  type PathwayDto,
  type PlayScenarioDto,
  type SkillDto,
} from '@ocr/guide-types';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiBase } from '@/lib/api';
import {
  formatStatValue,
  GEAR_SLOT_LABELS,
  GEAR_SLOT_ORDER,
  statLabel,
} from '@/lib/labels';
import { enrichImportWithSkills } from '@/lib/game-share';
import { ImportedSealsPanel } from './imported-seals-panel';
import { ImportViewPanel } from './import-view-panel';
import './build.css';

async function clientFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `${path} ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function orderedSlots(slots: Record<string, string>): string[] {
  const keys = new Set(Object.keys(slots));
  const ordered: string[] = GEAR_SLOT_ORDER.filter((s) => keys.has(s));
  for (const k of keys) {
    if (!ordered.includes(k)) ordered.push(k);
  }
  return ordered;
}

export function BuildWorkbench({
  searchParams,
}: {
  searchParams: Promise<{ pathway?: string; loadout?: string }>;
}) {
  const router = useRouter();
  const [initialLoadoutSlug, setInitialLoadoutSlug] = useState<string | undefined>();
  const [pathwaySlug, setPathwaySlug] = useState('sun');
  const [scenarioCode, setScenarioCode] = useState('PVE');
  const [pathways, setPathways] = useState<PathwayDto[]>([]);
  const [scenarios, setScenarios] = useState<PlayScenarioDto[]>([]);
  const [version, setVersion] = useState<CurrentVersionDto | null>(null);
  const [gearList, setGearList] = useState<GearDto[]>([]);
  const [skills, setSkills] = useState<SkillDto[]>([]);
  const [recommended, setRecommended] = useState<LoadoutDto | null>(null);
  const [gearSlots, setGearSlots] = useState<Record<string, string>>({});
  const [planTitle, setPlanTitle] = useState('');
  const [importDraft, setImportDraft] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [imported, setImported] = useState<GameShareImportView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void searchParams.then((sp) => {
      if (sp.pathway) setPathwaySlug(sp.pathway);
      if (sp.loadout) setInitialLoadoutSlug(sp.loadout);
    });
  }, [searchParams]);

  useEffect(() => {
    void (async () => {
      try {
        const [pw, sc, meta] = await Promise.all([
          clientFetch<PathwayDto[]>('/pathways'),
          clientFetch<PlayScenarioDto[]>('/scenarios'),
          clientFetch<CurrentVersionDto>('/meta/current-version').catch(() => null),
        ]);
        setPathways(pw);
        setScenarios(sc);
        if (meta) setVersion(meta);
      } catch {
        /* 工具栏降级为当前 slug */
      }
    })();
  }, []);

  const applyLoadout = useCallback((loadout: LoadoutDto) => {
    setRecommended(loadout);
    setGearSlots({ ...loadout.gearSlots });
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loadoutQuery = initialLoadoutSlug
        ? clientFetch<LoadoutDto>(`/loadouts/${initialLoadoutSlug}`).then((one) => [one])
        : clientFetch<LoadoutDto[]>(
            `/loadouts?pathway=${encodeURIComponent(pathwaySlug)}&scenario=${encodeURIComponent(scenarioCode)}`,
          );

      const [gear, skillRows, loadouts] = await Promise.all([
        clientFetch<GearDto[]>(`/gear?pathway=${encodeURIComponent(pathwaySlug)}`),
        clientFetch<SkillDto[]>(`/skills?pathway=${encodeURIComponent(pathwaySlug)}`),
        loadoutQuery,
      ]);
      setGearList(gear);
      setSkills(skillRows);
      const loadout = loadouts[0];
      if (loadout) {
        applyLoadout(loadout);
      } else {
        setRecommended(null);
        setGearSlots({});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [pathwaySlug, scenarioCode, initialLoadoutSlug, applyLoadout]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const syncUrl = (nextPathway: string) => {
    const params = new URLSearchParams();
    params.set('pathway', nextPathway);
    router.replace(`/build?${params.toString()}`);
  };

  const stats = useMemo(() => {
    const map = new Map(gearList.map((g) => [g.slug, g]));
    return calcLoadoutStats(gearSlots, map);
  }, [gearSlots, gearList]);

  const statEntries = useMemo(
    () =>
      Object.entries(stats.stats).sort(([a], [b]) =>
        statLabel(a).localeCompare(statLabel(b), 'zh'),
      ),
    [stats.stats],
  );

  const slotKeys = orderedSlots(gearSlots);

  const pathwayMeta = pathways.find((p) => p.slug === pathwaySlug);

  const runImport = () => {
    setImportError(null);
    setSaveError(null);
    try {
      const parsed = parseGameSharePaste(importDraft);
      const enriched = enrichImportWithSkills(parsed, skills, new Date().toISOString());
      setImported(enriched);
    } catch (e) {
      setImported(null);
      setImportError(e instanceof Error ? e.message : String(e));
    }
  };

  const clearImport = () => {
    setImportDraft('');
    setPlanTitle('');
    setImportError(null);
    setSaveError(null);
    setImported(null);
  };

  const saveToCodes = async () => {
    if (!imported || !importDraft.trim()) return;
    const name = planTitle.trim();
    if (!name) {
      setSaveError('请填写方案名称');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const created = await clientFetch<{ id: string; urlPath: string }>('/shares', {
        method: 'POST',
        body: JSON.stringify({
          pathwaySlug,
          scenarioCode,
          shareText: importDraft.trim(),
          title: name,
        }),
      });
      router.push(created.urlPath);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const pathwayDisplay =
    pathwayMeta?.professionLabel ?? pathwayMeta?.name ?? pathwaySlug;
  const pathwayRoute =
    pathwayMeta?.routeLabel ?? pathwayMeta?.name ?? pathwaySlug;

  return (
    <div className={`build-page ${loading ? 'build-loading' : ''}`}>
      <header className="build-page-header">
        <h1>配装工作台</h1>
        <div className="build-page-meta">
          <span className="build-badge">{pathwayDisplay}</span>
          <span className="build-badge build-badge-muted">{pathwayRoute}</span>
          {version ? (
            <span className="muted">
              数据 {version.semver}
              {version.verifiedAt
                ? ` · 核验 ${version.verifiedAt.slice(0, 10)}`
                : null}
            </span>
          ) : null}
        </div>
      </header>

      {error ? <div className="build-error">{error}</div> : null}

      <div className="build-toolbar">
        <label>
          途径
          <select
            value={pathwaySlug}
            onChange={(e) => {
              const v = e.target.value;
              setPathwaySlug(v);
              setInitialLoadoutSlug(undefined);
              syncUrl(v);
            }}
          >
            {pathways.length
              ? pathways.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.professionLabel}
                  </option>
                ))
              : (
                  <option value={pathwaySlug}>{pathwayDisplay}</option>
                )}
          </select>
        </label>
        <label>
          场景
          <select
            value={scenarioCode}
            onChange={(e) => {
              setScenarioCode(e.target.value);
              setInitialLoadoutSlug(undefined);
            }}
          >
            {scenarios.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="build-toolbar-actions">
          <button
            type="button"
            className="btn-ghost"
            disabled={!recommended}
            onClick={() => recommended && applyLoadout(recommended)}
          >
            恢复推荐
          </button>
          <button type="button" className="btn-ghost" onClick={() => void loadData()}>
            刷新数据
          </button>
        </div>
      </div>

      <div className="build-stack">
        <ImportViewPanel
          planTitle={planTitle}
          draft={importDraft}
          importError={importError}
          imported={imported}
          saveError={saveError}
          saving={saving}
          onPlanTitleChange={setPlanTitle}
          onDraftChange={setImportDraft}
          onImport={runImport}
          onSave={() => void saveToCodes()}
          onClear={clearImport}
        />

        {imported?.seals.length ? (
          <ImportedSealsPanel sealNames={imported.seals} />
        ) : null}

        <section className="build-panel">
          <h2>装备与属性</h2>
          {slotKeys.length === 0 ? (
            <p className="build-empty">
              当前途径暂无装备数据，可在 Git 中维护{' '}
              <code>gear/{pathwaySlug}.yaml</code> 后重新导入。
            </p>
          ) : (
            <>
              {slotKeys.map((slot) => (
                <div key={slot} className="gear-slot-row">
                  <span className="gear-slot-label">
                    {GEAR_SLOT_LABELS[slot] ?? slot}
                  </span>
                  <select
                    value={gearSlots[slot] ?? ''}
                    onChange={(e) =>
                      setGearSlots((prev) => ({
                        ...prev,
                        [slot]: e.target.value,
                      }))
                    }
                  >
                    {gearList
                      .filter((g) => g.slot === slot)
                      .map((g) => (
                        <option key={g.slug} value={g.slug}>
                          {g.name}
                        </option>
                      ))}
                  </select>
                </div>
              ))}
              {statEntries.length ? (
                <dl className="stat-grid">
                  {statEntries.map(([key, value]) => (
                    <div key={key} className="stat-item">
                      <dt>{statLabel(key)}</dt>
                      <dd>{formatStatValue(key, value)}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="build-empty">暂无属性汇总</p>
              )}
              {stats.warnings.length ? (
                <ul className="build-warnings">
                  {stats.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
