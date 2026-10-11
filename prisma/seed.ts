import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

function loadEnv(file: string) {
  const text = readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(resolve(process.cwd(), '../../.env'));

const prisma = new PrismaClient();
const schema = {
  fields: [
    { key: 'productName', label: '商品名称', type: 'string' },
    { key: 'price', label: '单价', type: 'decimal' },
    { key: 'quantity', label: '数量', type: 'decimal' },
    { key: 'unit', label: '单位', type: 'string' },
  ],
};

async function main() {
  const email = 'demo@example.com';
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: '演示用户',
      passwordHash: await bcrypt.hash('Demo123456', 10),
      disabled: true,
    },
  });

  await prisma.ocrTemplate.upsert({
    where: { userId_name: { userId: user.id, name: '商品采购清单' } },
    update: {},
    create: {
      userId: user.id,
      name: '商品采购清单',
      description: '提取商品名称、单价、数量和单位',
      prompt: '识别商品名称、单价、数量和单位，保留原始文字，不确定的字段留空',
      isDefault: true,
      schema,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
