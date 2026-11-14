import { expect, test } from '@playwright/test';
import { CONTENT } from '../src/content';
import { deserialize, serialize, stateFromBlob } from '../src/core/save/serialize';
import {
  reconcileBattleResult,
  reconcileDisciplines,
  reconcileWorld,
} from '../src/core/save/reconcile';
import { createGame } from '../src/core/state/createGame';
import { apply } from '../src/core/state/reducer';
import { xpForLevel } from '../src/core/rules/leveling';
import { tileAt } from '../src/core/rules/grid';
import { resetStorage, settleMapCanvas, takeTurn, waitForIdle } from './helpers';
import { paintedTileCentre } from './projection';

/** Supported isolated combat checkpoint, not a completed six-player campaign. */
function checkpoint(actor: 'sergeant' | 'healer' | 'walker') {
  const fresh = createGame(CONTENT, {
    seed: 'ai-self-support-558',
    startNode: 'village_explore',
    party: ['kaya', 'nilak', 'bo', 'tenzo', 'lin_mei', 'nima'].map((characterId) => ({
      characterId,
      level: 2,
    })),
  });
  // Consistent supported-save level boundaries; these levels were not earned here.
  const ready = {
    ...fresh,
    party: fresh.party.map((unit) => ({ ...unit, xp: xpForLevel(unit.level) })),
  };
  const entered = apply(CONTENT, ready, { type: 'enterNode', nodeId: 'battle_ambush' }).state;
  const battle = entered.battle;
  const authoredSergeant = battle?.units.find((unit) => unit.enemyId === 'merc_sergeant');
  const healer = battle?.units.find((unit) => unit.characterId === 'nilak');
  if (!battle || !authoredSergeant || !healer)
    throw new Error('Missing authored ambush support units');
  const sergeant = {
    ...authoredSergeant,
    pos: actor === 'walker' ? { x: 4, y: 9 } : { x: 14, y: 6 },
    move: actor === 'walker' ? 4 : 0,
    ap: actor === 'walker' ? 0 : authoredSergeant.ap,
  };
  const ground = tileAt(battle.grid, sergeant.pos);
  if (!ground || ground.blocked || ground.surface)
    throw new Error('The isolated support checkpoint must be clear authored ground');
  // Keep the authored board and Sergeant kit. Isolate support with zero move,
  // or an uphill reposition with zero AP and one opponent beside the lookout.
  const units = battle.units
    .filter((unit) =>
      actor === 'walker'
        ? unit.id === healer.id || unit.id === sergeant.id
        : unit.faction === 'party' || unit.id === sergeant.id,
    )
    .map((unit) =>
      unit.id === sergeant.id
        ? sergeant
        : actor === 'walker' && unit.id === healer.id
          ? { ...unit, pos: { x: 2, y: 9 } }
          : actor === 'healer' && unit.id === healer.id
            ? { ...unit, hp: 1 }
            : unit,
    );
  const active = actor === 'healer' ? healer.id : sergeant.id;
  const state = {
    ...entered,
    battle: {
      ...battle,
      units,
      order: [active, ...units.filter((unit) => unit.id !== active).map((unit) => unit.id)],
      turnIndex: 0,
    },
  };
  const session = { players: [{ name: 'Support controls', unitId: healer.id }], soloPlay: true };
  const parsed = deserialize(
    serialize(state, {
      label: `Isolated ${actor} support checkpoint`,
      summary: 'Supported combat fixture; no campaign or encounter-balance claim',
      savedAt: 1_700_000_000_000,
      session,
    }),
  );
  if (!parsed.ok) throw new Error(parsed.error);
  expect(stateFromBlob(parsed.blob)).toEqual(state);
  // The real App also reconciles loaded positions. Require this fixture to
  // survive that chain unchanged rather than silently comparing a snapped save.
  const reconciled = reconcileBattleResult(CONTENT, state);
  expect(reconciled.warnings).toEqual([]);
  expect(reconcileWorld(CONTENT, reconcileDisciplines(CONTENT, reconciled.state))).toEqual(state);
  return { state, session: parsed.blob.session, sergeant, healer };
}

test('the player still heals their own unit through the real targeting controls', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const fixture = checkpoint('healer');
  await resetStorage(page, '?renderer=canvas');
  await page.evaluate(({ state, session }) => {
    const app = window.fnt!.app;
    // The final check compares the whole GameState with the reducer's. The
    // board opens with surfaces, so combat tips queue at battle start and each
    // one, once shown, writes its `guidance.tip.` flag into that state (App
    // bookkeeping, 3a228a10). The queue runs on toast timers, so on a slow
    // runner a tip lands between the two snapshots; tips stay off here, as in
    // grumbler-aim, and combat-guidance specs cover them.
    app.updateSettings({ reduceMotion: false, combatGuidance: false });
    app.adoptSave(state, session);
  }, fixture);
  expect(await takeTurn(page)).toBe(true);
  await waitForIdle(page);
  const before = await page.evaluate(() => window.fnt!.app.state!);
  const healer = before.battle?.units.find((unit) => unit.id === fixture.healer.id);
  if (!healer) throw new Error('The healer is missing');
  const expected = apply(CONTENT, before, {
    type: 'useAbility',
    unitId: healer.id,
    abilityId: 'healing_stream',
    target: healer.pos,
  });
  await page.getByRole('button', { name: /^Healing Stream/ }).click();
  await settleMapCanvas(page);
  const target = await paintedTileCentre(page, healer.pos);
  if (!target) throw new Error('Missing painted healer tile');
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, target)).toBe(
    'CANVAS',
  );
  await page.mouse.click(target.x, target.y);
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await waitForIdle(page);
  expect(await page.evaluate(() => window.fnt!.app.state)).toEqual(expected.state);
  expect(expected.state.battle?.units.find((unit) => unit.id === healer.id)?.hp).toBeGreaterThan(1);
  const capture = info.outputPath('player-self-heal-control.png');
  await page.screenshot({ path: capture });
  await info.attach('player-self-heal-control', { path: capture, contentType: 'image/png' });
  expect(errors).toEqual([]);
});
