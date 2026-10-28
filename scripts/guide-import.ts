import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import {
  GearRarity,
  GearSlot,
  ImportRunStatus,
  PrismaClient,
  SkillType,
} from '../apps/guide-api/src/generated/prisma';
import {
  PROFESSION_ID_TO_SLUG,
  skillSlugFromExternalId,
} from '../packages/guide-types/src/pathways';
import { requireGuideDatabaseUrl } from './load-guide-env';

requireGuideDatabaseUrl();

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(repoRoot, 'apps/guide-api/data');
const dryRun = process.argv.includes('--dry-run');

type Manifest = {
  gameVersion: string;
  verifiedAt: string;
  sourceNote: string;
  sourcesDir?: string;
  files?: string[];
};

function readYamlFile<T>(path: string): T {
  return parseYaml(readFileSync(path, 'utf8')) as T;
}

function parseGearSlot(raw: string): GearSlot {
  const upper = raw.toUpperCase();
  if (upper in GearSlot) return upper as GearSlot;
  throw new Error(`未知装备槽位: ${raw}`);
}

function parseRarity(raw: string): GearRarity {
  const upper = raw.toUpperCase();
  if (upper in GearRarity) return upper as GearRarity;
  throw new Error(`未知稀有度: ${raw}`);
}

async function main() {
  const manifestPath = join(dataDir, 'manifest.yaml');
  const manifest = readYamlFile<Manifest>(manifestPath);
  const sourcesDir = resolve(
    dataDir,
    manifest.sourcesDir ?? './sources',
  );
  const skillMetaPath = join(sourcesDir, 'skill_metadata.json');
  const skillNamesPath = join(sourcesDir, 'skill_names.json');

  if (!existsSync(skillMetaPath) || !existsSync(skillNamesPath)) {
    console.error('缺少解包 JSON:', skillMetaPath, skillNamesPath);
    process.exit(1);
  }

  const skillMeta = JSON.parse(readFileSync(skillMetaPath, 'utf8')) as {
    professions: Record<
      string,
      { name: string; skill_ids: number[]; icon_path?: string }
    >;
    skills: Record<string, { icon_path?: string; profession_ids?: number[] }>;
  };
  const skillNames = JSON.parse(readFileSync(skillNamesPath, 'utf8')) as Record<
    string,
    string
  >;

  const sunGear = readYamlFile<
    Array<{
      slug: string;
      name: string;
      slot: string;
      rarity: string;
      pathwaySlugs?: string[];
      baseStats: Record<string, number>;
      affixes?: Array<{ label: string; stats: Record<string, number> }>;
      sourceNote?: string;
      verifiedAt?: string;
    }>
  >(join(dataDir, 'gear/sun.yaml'));

  if (!sunGear.length) {
    console.error('门禁失败: gear/sun.yaml 至少 1 条装备');
    process.exit(1);
  }

  const scenarios = readYamlFile<Array<{ code: string; name: string }>>(
    join(dataDir, 'scenarios.yaml'),
  );
  const loadout = readYamlFile<{
    slug: string;
    title: string;
    pathwaySlug: string;
    scenarioCode?: string;
    gearSlots: Record<string, string>;
    skillBar?: string[];
    comboSteps: Array<{ skillSlug: string; label?: string }>;
    sourceNote?: string;
    verifiedAt?: string;
  }>(join(dataDir, 'loadouts/sun-pve.yaml'));

  const manifestHash = createHash('sha256')
    .update(readFileSync(manifestPath))
    .digest('hex')
    .slice(0, 16);

  const verifiedAt = new Date(manifest.verifiedAt);
  const counts = {
    pathways: Object.keys(skillMeta.professions).length,
    skills: 0,
    scenarios: scenarios.length,
    gear: sunGear.length,
    loadouts: 1,
  };

  console.log(
    dryRun ? '[dry-run] 校验通过，将写入:' : '导入中…',
    counts,
    'version',
    manifest.gameVersion,
  );

  if (dryRun) {
    process.exit(0);
  }

  const prisma = new PrismaClient();
  const startedAt = new Date();
  let versionId = '';

  try {
    await prisma.$transaction(async (tx) => {
      await tx.gameVersion.updateMany({ data: { isCurrent: false } });
      const version = await tx.gameVersion.create({
        data: {
          semver: manifest.gameVersion,
          label: manifest.sourceNote,
          isCurrent: true,
        },
      });
      versionId = version.id;

      const pathwayIdBySlug = new Map<string, string>();
      let sortOrder = 0;
      for (const [externalId, prof] of Object.entries(skillMeta.professions)) {
        const slug = PROFESSION_ID_TO_SLUG[externalId];
        if (!slug) {
          throw new Error(`未映射途径 id: ${externalId}`);
        }
        const pathway = await tx.pathway.create({
          data: {
            versionId: version.id,
            externalId,
            slug,
            name: prof.name,
            sortOrder: sortOrder++,
            sourceNote: manifest.sourceNote,
            verifiedAt,
          },
        });
        pathwayIdBySlug.set(slug, pathway.id);

        for (const skillId of prof.skill_ids) {
          const key = String(skillId);
          const meta = skillMeta.skills[key];
          if (!meta) continue;
          const name = skillNames[key] ?? `技能 ${key}`;
          await tx.skill.create({
            data: {
              versionId: version.id,
              externalId: key,
              slug: skillSlugFromExternalId(key),
              name,
              pathwayId: pathway.id,
              skillType: SkillType.UNKNOWN,
              iconRef: meta.icon_path ?? null,
              sourceNote: manifest.sourceNote,
              verifiedAt,
            },
          });
          counts.skills += 1;
        }
      }

      const scenarioIdByCode = new Map<string, string>();
      for (const scenario of scenarios) {
        const row = await tx.playScenario.create({
          data: {
            versionId: version.id,
            code: scenario.code,
            name: scenario.name,
            sourceNote: manifest.sourceNote,
            verifiedAt,
          },
        });
        scenarioIdByCode.set(scenario.code, row.id);
      }

      for (const item of sunGear) {
        await tx.gear.create({
          data: {
            versionId: version.id,
            slug: item.slug,
            name: item.name,
            slot: parseGearSlot(item.slot),
            rarity: parseRarity(item.rarity),
            baseStats: item.baseStats,
            affixes: item.affixes ?? [],
            restrictions: item.pathwaySlugs
              ? { pathwaySlugs: item.pathwaySlugs }
              : undefined,
            sourceNote: item.sourceNote ?? manifest.sourceNote,
            verifiedAt: item.verifiedAt
              ? new Date(item.verifiedAt)
              : verifiedAt,
          },
        });
      }

      const pathwayId = pathwayIdBySlug.get(loadout.pathwaySlug);
      if (!pathwayId) {
        throw new Error(`loadout 途径不存在: ${loadout.pathwaySlug}`);
      }
      const scenarioId = loadout.scenarioCode
        ? scenarioIdByCode.get(loadout.scenarioCode)
        : undefined;

      await tx.recommendedLoadout.create({
        data: {
          versionId: version.id,
          slug: loadout.slug,
          title: loadout.title,
          pathwayId,
          scenarioId,
          gearSlots: loadout.gearSlots,
          skillBar: loadout.skillBar ?? [],
          comboSteps: loadout.comboSteps,
          sourceNote: loadout.sourceNote ?? manifest.sourceNote,
          verifiedAt: loadout.verifiedAt
            ? new Date(loadout.verifiedAt)
            : verifiedAt,
        },
      });

      await tx.importRun.create({
        data: {
          versionId: version.id,
          manifestHash,
          gameVersion: manifest.gameVersion,
          status: ImportRunStatus.SUCCESS,
          finishedAt: new Date(),
          log: JSON.stringify(counts),
        },
      });
    });

    console.log('导入成功', counts);
  } catch (error) {
    console.error('导入失败', error);
    await prisma.importRun.create({
      data: {
        versionId: versionId || undefined,
        manifestHash,
        gameVersion: manifest.gameVersion,
        status: ImportRunStatus.FAILED,
        startedAt,
        finishedAt: new Date(),
        log: String(error),
      },
    });
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
