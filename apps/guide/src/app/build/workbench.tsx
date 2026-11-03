'use client';

import {
  parseGameSharePaste,
  type CurrentVersionDto,
  type GameShareImportView,
  type PathwayDto,
  type PlayScenarioDto,
  type SkillDto,
} from '@ocr/guide-types';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { apiBase } from '@/lib/api';
import { enrichImportWithSkills } from '@/lib/game-share';
import { ImportViewPanel } from './import-view-panel';
import { PuppetPicker, type PuppetChoice } from './puppet-picker';
import { orderSealNames, SealPicker, sealsFromPaste, type SealChoice } from './seal-picker';
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

export function BuildWorkbench({
  searchParams,
  puppets,
  seals,
}: {
  searchParams: Promise<{ pathway?: string; loadout?: string }>;
  puppets: PuppetChoice[];
  seals: SealChoice[];
}) {
  const router = useRouter();
  const [pathwaySlug, setPathwaySlug] = useState('sun');
  const [scenarioCode, setScenarioCode] = useState('PVE');
  const [pathways, setPathways] = useState<PathwayDto[]>([]);
  const [scenarios, setScenarios] = useState<PlayScenarioDto[]>([]);
  const [version, setVersion] = useState<CurrentVersionDto | null>(null);
  const [skills, setSkills] = useState<SkillDto[]>([]);
  const [planTitle, setPlanTitle] = useState('');
  const [importDraft, setImportDraft] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [imported, setImported] = useState<GameShareImportView | null>(null);
  const [selectedPuppets, setSelectedPuppets] = useState<string[]>([]);
  const [puppetHint, setPuppetHint] = useState<string | null>(null);
  const [selectedSeals, setSelectedSeals] = useState<string[]>([]);
  const [sealHint, setSealHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void searchParams.then((sp) => {
      if (sp.pathway) setPathwaySlug(sp.pathway);
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

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const skillRows = await clientFetch<SkillDto[]>(
        `/skills?pathway=${encodeURIComponent(pathwaySlug)}`,
      );
      setSkills(skillRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [pathwaySlug]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const syncUrl = (nextPathway: string) => {
    const params = new URLSearchParams();
    params.set('pathway', nextPathway);
    router.replace(`/build?${params.toString()}`);
  };

  const pathwayMeta = pathways.find((p) => p.slug === pathwaySlug);

  const runImport = () => {
    setImportError(null);
    setSaveError(null);
    try {
      const parsed = parseGameSharePaste(importDraft);
      const enriched = enrichImportWithSkills(parsed, skills, new Date().toISOString());
      const picked = sealsFromPaste(enriched.seals, seals);
      setImported(enriched);
      setSelectedSeals(picked.selected);
      setSealHint(picked.hint);
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
    setSelectedPuppets([]);
    setPuppetHint(null);
    setSelectedSeals([]);
    setSealHint(null);
  };

  const togglePuppet = (name: string) => {
    setSelectedPuppets((prev) => {
      if (prev.includes(name)) {
        setPuppetHint(null);
        return prev.filter((item) => item !== name);
      }
      if (prev.length >= 3) {
        setPuppetHint('已选满 3 个');
        return prev;
      }
      setPuppetHint(null);
      return [...prev, name];
    });
  };

  const toggleSeal = (name: string) => {
    const item = seals.find((seal) => seal.name === name);
    if (!item) return;
    setSelectedSeals((prev) => {
      if (prev.includes(name)) {
        setSealHint(null);
        return orderSealNames(
          prev.filter((selected) => selected !== name),
          seals,
        );
      }
      const replaced = prev.some((selected) => {
        const other = seals.find((seal) => seal.name === selected);
        return other?.category === item.category;
      });
      setSealHint(replaced ? `已换掉原来的${item.categoryLabel}封印物` : null);
      return orderSealNames(
        [
          ...prev.filter((selected) => {
            const other = seals.find((seal) => seal.name === selected);
            return other?.category !== item.category;
          }),
          name,
        ],
        seals,
      );
    });
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
          deployedPuppets: selectedPuppets,
          deployedSeals: selectedSeals,
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
          onPlanTitleChange={setPlanTitle}
          onDraftChange={setImportDraft}
          onImport={runImport}
          onClear={clearImport}
        />

        {imported ? (
          <PuppetPicker
            puppets={puppets}
            selected={selectedPuppets}
            hint={puppetHint}
            onToggle={togglePuppet}
          />
        ) : null}

        {imported ? (
          <SealPicker
            seals={seals}
            selected={selectedSeals}
            hint={sealHint}
            onToggle={toggleSeal}
          />
        ) : null}

        <div className="build-save-bar">
          {saveError ? <div className="build-error import-error">{saveError}</div> : null}
          <button
            type="button"
            className="btn-primary"
            disabled={!imported || saving || !planTitle.trim()}
            onClick={() => void saveToCodes()}
          >
            {saving ? '保存中…' : '保存到连招码'}
          </button>
        </div>
      </div>
    </div>
  );
}
