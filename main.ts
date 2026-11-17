// Palmera Bay: Sunset Heat — the entry program (Node 22, standard library
// only). It hands the game in: copies game/ and screenshots/ from beside
// this file into the output directory and writes /output/dossier.json, the
// summary the judge reads, using the vendored make.fun library.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

function countFiles(dir) {
  let files = 0;
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = countFiles(full);
      files += sub.files;
      bytes += sub.bytes;
    } else if (entry.isFile()) {
      files += 1;
      bytes += statSync(full).size;
    }
  }
  return { files, bytes };
}

// A fresh output directory every run, so a stale file can never sneak in.
mkdirSync(outDir, { recursive: true });
cpSync(gameDir, join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
}

const gameStats = countFiles(gameDir);
const shotStats = existsSync(shotsDir) ? countFiles(shotsDir) : { files: 0, bytes: 0 };
console.log(`game/: ${gameStats.files} files, ${(gameStats.bytes / 1024).toFixed(0)} KiB`);
console.log(`screenshots/: ${shotStats.files} files, ${(shotStats.bytes / 1024).toFixed(1)} KiB`);

// The gate's caps (reference/gate.json): the text budget shapes the bytes;
// the rest refuse an entry the scorer would refuse — more than 4 shots or
// one over 256 KiB, more than 993 files in game/ or 48 MiB of game files,
// or a path under game/ longer than 1000 bytes. game/ counts beside
// /output's own 1000-entry cap, its screenshots/ and dossier.json.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`dossier.json written: ${(dossier.length / 1024).toFixed(1)} KiB`);
