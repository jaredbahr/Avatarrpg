#!/usr/bin/env node
/**
 * Cuts the streamed music loops from the masters (ADR 0108).
 *
 *   node scripts/audio/music-loops.mjs [--check] [id ...]
 *
 * audio/source/music/<master>.mp3 --cut at loops.json's bar starts, with a short crossfade at the
 * seam--> a seamless loop --loudness-normalised to -16 LUFS--> AAC-LC in .m4a, 96 kbps stereo, 48 kHz,
 * moov first for streaming --> public/audio/music/<id>.m4a
 *
 * The seam: the loop is master[start, end), and its last CROSSFADE seconds fade into master[start -
 * CROSSFADE, start), the audio that really leads into `start`. So the end of the file runs on into its
 * own beginning exactly as the master does, and a player that jumps back from the last sample to the
 * first hears the downbeat at `start` arrive on time.
 *
 * Deterministic: bit-exact flags and no metadata, so the same masters and the same ffmpeg give the same
 * bytes. `--check` encodes to a temporary folder and fails if a shipped file differs. A different ffmpeg
 * build can encode different (equally good) bytes; then regenerate and commit, and say which ffmpeg made
 * them. A track whose master is not there yet is skipped with a note (and fails --check only if its
 * shipped loop exists without a master).
 *
 * Needs ffmpeg on the PATH. Loop points come from scripts/audio/find-loop.py.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE = join(root, 'audio/source/music');
const OUT = join(root, 'public/audio/music');
const RATE = 48_000;
const CROSSFADE = 0.15;
const FRAME = 1024;
const TARGET_LUFS = -16;
const BITRATE = '96k';

const args = process.argv.slice(2);
const check = args.includes('--check');
const only = args.filter((a) => !a.startsWith('--'));
const { tracks } = JSON.parse(readFileSync(join(SOURCE, 'loops.json'), 'utf8'));

function ffmpeg(argv) {
  return execFileSync('ffmpeg', ['-hide_banner', '-nostdin', ...argv], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 26,
  });
}

/** The filter graph that makes the loop, ending in [loop]. */
function loopGraph(track) {
  const s = Math.round(track.start * RATE);
  // AAC codes 1024-sample frames. A loop that is not a whole number of them is padded with silence
  // at the end, which a looping player plays as a gap, so the length is rounded to whole frames: the
  // end moves by at most 512 samples (10.7 ms), well inside the beat grid's own accuracy.
  const e = s + Math.round((track.end - track.start) * (RATE / FRAME)) * FRAME;
  const x = Math.round(CROSSFADE * RATE);
  if (s < x || e <= s + x)
    throw new Error(`${track.id}: loop points leave no room for the crossfade`);
  // ffmpeg's acrossfade refuses a second input no longer than the fade, so the seam is mixed by hand.
  const trim = (from, to, label) =>
    `[${label}]atrim=start_sample=${from}:end_sample=${to},asetpts=PTS-STARTPTS`;
  return (
    `[0:a]aresample=${RATE},asplit=3[m1][m2][m3];` +
    `${trim(s, e - x, 'm1')}[body];` +
    `${trim(e - x, e, 'm2')},afade=t=out:ns=${x}:curve=tri[tail];` +
    `${trim(s - x, s, 'm3')},afade=t=in:ns=${x}:curve=tri[lead];` +
    `[tail][lead]amix=inputs=2:normalize=0:duration=shortest[seam];` +
    `[body][seam]concat=n=2:v=0:a=1[loop]`
  );
}

function loudness(master, track) {
  const run = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-nostdin',
      '-i',
      master,
      '-filter_complex',
      `${loopGraph(track)};[loop]loudnorm=I=${TARGET_LUFS}:print_format=json[out]`,
      '-map',
      '[out]',
      '-f',
      'null',
      '-',
    ],
    { encoding: 'utf8', maxBuffer: 1 << 26 },
  );
  // loudnorm prints its measurement as the last JSON object on stderr.
  const err = run.stderr ?? '';
  const json = err.slice(err.lastIndexOf('{'), err.lastIndexOf('}') + 1);
  if (run.status !== 0 || !json) throw new Error(`${track.id}: measuring failed\n${err}`);
  const { input_i: i, input_tp: tp } = JSON.parse(json);
  return { i: Number(i), tp: Number(tp) };
}

function encode(master, track, target) {
  const { i, tp } = loudness(master, track);
  // A plain gain, never a dynamic normaliser: the loop must sound like the master. Rounded so a
  // measurement wobble in the last digit cannot change the bytes.
  const gain = Math.round((TARGET_LUFS - i) * 10) / 10;
  if (tp + gain > -1)
    throw new Error(
      `${track.id}: ${gain} dB of gain would push the true peak to ${tp + gain} dBTP`,
    );
  ffmpeg([
    '-y',
    '-v',
    'error',
    '-i',
    master,
    '-filter_complex',
    `${loopGraph(track)};[loop]volume=${gain}dB[out]`,
    '-map',
    '[out]',
    '-map_metadata',
    '-1',
    '-fflags',
    '+bitexact',
    '-flags:a',
    '+bitexact',
    '-c:a',
    'aac',
    '-b:a',
    BITRATE,
    '-ar',
    String(RATE),
    '-ac',
    '2',
    '-movflags',
    '+faststart',
    target,
  ]);
  return { i, tp, gain };
}

let failed = false;
const scratch = check ? mkdtempSync(join(tmpdir(), 'music-loops-')) : null;
if (!check) mkdirSync(OUT, { recursive: true });
try {
  for (const track of tracks) {
    if (only.length && !only.includes(track.id)) continue;
    const master = join(SOURCE, track.master);
    const shipped = join(OUT, `${track.id}.m4a`);
    if (!existsSync(master)) {
      console.log(`  skip ${track.id}: ${track.master} is not in audio/source/music yet`);
      if (check && existsSync(shipped)) {
        console.error(`  ${track.id}.m4a ships without its master`);
        failed = true;
      }
      continue;
    }
    const target = scratch ? join(scratch, `${track.id}.m4a`) : shipped;
    const { i, tp, gain } = encode(master, track, target);
    const seconds = (track.end - track.start).toFixed(3);
    if (scratch) {
      const same = existsSync(shipped) && readFileSync(shipped).equals(readFileSync(target));
      if (!same) failed = true;
      console.log(`  ${same ? 'ok  ' : 'DIFF'} ${track.id}.m4a`);
    } else {
      console.log(
        `  ${track.id}.m4a  ${seconds} s loop  ${i} LUFS -> ${gain >= 0 ? '+' : ''}${gain} dB  (peak ${tp} dBTP)`,
      );
    }
  }
} finally {
  if (scratch) rmSync(scratch, { recursive: true, force: true });
}
if (failed) {
  console.error(
    check
      ? '\nThe shipped music loops are not what the masters make. Run node scripts/audio/music-loops.mjs.'
      : '',
  );
  process.exit(1);
}
