/**
 * `schema.ts` against zod itself.
 *
 * The runtime validator promises zod's behaviour for the combinators it has, so
 * the test does not describe that behaviour a second time: it loads the real
 * save, fx, sound and tuning modules twice, once as shipped and once with zod
 * standing in for `schema.ts`, and holds the two to the same verdict, the same
 * parsed data (key order included, since a save is written back out) and the
 * same issue paths in the same order. `deserialize` names the first of those
 * paths to the player.
 *
 * The inputs are the authored content and a real mid-battle save, each
 * mutated a few thousand ways: fields dropped, retyped, pushed out of range,
 * extra keys added and arrays cut short or grown.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { CONTENT } from '../content';
import * as fxShipped from '../content/fx';
import * as soundsShipped from '../content/sounds';
import * as tuningShipped from '../content/tuning';
import { RngCursor } from './rng';
import * as saveShipped from './save/serialize';
import * as schemaShipped from './schema';
import { apply } from './state/reducer';
import { createBattle, createGame } from './state/createGame';
import type { GameState } from './types';

interface Parser {
  safeParse(
    value: unknown,
  ):
    | { success: true; data: unknown }
    | { success: false; error: { issues: readonly { path: readonly (string | number)[] }[] } };
}

interface Modules {
  save: typeof saveShipped;
  fx: typeof fxShipped;
  sounds: typeof soundsShipped;
  tuning: typeof tuningShipped;
}

let zodBuilt: Modules;

beforeAll(async () => {
  vi.resetModules();
  vi.doMock('./schema', () => ({ ...z }));
  zodBuilt = {
    save: await import('./save/serialize'),
    fx: await import('../content/fx'),
    sounds: await import('../content/sounds'),
    tuning: await import('../content/tuning'),
  };
  vi.doUnmock('./schema');
  vi.resetModules();
});

/** What a parse decided, in a form `toEqual` compares key order in too. */
function verdict(schema: Parser, value: unknown): unknown {
  const result = schema.safeParse(value);
  return result.success
    ? { ok: true, data: JSON.stringify(result.data), shape: result.data }
    : { ok: false, paths: result.error.issues.map((issue) => issue.path.join('.')) };
}

function expectSameVerdict(shipped: Parser, zod: Parser, value: unknown, label: string): boolean {
  const expected = verdict(zod, value);
  expect(verdict(shipped, value), label).toStrictEqual(expected);
  return (expected as { ok: boolean }).ok;
}

/* ------------------------------------------------------------------ */
/* Seeded mutations                                                    */
/* ------------------------------------------------------------------ */

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

type Container = Record<string, unknown> | unknown[];

function containers(value: unknown, out: Container[] = []): Container[] {
  if (typeof value !== 'object' || value === null) return out;
  out.push(value as Container);
  for (const child of Object.values(value)) containers(child, out);
  return out;
}

const REPLACEMENTS: readonly unknown[] = [
  undefined,
  null,
  0,
  -1,
  0.5,
  1,
  2,
  7,
  99999,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  '',
  'x',
  'fire',
  'particles',
  'voice',
  true,
  false,
  [],
  [1, 2],
  [1, 2, 3],
  {},
  { x: 1, y: 2 },
];

/** A deep copy with one thing changed: a key dropped, value swapped, key added, array resized or hole made. */
function mutate<T>(value: T, random: () => number): T {
  const copy = structuredClone(value);
  const all = containers(copy);
  const target = all[Math.floor(random() * all.length)];
  if (target === undefined) return copy;
  const pick = <V>(list: readonly V[]): V => list[Math.floor(random() * list.length)] as V;
  const keys = Object.keys(target);
  const roll = random();
  if (Array.isArray(target)) {
    if (roll < 0.2) target.length = Math.floor(random() * target.length);
    else if (roll < 0.35) target.push(structuredClone(target[0] ?? pick(REPLACEMENTS)));
    else if (roll < 0.5 && keys.length > 0) delete target[Number(pick(keys))];
    else if (keys.length > 0) target[Number(pick(keys))] = structuredClone(pick(REPLACEMENTS));
    return copy;
  }
  if (roll < 0.25 && keys.length > 0) delete target[pick(keys)];
  // '__proto__' is a no-op here (`target['__proto__'] = 1` runs the setter and adds
  // no own key); it stays in the pick list so the seeded sequence is unchanged.
  // The JSON.parse corpus cases cover a real own '__proto__' key.
  else if (roll < 0.35) target[pick(['extra', '__proto__', 'toString', 'kind'])] = 1;
  else if (keys.length > 0) target[pick(keys)] = structuredClone(pick(REPLACEMENTS));
  return copy;
}

function fuzz(shipped: Parser, zod: Parser, seeds: readonly unknown[], runs: number, seed: number) {
  const random = lcg(seed);
  for (const value of seeds) expectSameVerdict(shipped, zod, value, 'authored');
  let passed = 0;
  for (let n = 0; n < runs; n++) {
    let value = seeds[Math.floor(random() * seeds.length)];
    const depth = 1 + Math.floor(random() * 3);
    for (let d = 0; d < depth; d++) value = mutate(value, random);
    const label = `run ${n}: ${JSON.stringify(value)?.slice(0, 400)}`;
    if (expectSameVerdict(shipped, zod, value, label)) passed++;
  }
  // Neither side of the verdict may be starved, or the comparison proves little.
  expect(passed).toBeGreaterThan(runs * 0.02);
  expect(passed).toBeLessThan(runs * 0.98);
}

/* ------------------------------------------------------------------ */

function midBattleState(): GameState {
  const seeded = createGame(CONTENT, {
    seed: 'schema-differential',
    party: [
      { characterId: 'kaya', level: 2, autoChoose: true },
      { characterId: 'bo', level: 2, autoChoose: true },
    ],
    startNode: 'battle_quarry_gate',
    flags: { ruon_spared: true, act1_scouted: 3, quarry_password: 'lotus' },
  });
  const rng = new RngCursor(seeded.rng);
  const battle = createBattle(CONTENT, seeded, 'enc_quarry_gate', rng);
  let state: GameState = {
    ...seeded,
    screen: 'combat',
    rng: rng.state,
    battle: {
      ...battle,
      units: battle.units.map((unit) =>
        unit.faction === 'party' ? { ...unit, ai: 'aggressive' } : unit,
      ),
    },
  };
  for (let i = 0; i < 3 && state.battle?.phase === 'active'; i++) {
    state = apply(CONTENT, state, { type: 'runAiTurn' }).state;
  }
  return state;
}

const META = {
  label: 'Slot 1',
  summary: 'Test save',
  savedAt: 1_700_000_000_000,
  session: { players: [{ name: 'Lorelai', unitId: 'p0' }], soloPlay: false },
};

interface MutableLegacySave {
  format: number;
  summary?: unknown;
  state: {
    version: number;
    party: Record<string, unknown>[];
    battle: { units: Record<string, unknown>[] } | null;
    pendingChoices: Record<string, unknown>[];
    world?: Record<string, unknown>;
  };
}

function legacySaveFixtures(current: ReturnType<typeof saveShipped.toBlob>): unknown[] {
  const v4 = structuredClone(current) as unknown as MutableLegacySave;
  v4.format = 4;
  v4.state.version = 4;
  delete v4.state.world?.residentProfiles;
  delete v4.state.world?.runoff;

  const v3 = structuredClone(v4);
  v3.format = 3;
  v3.state.version = 3;
  delete v3.state.world?.clock;
  delete v3.state.world?.talk;

  const v2 = structuredClone(v3);
  v2.format = 2;
  v2.state.version = 2;
  delete v2.state.world;

  const v1 = structuredClone(v2);
  v1.format = 1;
  v1.state.version = 1;
  for (const unit of v1.state.party) delete unit.disciplineId;
  for (const unit of v1.state.battle?.units ?? []) delete unit.disciplineId;
  for (const choice of v1.state.pendingChoices) delete choice.kind;

  const v0 = structuredClone(v1);
  v0.format = 0;
  delete v0.summary;
  return [v0, v1, v2, v3, v4];
}

const MALFORMED_SAVE_CORPUS: readonly unknown[] = [
  null,
  [],
  {},
  { magic: 'some-other-game', format: 1 },
  { magic: 'four-nations-tactics', format: 99 },
  { magic: 'four-nations-tactics', format: Number.NaN },
  { magic: 'four-nations-tactics', format: 5, state: null },
  { magic: 'four-nations-tactics', format: 5, state: {} },
  { magic: 'four-nations-tactics', format: 5, summary: null },
];

describe('the runtime validator matches zod', () => {
  it('validates every array index, including sparse holes', () => {
    const sparse = new Array<string>(2);
    sparse[1] = 'present';
    expectSameVerdict(
      schemaShipped.array(schemaShipped.string()),
      z.array(z.string()),
      sparse,
      'sparse',
    );

    const nested = { values: ['present', 'also present'] };
    delete nested.values[1];
    expectSameVerdict(
      schemaShipped.object({ values: schemaShipped.array(schemaShipped.string()) }),
      z.object({ values: z.array(z.string()) }),
      nested,
      'nested sparse',
    );
  });

  it('names itself and renders the issues through its lazy message', () => {
    const schema = schemaShipped.object({
      party: schemaShipped.array(schemaShipped.object({ level: schemaShipped.number() })),
    });
    const parsed = schema.safeParse({ party: [{ level: 'low' }] });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const error = parsed.error;
    expect(error).toBeInstanceOf(schemaShipped.SchemaError);
    expect(error.name).toBe('SchemaError');
    expect(error.constructor.name).toBe('SchemaError');
    expect(error.stack).toContain('SchemaError');

    // `message` is a lazy getter over the issues, paths included; String(error)
    // is what a console prints and a stack trace is built from.
    expect(error.issues.map((issue) => [...issue.path])).toEqual([['party', 0, 'level']]);
    const json = JSON.stringify(error.issues, null, 2);
    expect(error.message).toBe(json);
    expect(error.message).toContain('"party"');
    expect(error.message).toContain('"level"');
    expect(String(error)).toBe(`SchemaError: ${json}`);
    expect(String(error)).toContain(json);
  });

  it('on saves, as parsed and as the player is told', () => {
    const state = midBattleState();
    const battle = saveShipped.toBlob(state, META);
    const explore = saveShipped.toBlob(
      {
        ...state,
        screen: 'explore',
        battle: null,
        world: {
          ...state.world,
          talk: { npcId: 'mira', mapId: 'ba_dan_village', anchor: 'well' },
          residentProfiles: { mira: 'resting' },
        },
      },
      { ...META, session: { players: [] } },
    );
    const legacy = legacySaveFixtures(explore);

    // A legacy blob (format 1) whose state owns a `__proto__` key. Only
    // JSON.parse makes an own key -- assignment runs the setter -- and the
    // migration spreads the state four times, so this holds the old-format path
    // to zod's verdict without letting a spread touch a prototype.
    const legacyProtoJson = JSON.stringify(legacy[1]).replace(
      '"state":{',
      '"state":{"__proto__":{"polluted":true},',
    );
    const legacyProto = JSON.parse(legacyProtoJson) as { state: Record<string, unknown> };
    expect(Object.hasOwn(legacyProto.state, '__proto__')).toBe(true);

    const seeds = [battle, explore];
    fuzz(saveShipped.saveBlobSchema, zodBuilt.save.saveBlobSchema, seeds, 3000, 1);

    for (const value of [...legacy, legacyProto, ...MALFORMED_SAVE_CORPUS]) {
      expectSameVerdict(saveShipped.saveBlobSchema, zodBuilt.save.saveBlobSchema, value, 'corpus');
      const json = JSON.stringify(value);
      expect(saveShipped.deserialize(json), json).toEqual(zodBuilt.save.deserialize(json));
    }

    // The migrated blob loads, and the key is stripped rather than polluting.
    const protoLoad = saveShipped.deserialize(legacyProtoJson);
    expect(protoLoad).toEqual(zodBuilt.save.deserialize(legacyProtoJson));
    expect(protoLoad.ok).toBe(true);
    if (protoLoad.ok) expect(Object.hasOwn(protoLoad.blob.state, '__proto__')).toBe(false);
    expect((Object.prototype as { polluted?: unknown }).polluted).toBeUndefined();

    const random = lcg(2);
    for (let n = 0; n < 500; n++) {
      const json = JSON.stringify(mutate(seeds[n % 2], random));
      expect(saveShipped.deserialize(json), json.slice(0, 400)).toEqual(
        zodBuilt.save.deserialize(json),
      );
    }
  });

  it('on every fx recipe', () => {
    const seeds = [...Object.values(fxShipped.FX_RECIPES), ...Object.values(fxShipped.FX_FAMILIES)];
    fuzz(fxShipped.fxRecipeSchema, zodBuilt.fx.fxRecipeSchema, seeds, 3000, 3);
  });

  it('on every sound', () => {
    const seeds = soundsShipped.ALL_SOUNDS.map(({ def }) => def);
    fuzz(soundsShipped.soundSchema, zodBuilt.sounds.soundSchema, seeds, 3000, 4);
  });

  it('on the combat tuning, its refinement and its partial override', () => {
    const tuning = tuningShipped.COMBAT_TUNING;
    const seeds = [tuning, { ...tuning, hitChanceMin: 99, hitChanceMax: 5 }, {}];
    fuzz(tuningShipped.combatTuningSchema, zodBuilt.tuning.combatTuningSchema, seeds, 1500, 5);
    fuzz(
      tuningShipped.combatTuningOverrideSchema,
      zodBuilt.tuning.combatTuningOverrideSchema,
      seeds,
      1500,
      6,
    );

    const strictPartialInput = JSON.parse('{"unknown":1}') as unknown;
    expectSameVerdict(
      schemaShipped.object({ known: schemaShipped.string() }).strict().partial(),
      z.object({ known: z.string() }).strict().partial(),
      strictPartialInput,
      'strict partial unknown key',
    );

    const strictTuningProto = JSON.parse('{"__proto__":{"polluted":true}}') as unknown;
    expectSameVerdict(
      tuningShipped.combatTuningOverrideSchema,
      zodBuilt.tuning.combatTuningOverrideSchema,
      strictTuningProto,
      'strict tuning __proto__ key',
    );
    expect((Object.prototype as { polluted?: unknown }).polluted).toBeUndefined();
  });

  it('does not pollute prototypes from JSON-parsed save keys', () => {
    const battle = saveShipped.toBlob(midBattleState(), META);
    const serialized = JSON.stringify(battle);
    const malformedJson = serialized.replace(
      '"flags":{',
      '"flags":{"__proto__":{"polluted":true},',
    );
    const validJson = serialized.replace('"flags":{', '"flags":{"__proto__":1,');

    for (const json of [malformedJson, validJson]) {
      const parsed = JSON.parse(json) as { state: { flags: Record<string, unknown> } };
      expect(Object.hasOwn(parsed.state.flags, '__proto__')).toBe(true);
      expect(saveShipped.deserialize(json)).toEqual(zodBuilt.save.deserialize(json));
      expect((Object.prototype as { polluted?: unknown }).polluted).toBeUndefined();
    }

    const result = saveShipped.deserialize(validJson);
    expect(result.ok).toBe(true);
    if (result.ok) expect(Object.hasOwn(result.blob.state.flags, '__proto__')).toBe(false);
  });

  it('gives what the shipped modules export the same values', () => {
    expect(tuningShipped.COMBAT_TUNING).toEqual(zodBuilt.tuning.COMBAT_TUNING);
    for (const key of [...Object.keys(fxShipped.FX_RECIPES), 'fx.fire.invented', 'fx.nothing']) {
      expect(JSON.stringify(fxShipped.resolveFx(key)), key).toBe(
        JSON.stringify(zodBuilt.fx.resolveFx(key)),
      );
    }
    for (const { key } of soundsShipped.ALL_SOUNDS) {
      expect(JSON.stringify(soundsShipped.resolveSound(key)), key).toBe(
        JSON.stringify(zodBuilt.sounds.resolveSound(key)),
      );
    }
    expect(soundsShipped.soundFiles()).toEqual(zodBuilt.sounds.soundFiles());
  });

  it('really did load zod for the comparison', () => {
    const shipped = saveShipped.saveBlobSchema.safeParse(null);
    const zod = zodBuilt.save.saveBlobSchema.safeParse(null);
    expect(shipped.success || shipped.error).toBeInstanceOf(schemaShipped.SchemaError);
    expect(zod.success || zod.error).not.toBeInstanceOf(schemaShipped.SchemaError);
    expect((zod.success || zod.error).constructor.name).toBe('ZodError');
  });
});
