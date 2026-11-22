// Token Radar v2 (token-radar-01): a pre-token protocol radar whose every
// number is fitted on the sealed snapshot and validated held-out, twice.
//
// Reads the snapshot from /input/snapshot.json (or --input <file|dir>), fits
// the value model in lib/model.ts on the snapshot's tokenised peers, ranks
// every protocol that records no token, writes the board to
// /output/board.json and the dashboard's data to /output/data.js, copies
// dashboard/ and screenshots/ into /output, and writes /output/dossier.json
// last with the vendored make.fun library — the summary the judge reads.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's own caps: the text cap shapes the bytes, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** --name <value> out of the arguments, or the fallback. */
function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

const inputArg = arg('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar v2: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) {
  process.stderr.write(`token radar v2: the model wrote a board the gate refuses: ${issue}\n`);
  process.exit(1);
}
// The integrity strip promises a full account of the snapshot; a build that
// cannot keep that promise must fail here, not ship a quiet gap.
if (radar.coverage.unaccounted !== 0 || radar.coverage.watchlist_on_board !== radar.coverage.watchlist_total) {
  process.stderr.write(
    `token radar v2: coverage account broken: ${radar.coverage.unaccounted} unaccounted, watchlist ${radar.coverage.watchlist_on_board}/${radar.coverage.watchlist_total}\n`,
  );
  process.exit(1);
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), dataScript(radar));

/** Copy one directory's regular files into `to`, skipping dotfiles. */
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));
const shots = copyFiles(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length < 3) {
  process.stderr.write(`token radar v2: screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view\n`);
  process.exit(1);
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) {
    process.stderr.write(`token radar v2: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`);
    process.exit(1);
  }
}

// The dossier is written last: the scorer rebuilds it from this /output and
// compares bytes, so nothing may be written into /output after this line.
writeFileSync(join(out, 'dossier.json'), buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));

const cov = radar.coverage;
process.stdout.write(
  `token radar v2: ${cov.snapshot_total} protocols accounted for (${cov.board_rows} launch candidates ranked, ${cov.live_annex} live in the annex, ${cov.launch_test_excluded} set aside by the launch test, ${cov.unaccounted} unaccounted); watchlist ${cov.watchlist_on_board}/${cov.watchlist_total}\n` +
    `token radar v2: model fitted on ${radar.fit_summary.fitted_on} peers; validation: ${radar.validation.map((v) => `${v.scheme.split(' (')[0]} tested ${v.tested}, median error ${v.median_abs_log10_error.toFixed(3)} log10, ${v.within_2x_pct}% within 2x`).join('; ')}\n` +
    `token radar v2: wrote board.json, data.js, dashboard/, screenshots/ (${shots.length} images) and dossier.json under ${out}\n`,
);
