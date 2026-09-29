/**
 * Feel audit: which game events get a sound and a visual beat.
 *
 * Plays every demo encounter with the sim's autopilot, one turn at a time,
 * feeds each turn's events through the real `choreograph`, and attributes
 * what it laid out (sound cues, emitters, flashes, shakes, floaters, poses,
 * moves) to the event that caused it by diffing the choreography of the turn
 * up to and including that event against the one before it. Presentation
 * only: nothing here changes a rule.
 *
 * Run: node --import tsx scripts/diagnostics/feel-audit.ts [rate]
 */
import { CONTENT } from '../../src/content';
import { choreograph } from '../../src/app/anim/choreography';
import type { GameEvent, GameState, Unit } from '../../src/core/types';
import { RngCursor } from '../../src/core/rng';
import { apply } from '../../src/core/state/reducer';
import { createBattle, createGame } from '../../src/core/state/createGame';
import { STANDARD_PARTY } from '../../src/core/sim/runCombat';

const rate = Number(process.argv[2] ?? 1);
const ENCOUNTERS = ['enc_forest_road', 'enc_quarry_gate', 'enc_ambush', 'enc_grumbler'];

type Tally = { n: number; sounds: Map<string, number>; tracks: Map<string, number> };
const tally = new Map<string, Tally>();

function summary(events: readonly GameEvent[], before: readonly Unit[]) {
  const out = choreograph({
    content: CONTENT,
    events,
    unitsBefore: before,
    cursor: 0,
    rate,
    pushIndex: 0,
  });
  const tracks = new Map<string, number>();
  for (const t of out.tracks) tracks.set(t.kind, (tracks.get(t.kind) ?? 0) + 1);
  const sounds = new Map<string, number>();
  for (const s of out.sounds)
    sounds.set(
      s.key.startsWith('fx.') ? 'fx.*' : s.key,
      (sounds.get(s.key.startsWith('fx.') ? 'fx.*' : s.key) ?? 0) + 1,
    );
  return { tracks, sounds };
}

const add = (into: Map<string, number>, a: Map<string, number>, b: Map<string, number>) => {
  for (const [k, v] of a) {
    const d = v - (b.get(k) ?? 0);
    if (d > 0) into.set(k, (into.get(k) ?? 0) + d);
  }
};

for (const encounterId of ENCOUNTERS) {
  const seeded = createGame(CONTENT, {
    seed: `feel-${encounterId}`,
    party: STANDARD_PARTY.slice(0, 3).map((slot) => ({ ...slot, level: 3, autoChoose: true })),
    startNode: '',
  });
  const rng = new RngCursor(seeded.rng);
  const battle = createBattle(CONTENT, seeded, encounterId, rng, {});
  let state: GameState = {
    ...seeded,
    screen: 'combat',
    rng: rng.state,
    battle: {
      ...battle,
      units: battle.units.map((u) => (u.faction === 'party' ? { ...u, ai: 'aggressive' } : u)),
    },
  };
  let guard = 0;
  while (state.battle && state.battle.phase === 'active' && guard++ < 400) {
    const before = state.battle.units;
    const step = apply(CONTENT, state, { type: 'runAiTurn' });
    state = step.state;
    const events = step.events;
    for (let i = 0; i < events.length; i++) {
      const event = events[i]!;
      const key = event.type === 'damaged' && event.cause ? `damaged(${event.cause})` : event.type;
      const row = tally.get(key) ?? { n: 0, sounds: new Map(), tracks: new Map() };
      row.n++;
      const upTo = summary(events.slice(0, i + 1), before);
      const prior = summary(events.slice(0, i), before);
      add(row.sounds, upTo.sounds, prior.sounds);
      add(row.tracks, upTo.tracks, prior.tracks);
      tally.set(key, row);
    }
  }
}

const fmt = (m: Map<string, number>) => [...m].map(([k, v]) => `${k}×${v}`).join(' ') || '—';
console.log(`rate=${rate}`);
console.log('| event | count | sounds | tracks |');
console.log('| --- | ---: | --- | --- |');
for (const [key, row] of [...tally].sort((a, b) => b[1].n - a[1].n))
  console.log(`| ${key} | ${row.n} | ${fmt(row.sounds)} | ${fmt(row.tracks)} |`);
