const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  CRC_TABLE[index] = value >>> 0;
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

export async function normalizeSpreadsheetXml(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const source = new Uint8Array(buffer);
  const entries = await readZip(source);
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let changed = false;
  const next = entries.map((entry) => {
    if (!entry.name.endsWith('.xml') && !entry.name.endsWith('.rels')) return entry;
    let xml = decoder.decode(entry.data).replace(/^\uFEFF/, '');
    if (xml.includes('<x:')) xml = xml.replace(/<(\/?)x:/g, '<$1');
    xml = xml.replace(/<tableParts\b[^>]*>[\s\S]*?<\/tableParts>/g, '');
    const stripped = xml;
    if (stripped === decoder.decode(entry.data)) return entry;
    changed = true;
    return { name: entry.name, data: encoder.encode(stripped) };
  });
  if (!changed) return buffer;
  return writeStoredZip(next).buffer as ArrayBuffer;
}

async function readZip(data: Uint8Array): Promise<ZipEntry[]> {
  const eocd = findEocd(data);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const count = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);
  const entries: ZipEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('模版无法读取');
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(data.subarray(cursor + 46, cursor + 46 + nameLength));
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = data.subarray(start, start + compressedSize);
    const bytes = method === 0 ? compressed : method === 8 ? await inflateRaw(compressed) : null;
    if (!bytes) throw new Error('模版无法读取');
    entries.push({ name, data: bytes });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function findEocd(data: Uint8Array): number {
  const min = Math.max(0, data.length - 22 - 65535);
  for (let index = data.length - 22; index >= min; index -= 1) {
    if (data[index] === 0x50 && data[index + 1] === 0x4b && data[index + 2] === 0x05 && data[index + 3] === 0x06) return index;
  }
  throw new Error('模版无法读取');
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function writeStoredZip(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, entry.data.length, true);
    localView.setUint32(22, entry.data.length, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);
    locals.push(local, entry.data);
    const record = new Uint8Array(46 + name.length);
    const recordView = new DataView(record.buffer);
    recordView.setUint32(0, 0x02014b50, true);
    recordView.setUint16(4, 20, true);
    recordView.setUint16(6, 20, true);
    recordView.setUint32(16, crc, true);
    recordView.setUint32(20, entry.data.length, true);
    recordView.setUint32(24, entry.data.length, true);
    recordView.setUint16(28, name.length, true);
    recordView.setUint32(42, offset, true);
    record.set(name, 46);
    central.push(record);
    offset += local.length + entry.data.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  const out = new Uint8Array(offset + centralSize + end.length);
  let cursor = 0;
  for (const part of locals) {
    out.set(part, cursor);
    cursor += part.length;
  }
  for (const part of central) {
    out.set(part, cursor);
    cursor += part.length;
  }
  out.set(end, cursor);
  return out;
}

function crc32(data: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of data) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}
