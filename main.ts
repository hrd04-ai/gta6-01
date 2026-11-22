// Palmera Bay: Sunset Heat — the entry program (Node 22, stdlib only).
//
// The game itself is plain static files under game/ (game/index.html and
// its ES modules, no library, no network request). This program hands it
// in: it copies game/ and screenshots/ from beside this file into the
// output directory and writes /output/dossier.json — the summary the
// judge reads — with the vendored make.fun library.
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// In the grader's container MAKEFUN_OUTPUT_DIR is unset and /output is
// used instead. The program runs twice and must write identical bytes.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root is the directory holding this file.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Never remove the output directory itself: in the grader /output is a
// mounted volume, and removing a mount point throws (Device or resource
// busy). The directory starts empty there, and every file below is
// overwritten on each run, so just ensure it exists.
mkdirSync(outputDir, { recursive: true });

cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });

const shotsDir = join(repoRoot, 'screenshots');
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
}

// The gate's own caps, from the competition kit: the dossier text is
// capped at 160 KiB, screenshots at 4 files of 256 KiB, and game/ at
// 993 entries / 48 MiB with no path over 1000 bytes. buildDossier
// enforces them and refuses an entry the scorer would refuse.
const dossierText = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(outputDir, 'dossier.json'), dossierText);
console.log(`Palmera Bay: Sunset Heat handed in to ${outputDir}`);
