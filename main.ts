// Neon Coast Cover Studio — make.fun build entry point.
// Copies app/ and screenshots/ into the output directory and writes
// dossier.json using buildDossier from vendor/makefun-app.ts.
// Node 22, erasable TypeScript syntax only, Node stdlib only.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot: string = dirname(fileURLToPath(import.meta.url));
const outDir: string = process.env.MAKEFUN_OUTPUT_DIR || '/output';

const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

function copyDir(src: string, dest: string): void {
  if (!existsSync(src)) {
    throw new Error('missing source directory: ' + src);
  }
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
}

function main(): void {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  copyDir(join(repoRoot, 'app'), join(outDir, 'app'));
  copyDir(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'));
  const dossier: Uint8Array = buildDossier(repoRoot, caps);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log('wrote ' + join(outDir, 'dossier.json') + ' (' + dossier.length + ' bytes)');
}

main();
