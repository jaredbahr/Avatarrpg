/**
 * A new region is data (`docs/pipeline-proof-plan.md` §1): nothing in the app or the renderer may
 * key behaviour on one map or encounter by id, or the next region has to copy app code. Whatever a
 * map needs that is special goes on the map (`MapDef.soundscape`, `practice`, `arrivalShot`, #767)
 * or on its encounter.
 *
 * The allowlist below is what is left to move. It may only shrink: an entry that no longer
 * matches fails too, so a fix removes its line.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../content';

const ROOT = join(__dirname, '..', '..');

/** `file: id`. The guided first fight is the follow-up: its steps belong on the encounter. */
const ALLOWED = new Set([
  'src/app/scenes/combatGuidance.ts: forest_road',
  'src/app/scenes/combatGuidance.ts: enc_forest_road',
  'src/app/scenes/CombatScene.ts: enc_forest_road',
]);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.ts$/.test(entry) && !/\.test\.ts$/.test(entry) && !/\.d\.ts$/.test(entry)
      ? [path]
      : [];
  });
}

function literalHits(): string[] {
  const ids = new Set([...CONTENT.maps.keys(), ...CONTENT.encounters.keys()]);
  const hits = new Set<string>();
  for (const file of [...sources(join(ROOT, 'src/app')), ...sources(join(ROOT, 'src/render'))]) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/(['"`])([a-z0-9_]+)\1/g)) {
      const id = match[2];
      if (id && ids.has(id)) hits.add(`${relative(ROOT, file).split('\\').join('/')}: ${id}`);
    }
  }
  return [...hits].sort();
}

describe('no map or encounter ids in app or render code', () => {
  const hits = literalHits();

  it('finds none outside the allowlist', () => {
    expect(hits.filter((hit) => !ALLOWED.has(hit))).toEqual([]);
  });

  it('keeps the allowlist to what is still there', () => {
    expect([...ALLOWED].filter((entry) => !hits.includes(entry))).toEqual([]);
  });
});
