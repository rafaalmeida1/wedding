#!/usr/bin/env node
/**
 * Cria symlinks `node` em cada `node_modules/.bin/` do monorepo apontando para
 * o binário Node atual (`process.execPath`).
 *
 * Por que: shells wrappers como `node_modules/.bin/tsx` fazem
 *   if [ -x "$basedir/node" ]; then exec "$basedir/node" ...
 *   else exec node ...
 *
 * Em ambientes onde o `node` não está no PATH herdado pelo /bin/sh (ex: WSL com
 * Cursor server, onde Node fica apenas em ~/.cursor-server/bin/.../node), a
 * segunda branch falha com "node: not found". Colocando um symlink em
 * `node_modules/.bin/node`, o wrapper usa o ramo direto e o problema some.
 *
 * Roda como postinstall do workspace root.
 */

import { existsSync, mkdirSync, readdirSync, statSync, symlinkSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nodeBinary = process.execPath;

const targets = [
  'node_modules/.bin',
  'apps/api/node_modules/.bin',
  'apps/web/node_modules/.bin',
  'apps/workers/node_modules/.bin',
  'packages/db/node_modules/.bin',
  'packages/shared/node_modules/.bin',
];

for (const rel of targets) {
  const dir = join(repoRoot, rel);
  if (!existsSync(dir)) continue;
  const link = join(dir, 'node');
  try {
    if (existsSync(link)) {
      const current = statSync(link);
      if (current.isSymbolicLink?.() || current.isFile()) {
        unlinkSync(link);
      }
    }
    symlinkSync(nodeBinary, link);
    console.log(`[link-node-bin] ${rel}/node -> ${nodeBinary}`);
  } catch (err) {
    console.warn(`[link-node-bin] failed for ${rel}:`, err.message);
  }
}
