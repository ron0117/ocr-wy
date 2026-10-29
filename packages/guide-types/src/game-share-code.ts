/** 游戏内方案分享码：8 字节头 + MessagePack + 零填充，再按 4 字节 Base62 块编码 */

export const GAME_SHARE_BASE62_ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** 样本头部；完整校验算法未确认，生成码能否被游戏导入需实测 */
export const GAME_SHARE_DEFAULT_HEADER_HEX = '395e5c4f00000000';

export type GameShareSkillEntry = {
  externalId: string;
  name: string;
  /** 技能栏位序号（游戏内配置值，如 1、17、20） */
  barSlot: number;
};

export type GameShareSealEntry = {
  name: string;
  /** 游戏内封印物 ID，缺省则不入包 */
  externalId?: number;
};

export type GameShareAwakeningGroup = {
  /** 如「龙威」 */
  label: string;
  names: string[];
};

export type GameShareFormatInput = {
  sharerName: string;
  pathwayExternalId: string;
  planTitle?: string;
  skills: GameShareSkillEntry[];
  seals: GameShareSealEntry[];
  awakening?: GameShareAwakeningGroup[];
  assistLabel?: string;
};

type MsgValue =
  | string
  | number
  | boolean
  | null
  | MsgValue[]
  | { [key: string]: MsgValue };

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.replace(/\s/g, '');
  if (normalized.length % 2 !== 0) {
    throw new Error('invalid hex');
  }
  const out = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset]! << 24) |
      (bytes[offset + 1]! << 16) |
      (bytes[offset + 2]! << 8) |
      bytes[offset + 3]!) >>>
    0
  );
}

function encodeBase62Uint32(value: number): string {
  let v = value >>> 0;
  let out = '';
  for (let i = 0; i < 6; i++) {
    out = GAME_SHARE_BASE62_ALPHABET[v % 62]! + out;
    v = Math.floor(v / 62);
  }
  return out;
}

function packMsgValue(value: MsgValue, chunks: number[]): void {
  if (value === null) {
    chunks.push(0xc0);
    return;
  }
  if (typeof value === 'boolean') {
    chunks.push(value ? 0xc3 : 0xc2);
    return;
  }
  if (typeof value === 'number' && Number.isInteger(value)) {
    if (value >= 0 && value <= 0x7f) {
      chunks.push(value);
      return;
    }
    if (value >= -32 && value <= -1) {
      chunks.push(0xe0 | (value + 32));
      return;
    }
    if (value >= 0 && value <= 0xffff) {
      chunks.push(0xcd, (value >> 8) & 0xff, value & 0xff);
      return;
    }
    if (value >= 0 && value <= 0xffffffff) {
      chunks.push(
        0xce,
        (value >>> 24) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 8) & 0xff,
        value & 0xff,
      );
      return;
    }
    const buf = new ArrayBuffer(8);
    new DataView(buf).setBigInt64(0, BigInt(value), false);
    chunks.push(0xd3, ...new Uint8Array(buf));
    return;
  }
  if (typeof value === 'string') {
    const utf8 = new TextEncoder().encode(value);
    if (utf8.length <= 0x1f) {
      chunks.push(0xa0 | utf8.length, ...utf8);
    } else if (utf8.length <= 0xff) {
      chunks.push(0xd9, utf8.length, ...utf8);
    } else if (utf8.length <= 0xffff) {
      chunks.push(0xda, (utf8.length >> 8) & 0xff, utf8.length & 0xff, ...utf8);
    } else {
      chunks.push(
        0xdb,
        (utf8.length >>> 24) & 0xff,
        (utf8.length >>> 16) & 0xff,
        (utf8.length >>> 8) & 0xff,
        utf8.length & 0xff,
        ...utf8,
      );
    }
    return;
  }
  if (Array.isArray(value)) {
    if (value.length <= 0x0f) {
      chunks.push(0x90 | value.length);
    } else if (value.length <= 0xffff) {
      chunks.push(0xdc, (value.length >> 8) & 0xff, value.length & 0xff);
    } else {
      chunks.push(
        0xdd,
        (value.length >>> 24) & 0xff,
        (value.length >>> 16) & 0xff,
        (value.length >>> 8) & 0xff,
        value.length & 0xff,
      );
    }
    for (const item of value) packMsgValue(item, chunks);
    return;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length <= 0x0f) {
      chunks.push(0x80 | keys.length);
    } else if (keys.length <= 0xffff) {
      chunks.push(0xde, (keys.length >> 8) & 0xff, keys.length & 0xff);
    } else {
      chunks.push(
        0xdf,
        (keys.length >>> 24) & 0xff,
        (keys.length >>> 16) & 0xff,
        (keys.length >>> 8) & 0xff,
        keys.length & 0xff,
      );
    }
    for (const key of keys) {
      packMsgValue(key, chunks);
      packMsgValue(value[key]!, chunks);
    }
  }
}

export function packMessageMap(payload: Record<string, MsgValue>): Uint8Array {
  const chunks: number[] = [];
  packMsgValue(payload, chunks);
  return new Uint8Array(chunks);
}

export function encodeGameShareCode(
  payload: Record<string, MsgValue>,
  headerHex: string = GAME_SHARE_DEFAULT_HEADER_HEX,
): string {
  const header = hexToBytes(headerHex);
  const body = packMessageMap(payload);
  const raw = new Uint8Array(header.length + body.length);
  raw.set(header, 0);
  raw.set(body, header.length);
  const paddedLen = Math.ceil(raw.length / 4) * 4;
  const padded = new Uint8Array(paddedLen);
  padded.set(raw);
  let out = '';
  for (let i = 0; i < padded.length; i += 4) {
    out += encodeBase62Uint32(readUint32BE(padded, i));
  }
  return out;
}

export function buildGameSharePayload(input: GameShareFormatInput): Record<string, MsgValue> {
  const skillMap: Record<string, number> = {};
  for (const s of input.skills) {
    skillMap[s.externalId] = s.barSlot;
  }
  const sealIds = input.seals
    .map((s) => s.externalId)
    .filter((id): id is number => typeof id === 'number' && Number.isFinite(id));

  const payload: Record<string, MsgValue> = {
    '1': input.sharerName,
    '2': Number.parseInt(input.pathwayExternalId, 10),
    '3': skillMap,
    '10': 0,
  };
  if (sealIds.length) payload['4'] = sealIds;
  if (input.planTitle?.trim()) payload['11'] = input.planTitle.trim();
  return payload;
}

export type DecodedGameSharePayload = Record<string, MsgValue>;

/** 一键辅助宏里单步动作（来自分享码键 `10.c`） */
export type GameShareAssistAction = {
  actionParam: number;
  actionName: number;
  /** 形如 86051090 的游戏技能 ID，非技能类参数则无 */
  externalId?: string;
  name: string;
};

export type GameShareAssistConfig = {
  shortName?: string;
  description?: string;
  macroIndex?: number;
  actions: GameShareAssistAction[];
};

export type GameShareImportView = {
  author: string;
  /** ISO 8601，由 UI 在导入成功时写入 */
  importedAt: string;
  planTitle?: string;
  pathwayExternalId?: number;
  /** 推荐方案栏位 map（键 `3`）；一键辅助分享通常为空 */
  skills: GameShareSkillEntry[];
  /** 按栏位排序后的连招展示名；一键辅助时为宏步骤名 */
  comboSteps: string[];
  seals: string[];
  awakening: GameShareAwakeningGroup[];
  assistLabel?: string;
  /** 键 `10` 为完整对象时的解析结果（v101 一键辅助分享） */
  assistConfig?: GameShareAssistConfig;
  /** 键 `13`，已知一键辅助分享为 101 */
  shareFormatVersion?: number;
  shareKind: 'loadout' | 'assist' | 'unknown';
  shareCode?: string;
};

class MsgUnpacker {
  private pos = 0;

  constructor(private readonly data: Uint8Array) {}

  private take(n: number): Uint8Array {
    const out = this.data.subarray(this.pos, this.pos + n);
    if (out.length !== n) throw new Error('分享码 MessagePack 不完整');
    this.pos += n;
    return out;
  }

  private u8(): number {
    return this.take(1)[0]!;
  }

  private u16be(): number {
    const b = this.take(2);
    return (b[0]! << 8) | b[1]!;
  }

  private u32be(): number {
    const b = this.take(4);
    return ((b[0]! << 24) | (b[1]! << 16) | (b[2]! << 8) | b[3]!) >>> 0;
  }

  private i8(): number {
    const v = this.u8();
    return v > 0x7f ? v - 256 : v;
  }

  private i16be(): number {
    const v = this.u16be();
    return v > 0x7fff ? v - 0x10000 : v;
  }

  private i32be(): number {
    return this.u32be() | 0;
  }

  private i64be(): number {
    const b = this.take(8);
    let v = 0n;
    for (let i = 0; i < 8; i++) v = (v << 8n) | BigInt(b[i]!);
    return Number(v);
  }

  private f32be(): number {
    const buf = this.take(4);
    return new DataView(buf.buffer, buf.byteOffset, 4).getFloat32(0, false);
  }

  private f64be(): number {
    const buf = this.take(8);
    return new DataView(buf.buffer, buf.byteOffset, 8).getFloat64(0, false);
  }

  obj(): MsgValue {
    const c = this.u8();
    if (c <= 0x7f) return c;
    if (c >= 0xe0) return c - 256;
    if (c >= 0x80 && c <= 0x8f) {
      const len = c & 0x0f;
      const out: Record<string, MsgValue> = {};
      for (let i = 0; i < len; i++) {
        const k = this.obj();
        out[String(k)] = this.obj();
      }
      return out;
    }
    if (c >= 0x90 && c <= 0x9f) {
      const len = c & 0x0f;
      return Array.from({ length: len }, () => this.obj());
    }
    if (c >= 0xa0 && c <= 0xbf) {
      return new TextDecoder().decode(this.take(c & 0x1f));
    }
    if (c === 0xc0) return null;
    if (c === 0xc2) return false;
    if (c === 0xc3) return true;
    if (c === 0xc4) {
      this.take(this.u8());
      throw new Error('分享码含未支持的二进制字段');
    }
    if (c === 0xc5) {
      this.take(this.u16be());
      throw new Error('分享码含未支持的二进制字段');
    }
    if (c === 0xc6) {
      this.take(this.u32be());
      throw new Error('分享码含未支持的二进制字段');
    }
    if (c === 0xca) return this.f32be();
    if (c === 0xcb) return this.f64be();
    if (c === 0xcc) return this.u8();
    if (c === 0xcd) return this.u16be();
    if (c === 0xce) return this.u32be();
    if (c === 0xcf) return this.i64be();
    if (c === 0xd0) return this.i8();
    if (c === 0xd1) return this.i16be();
    if (c === 0xd2) return this.i32be();
    if (c === 0xd3) return this.i64be();
    if (c === 0xd9) return new TextDecoder().decode(this.take(this.u8()));
    if (c === 0xda) return new TextDecoder().decode(this.take(this.u16be()));
    if (c === 0xdb) return new TextDecoder().decode(this.take(this.u32be()));
    if (c === 0xdc) {
      const len = this.u16be();
      return Array.from({ length: len }, () => this.obj());
    }
    if (c === 0xdd) {
      const len = this.u32be();
      return Array.from({ length: len }, () => this.obj());
    }
    if (c === 0xde) {
      const len = this.u16be();
      const out: Record<string, MsgValue> = {};
      for (let i = 0; i < len; i++) {
        const k = this.obj();
        out[String(k)] = this.obj();
      }
      return out;
    }
    if (c === 0xdf) {
      const len = this.u32be();
      const out: Record<string, MsgValue> = {};
      for (let i = 0; i < len; i++) {
        const k = this.obj();
        out[String(k)] = this.obj();
      }
      return out;
    }
    throw new Error(`不支持的 MessagePack 字节 0x${c.toString(16)}`);
  }
}

export function decodeBase62ShareCode(code: string): Uint8Array {
  const normalized = code.trim();
  if (!normalized || normalized.length % 6 !== 0) {
    throw new Error('分享码长度无效');
  }
  const out = new Uint8Array((normalized.length / 6) * 4);
  for (let i = 0; i < normalized.length; i += 6) {
    let value = 0;
    for (let j = 0; j < 6; j++) {
      const ch = normalized[i + j]!;
      const idx = GAME_SHARE_BASE62_ALPHABET.indexOf(ch);
      if (idx < 0) throw new Error('分享码含非法字符');
      value = value * 62 + idx;
    }
    if (value > 0xffffffff) throw new Error('分享码块超出 uint32');
    const offset = (i / 6) * 4;
    out[offset] = (value >>> 24) & 0xff;
    out[offset + 1] = (value >>> 16) & 0xff;
    out[offset + 2] = (value >>> 8) & 0xff;
    out[offset + 3] = value & 0xff;
  }
  return out;
}

export function decodeGameSharePayload(code: string): {
  headerHex: string;
  decoded: DecodedGameSharePayload;
} {
  const raw = decodeBase62ShareCode(code);
  if (raw.length < 9) throw new Error('分享码过短');
  const headerHex = [...raw.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const unpacker = new MsgUnpacker(raw.slice(8));
  const decoded = unpacker.obj() as DecodedGameSharePayload;
  return { headerHex, decoded };
}

function splitCsvNames(line: string): string[] {
  return line
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const SKILL_LIKE_ACTION_PARAM_MIN = 80_000_000;

function isRecord(value: MsgValue): value is Record<string, MsgValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function actionParamLabel(actionParam: number): string {
  if (actionParam >= SKILL_LIKE_ACTION_PARAM_MIN) {
    return String(actionParam);
  }
  if (actionParam >= 1 && actionParam <= 99) {
    return `栏位 ${actionParam}`;
  }
  return `参数 ${actionParam}`;
}

/** 从键 `10` 的对象形态解析一键辅助宏（`10: 0` 预设引用无动作列表） */
export function parseAssistConfigFromField10(
  value: MsgValue | undefined,
): GameShareAssistConfig | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return undefined;
  if (!isRecord(value)) return undefined;

  const steps = value.c;
  if (!Array.isArray(steps)) return undefined;

  const actions: GameShareAssistAction[] = [];
  for (const item of steps) {
    if (!Array.isArray(item) || item.length === 0) continue;
    const head = item[0];
    if (!isRecord(head)) continue;
    const rawParam = head.ActionParam;
    const rawName = head.ActionName;
    const actionParam =
      typeof rawParam === 'number'
        ? rawParam
        : typeof rawParam === 'string'
          ? Number(rawParam)
          : NaN;
    if (!Number.isFinite(actionParam)) continue;
    const actionName =
      typeof rawName === 'number'
        ? rawName
        : typeof rawName === 'string'
          ? Number(rawName)
          : 0;

    const externalId =
      actionParam >= SKILL_LIKE_ACTION_PARAM_MIN
        ? String(Math.trunc(actionParam))
        : undefined;

    actions.push({
      actionParam: Math.trunc(actionParam),
      actionName: Number.isFinite(actionName) ? Math.trunc(actionName) : 0,
      externalId,
      name: externalId ?? actionParamLabel(Math.trunc(actionParam)),
    });
  }

  if (!actions.length) return undefined;

  return {
    shortName: typeof value.n === 'string' ? value.n : undefined,
    description: typeof value.d === 'string' ? value.d : undefined,
    macroIndex: typeof value.i === 'number' ? value.i : undefined,
    actions,
  };
}

function skillsFromDecodedMap(
  skillMap: Record<string, MsgValue>,
  textNames: string[],
): GameShareSkillEntry[] {
  const entries = Object.entries(skillMap)
    .map(([externalId, slot]) => ({
      externalId,
      barSlot: typeof slot === 'number' ? slot : Number(slot),
    }))
    .filter((e) => Number.isFinite(e.barSlot))
    .sort((a, b) => a.barSlot - b.barSlot);

  return entries.map((e, i) => ({
    externalId: e.externalId,
    barSlot: e.barSlot,
    name: textNames[i] ?? e.externalId,
  }));
}

/** 解析游戏聊天粘贴的整段分享文案 */
export function parseGameSharePaste(rawText: string): Omit<GameShareImportView, 'importedAt'> {
  const text = rawText.trim();
  if (!text) throw new Error('请先粘贴分享文案');

  const authorFromIntro = text.match(/来自【([^】]+)】/)?.[1]?.trim();
  const code = text.match(/\[\[([^\]]+)\]\]/)?.[1]?.trim();
  const skillLine = text.match(/^技能[：:]\s*(.+)$/m)?.[1]?.trim();
  const sealLine = text.match(/^封印物[：:]\s*(.+)$/m)?.[1]?.trim();
  const assistLabel = text.match(/^一键辅助[：:]\s*(.+)$/m)?.[1]?.trim();

  const awakening: GameShareAwakeningGroup[] = [];
  for (const m of text.matchAll(/觉醒[（(]([^）)]+)[）)]*[：:]\s*(.+)$/gm)) {
    awakening.push({ label: m[1]!.trim(), names: splitCsvNames(m[2]!) });
  }

  const textSkillNames = skillLine ? splitCsvNames(skillLine) : [];
  const seals = sealLine ? splitCsvNames(sealLine) : [];

  let decoded: DecodedGameSharePayload | undefined;
  let headerHex: string | undefined;
  if (code) {
    const result = decodeGameSharePayload(code);
    decoded = result.decoded;
    headerHex = result.headerHex;
  }

  const author =
    authorFromIntro ||
    (typeof decoded?.['1'] === 'string' ? decoded['1'] : '') ||
    '未知分享者';

  const pathwayExternalId =
    typeof decoded?.['2'] === 'number' ? decoded['2'] : undefined;

  const shareFormatVersion =
    typeof decoded?.['13'] === 'number' ? decoded['13'] : undefined;

  const assistConfig = parseAssistConfigFromField10(decoded?.['10']);

  let planTitle =
    typeof decoded?.['11'] === 'string' ? decoded['11'] : undefined;
  if (!planTitle?.trim() && assistConfig?.shortName) {
    planTitle = assistConfig.shortName;
  }

  let skills: GameShareSkillEntry[] = [];
  const skillMap = decoded?.['3'];
  if (skillMap && typeof skillMap === 'object' && !Array.isArray(skillMap)) {
    skills = skillsFromDecodedMap(skillMap as Record<string, MsgValue>, textSkillNames);
  } else if (textSkillNames.length) {
    skills = textSkillNames.map((name, i) => ({
      externalId: '',
      name,
      barSlot: i + 1,
    }));
  }

  const hasLoadout = skills.length > 0;
  const hasAssist = (assistConfig?.actions.length ?? 0) > 0;

  if (!hasLoadout && !hasAssist && !code) {
    throw new Error('未找到 [[分享码]] 或「技能：」行，无法解析');
  }
  if (code && !hasLoadout && !hasAssist) {
    throw new Error('分享码中未找到技能栏位（键 3）或一键辅助动作（键 10）');
  }

  let shareKind: GameShareImportView['shareKind'] = 'unknown';
  if (hasAssist && !hasLoadout) shareKind = 'assist';
  else if (hasLoadout) shareKind = 'loadout';

  const comboSteps = hasLoadout
    ? skills.map((s) => s.name)
    : hasAssist
      ? assistConfig!.actions.map((a) => a.name)
      : textSkillNames;

  return {
    author,
    planTitle,
    pathwayExternalId,
    skills,
    comboSteps,
    seals,
    awakening,
    assistLabel,
    assistConfig,
    shareFormatVersion,
    shareKind,
    shareCode: code,
  };
}

function enrichAssistActionName(
  action: GameShareAssistAction,
  externalIdToName: Map<string, string>,
): GameShareAssistAction {
  if (action.externalId) {
    return {
      ...action,
      name: externalIdToName.get(action.externalId) ?? action.name,
    };
  }
  return action;
}

export function enrichImportedSkills(
  view: GameShareImportView,
  externalIdToName: Map<string, string>,
): GameShareImportView {
  const skills = view.skills.map((s) => ({
    ...s,
    name: externalIdToName.get(s.externalId) ?? s.name,
  }));

  const assistConfig = view.assistConfig
    ? {
        ...view.assistConfig,
        actions: view.assistConfig.actions.map((a) =>
          enrichAssistActionName(a, externalIdToName),
        ),
      }
    : undefined;

  const comboSteps = skills.length
    ? skills.map((s) => s.name)
    : (assistConfig?.actions.map((a) => a.name) ?? view.comboSteps);

  return {
    ...view,
    skills,
    assistConfig,
    comboSteps,
  };
}

export function formatGameShareMessage(input: GameShareFormatInput): string {
  const code = encodeGameShareCode(buildGameSharePayload(input));
  const lines: string[] = [
    `复制该消息，在推荐方案界面右下角点击【导入】，一键使用来自【${input.sharerName}】的方案 。`,
    `[[${code}]]`,
  ];
  if (input.skills.length) {
    lines.push(`技能：${input.skills.map((s) => s.name).join(', ')}`);
  }
  if (input.seals.length) {
    lines.push(`封印物：${input.seals.map((s) => s.name).join(', ')}`);
  }
  for (const group of input.awakening ?? []) {
    if (!group.names.length) continue;
    lines.push(`觉醒（${group.label}）：${group.names.join(', ')}`);
  }
  if (input.assistLabel?.trim()) {
    lines.push(`一键辅助：${input.assistLabel.trim()}`);
  }
  return lines.join('\n');
}
