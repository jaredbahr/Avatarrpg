/** Read-only inspection fallback for saves without a command-history format. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CONTENT } from '../src/content';
import * as reconciliation from '../src/core/save/reconcile';
import { deserialize, stateFromBlob } from '../src/core/save/serialize';

const NO_HISTORY =
  'This save format stores a snapshot and formatted prose log, not a base state and command history.';
const HISTORY_ACTION =
  'Omit --from, --to and --verify to inspect the snapshot. Command replay needs a future save format with a base checkpoint and typed commands.';
const HELP = `Usage: npm run replay -- SAVE.json [--from N] [--to M] [--json] [--verify]

Read and reconcile an exported save without changing the input file.
Current saves contain no supported command history: the default prints the
snapshot summary and reconciled prose log (including load-repair entries),
with replay unavailable and verified=false.

  --from N   Nonnegative command offset; requires command history.
  --to M     Nonnegative command offset, at least --from; requires history.
  --verify   Replay twice and compare; unavailable without command history.
  --json     Print exactly one JSON document (use npm run --silent replay).
  --help     Show this help.

Command operations requested without history exit nonzero; inspection exits zero.
`;

export interface ReplayOptions {
  readonly filePath?: string;
  readonly from?: number;
  readonly to?: number;
  readonly json: boolean;
  readonly verify: boolean;
  readonly help: boolean;
}

export interface ReplayResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

class ReplayError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function parseReplayArgs(args: readonly string[]): ReplayOptions {
  let filePath: string | undefined;
  let from: number | undefined;
  let to: number | undefined;
  let json = false;
  let verify = false;
  let help = false;
  let positionalOnly = false;
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === undefined) continue;
    if (!positionalOnly && arg === '--') {
      positionalOnly = true;
      continue;
    }
    if (!positionalOnly && arg.startsWith('--')) {
      if (seen.has(arg)) throw new ReplayError('arguments', `Repeated option: ${arg}`);
      seen.add(arg);
      if (arg === '--json') json = true;
      else if (arg === '--verify') verify = true;
      else if (arg === '--help') help = true;
      else if (arg === '--from' || arg === '--to') {
        const raw = args[++index];
        if (raw === undefined || !/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
          throw new ReplayError('arguments', `${arg} requires a nonnegative safe integer.`);
        }
        if (arg === '--from') from = Number(raw);
        else to = Number(raw);
      } else throw new ReplayError('arguments', `Unknown replay option: ${arg}`);
    } else if (filePath === undefined) filePath = arg;
    else throw new ReplayError('arguments', `Expected one save path; received another: ${arg}`);
  }
  if (from !== undefined && to !== undefined && from > to) {
    throw new ReplayError('arguments', '--from must not exceed --to.');
  }
  if (!help && !filePath)
    throw new ReplayError('arguments', 'A save path is required. Use --help.');
  return { filePath, from, to, json, verify, help };
}

function inspectSnapshot(filePath: string, options: ReplayOptions) {
  let json: string;
  try {
    json = readFileSync(filePath, 'utf8');
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new ReplayError('read-error', `Cannot read save ${JSON.stringify(filePath)}: ${detail}`);
  }
  const parsed = deserialize(json);
  if (!parsed.ok) throw new ReplayError('invalid-save', parsed.error);
  const loaded = stateFromBlob(parsed.blob);
  // App.adoptSave's exact core order. Warnings remain visible, as in the app;
  // no commands are dispatched and no repaired snapshot is written to disk.
  const battleRepair = reconciliation.reconcileBattleResult(CONTENT, loaded);
  const state = reconciliation.reconcileWorld(
    CONTENT,
    reconciliation.reconcileDisciplines(CONTENT, battleRepair.state),
  );
  const battle = state.battle;
  return {
    mode: 'snapshot' as const,
    replay: {
      available: false as const,
      verified: false as const,
      reason: NO_HISTORY,
      requested: { from: options.from ?? null, to: options.to ?? null, verify: options.verify },
    },
    save: {
      format: parsed.blob.format,
      savedAt: parsed.blob.savedAt,
      label: parsed.blob.label,
      summary: parsed.blob.summary,
      session: parsed.blob.session,
    },
    state: {
      source: 'reconciled-snapshot' as const,
      screen: state.screen,
      seed: state.seed,
      rng: state.rng,
      story: state.story,
      location: state.location,
      clock: state.world.clock,
      pendingChoices: state.pendingChoices,
      party: state.party.map((unit) => ({
        id: unit.id,
        name: unit.name,
        characterId: unit.characterId,
        disciplineId: unit.disciplineId,
        level: unit.level,
        xp: unit.xp,
        hp: unit.hp,
        maxHp: unit.base.maxHp,
      })),
      battle: battle
        ? {
            encounterId: battle.encounterId,
            variantId: battle.variantId,
            mapId: battle.mapId,
            phase: battle.phase,
            round: battle.round,
            turnIndex: battle.turnIndex,
            activeUnitId: battle.order[battle.turnIndex] ?? null,
            livingParty: battle.units.filter((unit) => unit.faction === 'party' && unit.hp > 0)
              .length,
            livingEnemies: battle.units.filter((unit) => unit.faction === 'enemy' && unit.hp > 0)
              .length,
            units: battle.units.map((unit) => ({
              id: unit.id,
              name: unit.name,
              faction: unit.faction,
              hp: unit.hp,
              maxHp: unit.base.maxHp,
              ap: unit.ap,
              move: unit.move,
              pos: unit.pos,
              statuses: unit.statuses,
              cooldowns: unit.cooldowns,
            })),
          }
        : null,
    },
    warnings: battleRepair.warnings,
    log: { kind: 'reconciled-prose' as const, lines: state.log },
  };
}

function textSummary(report: ReturnType<typeof inspectSnapshot>): string {
  const { state } = report;
  const lines = [
    `Reconciled snapshot: ${report.save.label} (save format ${report.save.format})`,
    report.save.summary,
    `Screen: ${state.screen}; story: ${state.story.nodeId ?? '(none)'}`,
    `Location: ${state.location.mapId || '(none)'} (${state.location.pos.x}, ${state.location.pos.y}); day ${state.clock.day}, ${state.clock.phase}`,
    `Seed: ${state.seed}; current RNG: ${state.rng}`,
    `Party (persistent): ${state.party.map((unit) => `${unit.name} [${unit.id}], level ${unit.level}, HP ${unit.hp}/${unit.maxHp}`).join('; ')}`,
    `Pending choices: ${state.pendingChoices.length}`,
  ];
  if (state.battle) {
    lines.push(
      `Battle: ${state.battle.encounterId}/${state.battle.variantId ?? 'base'}, ${state.battle.phase}, round ${state.battle.round}, active ${state.battle.activeUnitId ?? '(none)'}`,
      ...state.battle.units.map(
        (unit) =>
          `${unit.name} [${unit.id}/${unit.faction}]: HP ${unit.hp}/${unit.maxHp}, AP ${unit.ap}, Move ${unit.move}, at (${unit.pos.x}, ${unit.pos.y}); statuses ${JSON.stringify(unit.statuses)}`,
      ),
    );
  }
  for (const warning of report.warnings) lines.push(`Load warning: ${JSON.stringify(warning)}`);
  lines.push(
    `Replay unavailable: ${report.replay.reason}`,
    'Determinism verified: false (no command history).',
    `Reconciled prose log (including load-repair entries; ${report.log.lines.length} lines, not replayed command events):`,
    ...report.log.lines,
  );
  return `${lines.join('\n')}\n`;
}

/** Returns process output for tests and the CLI; never writes an input save. */
export function runReplay(args: readonly string[]): ReplayResult {
  // Preserve machine-readable errors even when another argument is invalid.
  let jsonOutput = args.includes('--json');
  try {
    const options = parseReplayArgs(args);
    jsonOutput = options.json;
    if (options.help) {
      return {
        exitCode: 0,
        stdout: options.json ? `${JSON.stringify({ mode: 'help', usage: HELP })}\n` : HELP,
        stderr: '',
      };
    }
    if (!options.filePath) throw new ReplayError('arguments', 'A save path is required.');
    const report = inspectSnapshot(options.filePath, options);
    const requestedCommands =
      options.verify || options.from !== undefined || options.to !== undefined;
    const error = requestedCommands
      ? { code: 'history-unavailable', message: `${NO_HISTORY} ${HISTORY_ACTION}` }
      : null;
    return {
      exitCode: requestedCommands ? 1 : 0,
      stdout: options.json
        ? `${JSON.stringify({ ...report, ...(error ? { error } : {}) })}\n`
        : textSummary(report),
      stderr: !options.json && error ? `Replay unavailable: ${error.message}\n` : '',
    };
  } catch (cause) {
    const error = {
      code: cause instanceof ReplayError ? cause.code : 'reconcile-error',
      message: cause instanceof Error ? cause.message : String(cause),
    };
    return {
      exitCode: 1,
      stdout: jsonOutput
        ? `${JSON.stringify({ mode: 'error', replay: { available: false, verified: false }, error })}\n`
        : '',
      stderr: jsonOutput ? '' : `Replay error: ${error.message}\n`,
    };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = runReplay(process.argv.slice(2));
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
}
