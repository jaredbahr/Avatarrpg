import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTENT } from '../src/content';
import * as reconciliation from '../src/core/save/reconcile';
import {
  deserialize,
  SAVE_FORMAT_VERSION,
  serializeForExport,
  stateFromBlob,
} from '../src/core/save/serialize';
import { createGame } from '../src/core/state/createGame';
import { apply } from '../src/core/state/reducer';
import { parseReplayArgs, runReplay } from './replay';

let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'avatarrpg-replay-'));
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(directory, { recursive: true, force: true });
});

function fixture(checkpoint = 'new-game'): string {
  const source = readFileSync(
    new URL(`../src/core/save/fixtures/golden/v5/party-4-${checkpoint}.json`, import.meta.url),
  );
  const path = join(directory, `${checkpoint}.json`);
  writeFileSync(path, source);
  return path;
}

describe('save snapshot CLI fallback', () => {
  it('prints help without opening a file, including machine-readable help', () => {
    const help = runReplay(['--help']);
    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain('Usage: npm run replay');
    expect(help.stdout).toContain('no supported command history');
    expect(help.stderr).toBe('');
    const json = runReplay(['--help', '--json']);
    expect(json.exitCode).toBe(0);
    expect(JSON.parse(json.stdout)).toMatchObject({ mode: 'help' });
    expect(json.stderr).toBe('');
  });

  it.each(['new-game', 'driller-mid', 'home'])(
    'inspects the real %s golden without changing bytes',
    (checkpoint) => {
      const path = fixture(checkpoint);
      const before = readFileSync(path);
      const parsed = deserialize(before.toString('utf8'));
      if (!parsed.ok) throw new Error(parsed.error);
      const repaired = reconciliation.reconcileBattleResult(CONTENT, stateFromBlob(parsed.blob));
      const expected = reconciliation.reconcileWorld(
        CONTENT,
        reconciliation.reconcileDisciplines(CONTENT, repaired.state),
      );
      const result = runReplay([path, '--json']);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      const report = JSON.parse(result.stdout);
      expect(report).toMatchObject({
        mode: 'snapshot',
        replay: {
          available: false,
          verified: false,
          requested: { from: null, to: null, verify: false },
        },
        save: {
          format: parsed.blob.format,
          savedAt: parsed.blob.savedAt,
          label: parsed.blob.label,
          session: parsed.blob.session,
        },
        state: {
          source: 'reconciled-snapshot',
          screen: expected.screen,
          seed: expected.seed,
          rng: expected.rng,
          story: expected.story,
          location: expected.location,
        },
        warnings: repaired.warnings,
        log: { kind: 'reconciled-prose', lines: expected.log },
      });
      expect(report.state.party.map((unit: { id: string }) => unit.id)).toEqual(
        expected.party.map((unit) => unit.id),
      );
      expect(report.state.battle?.encounterId ?? null).toBe(expected.battle?.encounterId ?? null);
      if (expected.battle) {
        expect(
          report.state.battle.units.map((unit: { id: string; hp: number; ap: number }) => [
            unit.id,
            unit.hp,
            unit.ap,
          ]),
        ).toEqual(expected.battle.units.map((unit) => [unit.id, unit.hp, unit.ap]));
      }
      const text = runReplay([path]);
      expect(text.exitCode).toBe(0);
      expect(text.stdout).toContain('Replay unavailable:');
      expect(text.stdout).toContain('Determinism verified: false');
      expect(text.stdout).toContain('Reconciled prose log (including load-repair entries;');
      for (const line of expected.log) expect(text.stdout).toContain(line);
      expect(readFileSync(path)).toEqual(before);
    },
  );

  it('loads a real serializeForExport save through the App core reconciliation order', () => {
    const seeded = createGame(CONTENT, {
      seed: 'replay-discipline-debt',
      startNode: 'village_explore',
      party: [{ characterId: 'bo', level: 5 }],
    });
    const state = apply(CONTENT, seeded, { type: 'enterNode', nodeId: 'village_explore' }).state;
    expect(state.pendingChoices).toEqual([]);
    const path = join(directory, 'exported.json');
    const exported = serializeForExport(state, {
      label: 'Real export',
      summary: 'Supported level-five fixture; not an earned campaign',
      savedAt: 1_700_000_000_000,
      session: { players: [{ name: 'Bo', unitId: 'p0' }], soloPlay: true },
    });
    writeFileSync(path, exported);
    const calls: string[] = [];
    const battle = reconciliation.reconcileBattleResult;
    const disciplines = reconciliation.reconcileDisciplines;
    const world = reconciliation.reconcileWorld;
    vi.spyOn(reconciliation, 'reconcileBattleResult').mockImplementation((...args) => {
      calls.push('battle');
      return battle(...args);
    });
    vi.spyOn(reconciliation, 'reconcileDisciplines').mockImplementation((...args) => {
      calls.push('disciplines');
      return disciplines(...args);
    });
    vi.spyOn(reconciliation, 'reconcileWorld').mockImplementation((...args) => {
      calls.push('world');
      return world(...args);
    });
    const result = runReplay([path, '--json']);
    expect(result.exitCode).toBe(0);
    expect(calls).toEqual(['battle', 'disciplines', 'world']);
    const report = JSON.parse(result.stdout);
    expect(report.state.pendingChoices).toEqual([
      expect.objectContaining({ unitId: 'p0', kind: 'discipline' }),
    ]);
    expect(report.replay).toMatchObject({ available: false, verified: false });
    expect(readFileSync(path, 'utf8')).toBe(exported);
  });

  it('prints the full reconciled log when loading repairs a known dead active pointer', () => {
    const path = fixture('driller-mid');
    const source = deserialize(readFileSync(path, 'utf8'));
    if (!source.ok) throw new Error(source.error);
    const state = stateFromBlob(source.blob);
    const battle = state.battle;
    if (!battle || battle.phase !== 'active') throw new Error('Expected active golden battle');
    const deadId = battle.order[battle.turnIndex];
    const dead = battle.units.find((unit) => unit.id === deadId);
    if (!dead || dead.hp <= 0) throw new Error('Expected known living golden actor');
    // Supported imported-save recovery fixture, as in reconcileBattle.test.ts:
    // change only the active unit's HP. This is not a naturally earned death,
    // and no events, upkeep results or log entries are manufactured.
    const imported = {
      ...state,
      battle: {
        ...battle,
        units: battle.units.map((unit) => (unit.id === dead.id ? { ...unit, hp: 0 } : unit)),
      },
    };
    expect(imported.battle.units.some((unit) => unit.faction === 'party' && unit.hp > 0)).toBe(
      true,
    );
    expect(imported.battle.units.some((unit) => unit.faction === 'enemy' && unit.hp > 0)).toBe(
      true,
    );
    const exported = serializeForExport(imported, {
      label: 'Dead-active import control',
      summary: 'Supported recovery fixture; not a natural campaign checkpoint',
      savedAt: 1_700_000_000_000,
      session: source.blob.session,
    });
    writeFileSync(path, exported);
    const originalBytes = readFileSync(path);
    const parsed = deserialize(exported);
    if (!parsed.ok) throw new Error(parsed.error);
    const loaded = stateFromBlob(parsed.blob);
    expect(loaded.log).toEqual(state.log);
    const repaired = reconciliation.reconcileBattleResult(CONTENT, loaded);
    const expected = reconciliation.reconcileWorld(
      CONTENT,
      reconciliation.reconcileDisciplines(CONTENT, repaired.state),
    );
    expect(expected.log).not.toEqual(loaded.log);
    const recoveredBattle = expected.battle;
    if (!recoveredBattle) throw new Error('Recovery lost the battle');
    const next = recoveredBattle.units.find(
      (unit) => unit.id === recoveredBattle.order[recoveredBattle.turnIndex],
    );
    if (!next) throw new Error('Recovery did not select a known actor');
    expect(next.id).not.toBe(dead.id);
    expect(next.hp).toBeGreaterThan(0);
    expect(expected.log.at(-1)).toBe(`${next.name}'s turn.`);
    const json = runReplay([path, '--json']);
    expect(json.exitCode).toBe(0);
    expect(JSON.parse(json.stdout).log).toEqual({
      kind: 'reconciled-prose',
      lines: expected.log,
    });
    const text = runReplay([path]);
    expect(text.exitCode).toBe(0);
    expect(text.stdout).toContain('Reconciled prose log (including load-repair entries;');
    expect(text.stdout).toContain(`\n${next.name}'s turn.\n`);
    expect(text.stdout.endsWith(`${expected.log.join('\n')}\n`)).toBe(true);
    expect(readFileSync(path)).toEqual(originalBytes);
  });

  it.each(
    [['--verify'], ['--from', '0'], ['--to', '3'], ['--from', '0', '--to', '3', '--verify']].map(
      (flags) => ({ flags }),
    ),
  )('fails requested command operations without history: $flags', ({ flags }) => {
    const path = fixture('driller-mid');
    const before = readFileSync(path);
    const result = runReplay([path, ...flags, '--json']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({
      mode: 'snapshot',
      replay: { available: false, verified: false },
      error: {
        code: 'history-unavailable',
        message: expect.stringContaining('Omit --from, --to and --verify'),
      },
    });
    const text = runReplay([path, ...flags]);
    expect(text.exitCode).toBe(1);
    expect(text.stderr).toContain('Command replay needs a future save format');
    expect(readFileSync(path)).toEqual(before);
  });

  it('does not invent replay support from unrecognized JSON properties', () => {
    const path = fixture();
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    raw.commandLog = { base: raw.state, commands: [{ type: 'endTurn', unitId: 'p0' }] };
    writeFileSync(path, JSON.stringify(raw));
    const result = runReplay([path, '--verify', '--json']);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout).replay).toMatchObject({ available: false, verified: false });
  });

  it('exposes App-style battle load warnings without rewriting the save', () => {
    const path = fixture('driller-mid');
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    raw.state.battle.mapId = 'replay_missing_map';
    const original = JSON.stringify(raw);
    writeFileSync(path, original);
    const result = runReplay([path, '--json']);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout).warnings).toContainEqual({
      kind: 'missing-map',
      mapId: 'replay_missing_map',
    });
    expect(runReplay([path]).stdout).toContain('Load warning:');
    expect(readFileSync(path, 'utf8')).toBe(original);
  });

  it('reports a damaged state and a reconciliation exception clearly', () => {
    const path = fixture();
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    delete raw.state.party;
    writeFileSync(path, JSON.stringify(raw));
    const damaged = runReplay([path, '--json']);
    expect(damaged.exitCode).toBe(1);
    expect(JSON.parse(damaged.stdout).error.message).toContain('state.party');
    const valid = fixture('home');
    const before = readFileSync(valid);
    vi.spyOn(reconciliation, 'reconcileBattleResult').mockImplementation(() => {
      throw new Error('Reconciliation control failure');
    });
    const failed = runReplay([valid, '--json']);
    expect(failed.exitCode).toBe(1);
    expect(failed.stderr).toBe('');
    expect(JSON.parse(failed.stdout)).toMatchObject({
      mode: 'error',
      replay: { available: false, verified: false },
      error: { code: 'reconcile-error', message: 'Reconciliation control failure' },
    });
    expect(readFileSync(valid)).toEqual(before);
  });

  it.each([
    ['broken JSON', '{', 'valid JSON'],
    ['wrong game', '{}', 'not a Four Nations Tactics save'],
  ])('reports %s clearly in text and one JSON error document', (_label, value, message) => {
    const path = join(directory, 'invalid.json');
    writeFileSync(path, value);
    const text = runReplay([path]);
    expect(text.exitCode).toBe(1);
    expect(text.stderr).toContain(message);
    const json = runReplay([path, '--json']);
    expect(json.exitCode).toBe(1);
    expect(json.stderr).toBe('');
    expect(JSON.parse(json.stdout)).toMatchObject({
      mode: 'error',
      error: { code: 'invalid-save', message: expect.stringContaining(message) },
    });
    expect(readFileSync(path, 'utf8')).toBe(value);
  });

  it('rejects a newer save before inspection and reports missing input files', () => {
    const path = fixture();
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    raw.format = SAVE_FORMAT_VERSION + 1;
    const newer = JSON.stringify(raw);
    writeFileSync(path, newer);
    const result = runReplay([path, '--json']);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout).error.message).toContain('newer version');
    expect(readFileSync(path, 'utf8')).toBe(newer);
    const missing = runReplay([join(directory, 'missing.json'), '--json']);
    expect(missing.exitCode).toBe(1);
    expect(JSON.parse(missing.stdout)).toMatchObject({
      mode: 'error',
      error: { code: 'read-error', message: expect.stringContaining('Cannot read save') },
    });
  });
});

describe('replay arguments', () => {
  it('accepts safe integer ranges and a path after the option separator', () => {
    expect(
      parseReplayArgs(['save.json', '--from', '0', '--to', '12', '--verify', '--json']),
    ).toMatchObject({ filePath: 'save.json', from: 0, to: 12, verify: true, json: true });
    expect(parseReplayArgs(['--', '--save.json']).filePath).toBe('--save.json');
  });

  it.each(
    [
      [],
      ['a.json', 'b.json'],
      ['--wat'],
      ['--from'],
      ['--from', '-1'],
      ['--from', '1.5'],
      ['--to', 'Infinity'],
      ['--from', '1e3'],
      ['--to', '9007199254740992'],
      ['a.json', '--from', '2', '--to', '1'],
      ['a.json', '--from', '0', '--from', '1'],
      ['a.json', '--verify', '--verify'],
    ].map((args) => ({ args })),
  )('rejects invalid arguments before reading any save: $args', ({ args }) => {
    expect(() => parseReplayArgs(args)).toThrow();
    const result = runReplay([...args, '--json']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({
      mode: 'error',
      error: { code: 'arguments' },
    });
  });
});
