// Lumen Harvest — best-game-01 entry program (Node 22, standard library only).
//
// What it does: it hands the game in. The playable game lives in this
// repository under game/ (plain static files: game/index.html plus its ES
// modules, no build step, no network request at run time) and the maker's
// screenshots live under screenshots/. This program copies both trees into
// the output directory and writes /output/dossier.json there with the
// vendored make.fun library, which is the summary the judge reads.
//
// Where the output goes: the grader hands the program a writable /output.
// When run anywhere else, MAKEFUN_OUTPUT_DIR stands in for it:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The run is deterministic: the same repository always writes the same
// bytes, so the grader's two runs agree byte for byte.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root: the directory this file sits in.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));

// The grader's output directory, or the local stand-in.
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The caps the bounty's scorer applies (its reference/gate.json). Passing
// them to buildDossier makes this program refuse exactly where the scorer
// would, instead of handing in an entry the gate rejects: at most 4
// screenshots of 256 KiB, at most 993 files and directories in game/ at
// 48 MiB in all, no path under game/ over 1000 bytes, and the dossier's
// text capped at 160 KiB.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function copyTree(sourceDir, targetDir) {
  mkdirSync(targetDir, { recursive: true });
  cpSync(sourceDir, targetDir, { recursive: true });
}

function main() {
  mkdirSync(outputDir, { recursive: true });

  // Start from a clean output directory so a stale file from an earlier
  // run can never leak into this one.
  rmSync(join(outputDir, 'game'), { recursive: true, force: true });
  rmSync(join(outputDir, 'screenshots'), { recursive: true, force: true });
  rmSync(join(outputDir, 'dossier.json'), { force: true });

  copyTree(join(repoRoot, 'game'), join(outputDir, 'game'));
  if (existsSync(join(repoRoot, 'screenshots'))) {
    copyTree(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'));
  }

  writeFileSync(join(outputDir, 'dossier.json'), buildDossier(outputDir, DOSSIER_CAPS));
}

main();
