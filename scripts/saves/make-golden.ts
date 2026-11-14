/** Deterministic save compatibility fixtures, not a balance or gameplay proof.
 *
 * Campaign routing, rewards and the return home use real core commands. The
 * explicitly permitted victory adapter below bypasses fighting skill/odds.
 * The Driller mid-battle snapshot is taken before that adapter, after real
 * turn commands against the unmodified encounter. Importing this file is pure;
 * only direct CLI execution writes files, and existing different bytes fail.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { CONTENT, RETURNEE_IDS, STORY_ENTRY } from '../../src/content';
import { distance } from '../../src/core/rules/grid';
import {
  deserialize,
  SAVE_FORMAT_VERSION,
  serialize,
  type SessionMeta,
} from '../../src/core/save/serialize';
import { createGame } from '../../src/core/state/createGame';
import { apply } from '../../src/core/state/reducer';
import { evaluate } from '../../src/core/story/conditions';
import { exitCells } from '../../src/core/story/world';
import type { Command, GameState, Vec2 } from '../../src/core/types';

export const GOLDEN_CHECKPOINTS = [
  'new-game',
  'ba-dan',
  'before-forest',
  'after-forest',
  'quarry-gate',
  'cutting',
  'driller-mid',
  'driller-won',
  'home',
] as const;
export type GoldenCheckpoint = (typeof GOLDEN_CHECKPOINTS)[number];
export interface GoldenSave {
  readonly partySize: 1 | 4;
  readonly checkpoint: GoldenCheckpoint;
  readonly filename: string;
  readonly json: string;
}

const SAVED_AT = 1_700_000_000_000;
const MAX_BYTES = 200_000;
const CHARACTERS = ['kaya', 'nilak', 'bo', 'riko'] as const;

function generateParty(partySize: 1 | 4): readonly GoldenSave[] {
  const characterIds = CHARACTERS.slice(0, partySize);
  let state = createGame(CONTENT, {
    seed: `golden-save-corpus-486-party-${partySize}`,
    party: characterIds.map((characterId) => ({ characterId })),
    startNode: STORY_ENTRY,
  });
  const session: SessionMeta = {
    players: state.party.map((unit) => ({ name: unit.name, unitId: unit.id })),
    soloPlay: partySize === 1,
  };
  const saves: GoldenSave[] = [];
  const context = () =>
    `party ${partySize}, ${state.story.nodeId ?? 'no story'}, ${state.location.mapId}`;
  const requireState = (ok: boolean, message: string): void => {
    if (!ok) throw new Error(`${context()}: ${message}`);
  };
  const issue = (command: Command): void => {
    const before = state;
    const result = apply(CONTENT, before, command);
    let semanticProgress: boolean;
    if (command.type === 'chooseLevelUp' || command.type === 'chooseDiscipline') {
      const kind = command.type === 'chooseLevelUp' ? 'ability' : 'discipline';
      const selected = command.type === 'chooseLevelUp' ? command.abilityId : command.disciplineId;
      const owed = before.pendingChoices.find(
        (choice) =>
          choice.unitId === command.unitId &&
          choice.kind === kind &&
          choice.options.includes(selected),
      );
      const member = result.state.party.find((unit) => unit.id === command.unitId);
      const consumed =
        owed !== undefined &&
        // A discipline can also offer newly owed ability choices. The ability
        // handler removes exactly one; both must consume the matched reward.
        (command.type !== 'chooseLevelUp' ||
          result.state.pendingChoices.length === before.pendingChoices.length - 1) &&
        !result.state.pendingChoices.some(
          (choice) =>
            choice.unitId === owed.unitId &&
            choice.kind === owed.kind &&
            choice.level === owed.level,
        );
      const installed =
        command.type === 'chooseLevelUp'
          ? member?.abilities.includes(command.abilityId) === true
          : member?.disciplineId === command.disciplineId;
      // Reward commands legitimately emit only a plain "learns" message.
      // Accept that only when the exact owed choice was consumed and installed.
      semanticProgress = consumed && installed;
    } else {
      semanticProgress = result.events.some((event) => event.type !== 'message');
    }
    if (result.state === before || result.events.length === 0 || !semanticProgress)
      throw new Error(
        `${context()}: refused ${JSON.stringify(command)}: ${JSON.stringify(result.events)}`,
      );
    state = result.state;
  };
  const choosePending = (): void => {
    for (let guard = 0; state.pendingChoices.length && guard < 100; guard++) {
      const choice = state.pendingChoices[0];
      if (!choice) break;
      if (choice.kind === 'ability') {
        const abilityId = choice.options[0];
        if (!abilityId) throw new Error(`${context()}: empty ability reward`);
        issue({ type: 'chooseLevelUp', unitId: choice.unitId, abilityId });
      } else {
        const disciplineId = choice.options.find((id) => {
          const definition = CONTENT.disciplines.get(id);
          return (
            definition &&
            (!definition.requiresFlag || state.flags[definition.requiresFlag] === true)
          );
        });
        if (!disciplineId) throw new Error(`${context()}: no unlocked discipline reward`);
        issue({ type: 'chooseDiscipline', unitId: choice.unitId, disciplineId });
      }
    }
    requireState(state.pendingChoices.length === 0, 'reward choices did not terminate');
  };
  const story = (): void => {
    for (let guard = 0; guard < 150; guard++) {
      if (state.screen === 'combat') return;
      choosePending();
      if (state.screen !== 'dialogue') return;
      const node = CONTENT.story.get(state.story.nodeId ?? '');
      if (!node) throw new Error(`${context()}: missing story node`);
      if (node.kind === 'dialogue') issue({ type: 'advanceDialogue' });
      else if (node.kind === 'choice' && (node.id === 'gate_parley' || node.id === 'ruon_choice'))
        issue({ type: 'chooseOption', optionIndex: 0 }); // Walk up; then escort Ruon.
      else throw new Error(`${context()}: unexpected dialogue/choice ${node.kind}`);
    }
    throw new Error(`${context()}: dialogue did not terminate`);
  };
  const reachNode = (nodeId: string, toward: Vec2): void => {
    for (let guard = 0; guard < 20; guard++) {
      if (state.story.nodeId === nodeId) return;
      requireState(state.screen === 'explore', `expected exploration while approaching ${nodeId}`);
      issue({ type: 'walkTo', pos: toward });
    }
    throw new Error(`${context()}: did not reach ${nodeId}`);
  };
  const travel = (destination: string): void => {
    for (let guard = 0; guard < 20; guard++) {
      if (state.location.mapId === destination && state.screen === 'explore') return;
      if (state.screen === 'dialogue') {
        // In particular, the real forest_return_arrival dialogue transfers the
        // returning residents into their resting profiles and enters Ba Dan.
        story();
        continue;
      }
      requireState(state.screen === 'explore', `expected exploration travelling to ${destination}`);
      const map = CONTENT.maps.get(state.location.mapId);
      const exit = map?.exits?.find((candidate) => candidate.toMapId === destination);
      if (!exit) throw new Error(`${context()}: no authored exit to ${destination}`);
      requireState(evaluate(state, exit.requires), `locked exit to ${destination}`);
      const point = [...exitCells(exit)].sort(
        (a, b) =>
          distance(state.location.pos, a) - distance(state.location.pos, b) ||
          a.y - b.y ||
          a.x - b.x,
      )[0];
      if (!point) throw new Error(`${context()}: empty exit to ${destination}`);
      issue({ type: 'walkTo', pos: point });
    }
    throw new Error(`${context()}: travel to ${destination} did not terminate`);
  };
  const checkpoint = (
    name: GoldenCheckpoint,
    nodeId: string,
    screen: GameState['screen'],
  ): void => {
    if (screen === 'explore' && state.screen === 'explore' && state.story.nodeId === null) {
      // Real inter-map walking deliberately leaves no story cursor. Anchor a
      // named exploration checkpoint with the existing same-map core command,
      // never by fabricating a saved cursor or travelling to a different map.
      const node = CONTENT.story.get(nodeId);
      if (!node || node.kind !== 'explore' || node.mapId !== state.location.mapId)
        throw new Error(`${context()}: ${nodeId} is not an exploration node for the current map`);
      const before = state;
      issue({ type: 'enterNode', nodeId });
      requireState(
        state.screen === 'explore' &&
          state.location.mapId === before.location.mapId &&
          state.location.pos.x === before.location.pos.x &&
          state.location.pos.y === before.location.pos.y,
        `${name} story anchoring moved the party`,
      );
      requireState(
        state.rng === before.rng && state.flags === before.flags,
        `${name} story anchoring changed RNG or flags`,
      );
    }
    requireState(
      state.story.nodeId === nodeId && state.screen === screen,
      `wrong ${name} checkpoint identity; expected ${screen}/${nodeId}`,
    );
    requireState(state.pendingChoices.length === 0, `${name} has unresolved rewards`);
    const json =
      serialize(state, {
        label: `Golden ${partySize}: ${name}`,
        summary: `${name}; walk-up/escort route; forced victories for compatibility fixtures`,
        savedAt: SAVED_AT,
        session,
      }) + '\n';
    requireState(Buffer.byteLength(json, 'utf8') < MAX_BYTES, `${name} exceeds the 200 KB limit`);
    const parsed = deserialize(json);
    if (!parsed.ok) throw new Error(`${context()}: generated invalid ${name}: ${parsed.error}`);
    saves.push({ partySize, checkpoint: name, filename: `party-${partySize}-${name}.json`, json });
  };
  const forceVictoryAndResolve = (encounterId: string): void => {
    const battle = state.battle;
    if (!battle || battle.encounterId !== encounterId || battle.phase !== 'active')
      throw new Error(`${context()}: no active ${encounterId} for permitted forced victory`);
    // Test-only adapter, explicitly allowed by #486. It changes only enemy HP
    // and the terminal battle phase. Rewards, healing, flags, levels, return
    // placement and story progression below are owned by real resolveBattle.
    state = {
      ...state,
      battle: {
        ...battle,
        units: battle.units.map((unit) => (unit.faction === 'enemy' ? { ...unit, hp: 0 } : unit)),
        phase: 'victory',
      },
    };
    issue({ type: 'resolveBattle' });
    choosePending();
    requireState(
      state.battle === null && state.world.cleared.includes(encounterId),
      `${encounterId} did not resolve and record victory`,
    );
  };

  issue({ type: 'enterNode', nodeId: STORY_ENTRY });
  checkpoint('new-game', STORY_ENTRY, 'dialogue');
  story();
  checkpoint('ba-dan', 'village_explore', 'explore');
  travel('forest_road');
  reachNode('road_depart', { x: 19, y: 4 });
  story();
  reachNode('battle_forest_road', { x: 19, y: 4 });
  requireState(
    state.battle?.phase === 'active' && state.battle.round === 1,
    'forest checkpoint must precede combat actions',
  );
  checkpoint('before-forest', 'battle_forest_road', 'combat');
  forceVictoryAndResolve('enc_forest_road');
  checkpoint('after-forest', 'after_forest', 'dialogue');
  story();
  travel('quarry_gate');
  reachNode('gate_parley', { x: 19, y: 5 });
  checkpoint('quarry-gate', 'gate_parley', 'dialogue');
  story();
  forceVictoryAndResolve('enc_quarry_gate');
  story();
  requireState(
    state.flags.ruon_spared === true && state.flags.ruon_traded !== true,
    'expected the actual escort choice',
  );
  travel('ambush_road');
  checkpoint('cutting', 'cutting_explore', 'explore');
  reachNode('battle_ambush', { x: 19, y: 4 });
  forceVictoryAndResolve('enc_ambush');
  story();
  travel('quarry_floor');
  reachNode('quarry_descent', { x: 17, y: 5 });
  story();
  requireState(
    state.battle?.encounterId === 'enc_grumbler' && state.battle.phase === 'active',
    'expected the unmodified active Driller encounter',
  );
  for (let turn = 0; turn < 3; turn++) {
    const battle = state.battle;
    if (!battle || battle.phase !== 'active')
      throw new Error(`${context()}: Driller fight ended before the mid-battle checkpoint`);
    const actor = battle.units.find((unit) => unit.id === battle.order[battle.turnIndex]);
    if (!actor || actor.hp <= 0) throw new Error(`${context()}: no living active actor`);
    if (actor.ai === 'none') issue({ type: 'endTurn', unitId: actor.id });
    else issue({ type: 'runAiTurn' });
  }
  requireState(state.battle?.phase === 'active', 'mid-battle checkpoint is no longer active');
  checkpoint('driller-mid', 'battle_grumbler', 'combat');
  forceVictoryAndResolve('enc_grumbler');
  requireState(state.flags.act1_complete === true, 'Driller resolution did not complete the act');
  checkpoint('driller-won', 'act1_epilogue', 'dialogue');
  // The workers-are-free beat reads through to the walk home on the quarry floor.
  story();
  travel('ambush_road');
  travel('quarry_gate');
  travel('forest_road');
  travel('ba_dan_village');
  requireState(
    RETURNEE_IDS.every((id) => state.world.residentProfiles[id] === 'resting'),
    'the real homecoming did not settle every returnee',
  );
  checkpoint('home', 'village_return_explore', 'explore');
  requireState(saves.length === GOLDEN_CHECKPOINTS.length, 'incomplete checkpoint corpus');
  return saves;
}

export async function generateGoldenSaves(): Promise<readonly GoldenSave[]> {
  const options = await resolveConfig(fileURLToPath(import.meta.url));
  if (!options) throw new Error('Golden generation requires the repository Prettier configuration');
  const saves = [1, 4].flatMap((size) => generateParty(size as 1 | 4));
  return Promise.all(
    saves.map(async (save) => {
      const json = await format(save.json, { ...options, parser: 'json', filepath: save.filename });
      if (Buffer.byteLength(json, 'utf8') >= MAX_BYTES)
        throw new Error(`${save.filename}: formatted save exceeds the 200 KB limit`);
      return { ...save, json };
    }),
  );
}

async function main(args: readonly string[]): Promise<void> {
  const defaultDirectory = fileURLToPath(
    new URL(`../../src/core/save/fixtures/golden/v${SAVE_FORMAT_VERSION}/`, import.meta.url),
  );
  if (args.length !== 0 && (args.length !== 2 || args[0] !== '--out-dir' || !args[1]))
    throw new Error(
      'Usage: node --import tsx scripts/saves/make-golden.ts [--out-dir <directory>]',
    );
  const outDirectory = args.length ? resolve(args[1] ?? '') : defaultDirectory;
  const saves = await generateGoldenSaves();
  const missing: GoldenSave[] = [];
  // Check the entire set before writing anything. Never overwrite a changed
  // version's existing fixture, remove old folders, or touch identical files.
  for (const save of saves) {
    const path = resolve(outDirectory, save.filename);
    let existing: string;
    try {
      existing = await readFile(path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      missing.push(save);
      continue;
    }
    if (existing !== save.json)
      throw new Error(
        `Refusing to overwrite changed golden fixture ${path}; retain old version corpora.`,
      );
  }
  for (const save of missing) {
    const path = resolve(outDirectory, save.filename);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, save.json, { encoding: 'utf8', flag: 'wx' });
  }
  process.stdout.write(
    `${JSON.stringify({ format: SAVE_FORMAT_VERSION, fixtures: saves.length, written: missing.length, directory: outDirectory })}\n`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
