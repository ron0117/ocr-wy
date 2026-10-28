import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { requireGuideDatabaseUrl } from './load-guide-env';

requireGuideDatabaseUrl();

const root = resolve(import.meta.dirname, '..');
const prismaArgs = process.argv.slice(2);

const result = spawnSync('pnpm', ['exec', 'prisma', ...prismaArgs], {
  stdio: 'inherit',
  env: process.env,
  cwd: root,
  shell: true,
});

process.exit(result.status ?? 1);
