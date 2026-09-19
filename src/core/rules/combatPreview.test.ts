import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { tileAt, withSurface } from './grid';
import { previewAbility, resolveAbility } from './abilities';
import { BattleDraft } from '../state/battleDraft';
import { createBattle, createGame } from '../state/createGame';
import type { Ability, BattleState, StatusId, Unit, Vec2 } from '../types';

function ability(id: string) {
  const found = CONTENT.abilities.get(id);
  if (!found) throw new Error(`Missing ability ${id}`);
  return found;
}

function battleFor(encounterId: string, party = ['kaya', 'nilak']): BattleState {
  const game = createGame(CONTENT, {
    seed: `combat-preview-${encounterId}`,
    party: party.map((characterId) => ({ characterId, level: 3, autoChoose: true })),
    startNode: '',
  });
  const rng = new RngCursor(game.rng);
  return createBattle(CONTENT, game, encounterId, rng);
}

/** Keep only the bodies a scenario needs, then place them on known tiles. */
function placed(
  battle: BattleState,
  positions: Readonly<Record<string, Vec2>>,
  ids = Object.keys(positions),
): BattleState {
  const units = battle.units
    .filter((unit) => ids.includes(unit.id))
    .map((unit) => ({ ...unit, pos: positions[unit.id] ?? unit.pos }));
  return { ...battle, units, order: units.map((unit) => unit.id), turnIndex: 0 };
}

function resolve(battle: BattleState, caster: Unit, abilityId: string, target: Vec2): BattleDraft {
  const draft = new BattleDraft(CONTENT, battle, new RngCursor(0x12345678));
  const live = draft.unit(caster.id);
  if (!live) throw new Error('caster missing from draft');
  resolveAbility(draft, live, ability(abilityId), target, draft.rng);
  return draft;
}

function withStatus(unit: Unit, id: StatusId): Unit {
  return {
    ...unit,
    statuses: [...unit.statuses, { id, duration: 2, stacks: 1 }],
  };
}

function statusIds(unit: Unit | undefined): StatusId[] {
  return unit?.statuses.map((status) => status.id) ?? [];
}

describe('bounded combat outcome previews', () => {
  it('runs prop break before impact and leaves the source battle untouched', () => {
    const source = battleFor('enc_quarry_gate');
    const battle = placed(source, { p0: { x: 11, y: 4 } }, ['p0']);
    const caster = battle.units[0];
    if (!caster) throw new Error('caster missing');
    const target = { x: 12, y: 4 };
    const before = JSON.stringify(battle);

    const preview = previewAbility(CONTENT, battle, caster, ability('fire_jab'), target);
    const prop = preview.props.find((candidate) => candidate.propId === 'oil_flask');
    expect(prop?.destroyed).toBe(true);
    expect(prop?.breakLabel).toContain('oil spreads');
    expect(preview.reactions.some((entry) => entry.comboId === 'fire-into-oil')).toBe(true);
    expect(preview.reactions.find((entry) => entry.comboId === 'fire-into-oil')?.spreads).toBe(
      true,
    );
    expect(JSON.stringify(battle)).toBe(before);

    const actual = resolve(battle, caster, 'fire_jab', target);
    expect(actual.props.some((candidate) => candidate.propId === 'oil_flask')).toBe(false);
    expect(tileAt(actual.grid, target)?.surface?.id).toBe('fire');
    expect(tileAt(actual.grid, target)?.surface?.spread).toBeGreaterThan(0);
  });

  it('reports a broken water barrel and everyone its water will wet', () => {
    const source = battleFor('enc_quarry_gate');
    const battle = placed(source, { p0: { x: 13, y: 3 }, e6: { x: 15, y: 3 } }, ['p0', 'e6']);
    const caster = battle.units.find((unit) => unit.id === 'p0');
    const victim = battle.units.find((unit) => unit.id === 'e6');
    if (!caster || !victim) throw new Error('water barrel fixture missing a unit');
    const target = { x: 14, y: 3 };

    const preview = previewAbility(CONTENT, battle, caster, ability('rock_throw'), target);
    const prop = preview.props.find((candidate) => candidate.propId === 'water_barrel');
    expect(prop?.destroyed).toBe(true);
    expect(prop?.coverRemoved).toBe(true);
    expect(prop?.affectedEnemies.map((unit) => unit.unitId)).toContain(victim.id);
    expect(
      prop?.affectedEnemies
        .find((unit) => unit.unitId === victim.id)
        ?.statuses.some((status) => status.appliedStatus === 'wet'),
    ).toBe(true);
    expect(preview.reactions.some((entry) => entry.comboId === 'earth-into-water')).toBe(true);

    const actual = resolve(battle, caster, 'rock_throw', target);
    expect(actual.props.some((candidate) => candidate.id === prop?.id)).toBe(false);
    expect(statusIds(actual.unit(victim.id))).toContain('wet');
  });

  it('carries guaranteed prop contact into a later authored cleanse', () => {
    const source = battleFor('enc_quarry_gate');
    const battle = placed(source, { p0: { x: 12, y: 3 }, p1: { x: 15, y: 3 } }, ['p0', 'p1']);
    const caster = battle.units.find((unit) => unit.id === 'p0');
    const victim = battle.units.find((unit) => unit.id === 'p1');
    if (!caster || !victim) throw new Error('prop status order fixture missing a unit');

    const breakThenCleanse: Ability = {
      ...ability('shockwave'),
      id: 'preview_break_then_cleanse',
      effects: [
        { kind: 'damage', base: 5, scale: 0, damageType: 'earth' },
        { kind: 'cleanse', statuses: ['wet'] },
      ],
    };
    const target = { x: 14, y: 3 };
    const preview = previewAbility(CONTENT, battle, caster, breakThenCleanse, target);
    expect(preview.targets.find((entry) => entry.unitId === victim.id)?.clearedStatuses).toContain(
      'wet',
    );

    // The helper resolves the authored content ability, so use a draft here
    // to exercise this custom order against the same reducer path.
    const actualDraft = new BattleDraft(CONTENT, battle, new RngCursor(0x12345678));
    const actualCaster = actualDraft.unit(caster.id);
    if (!actualCaster) throw new Error('custom-order caster missing from draft');
    resolveAbility(actualDraft, actualCaster, breakThenCleanse, target, actualDraft.rng);
    expect(statusIds(actualDraft.unit(victim.id))).not.toContain('wet');
  });

  it('shows a brazier shove landing in oil without inventing a break', () => {
    const source = battleFor('enc_quarry_gate');
    const battle = placed(source, { p0: { x: 9, y: 5 } }, ['p0']);
    const caster = battle.units[0];
    if (!caster) throw new Error('caster missing');
    const target = { x: 10, y: 5 };

    const preview = previewAbility(CONTENT, battle, caster, ability('shove'), target);
    const prop = preview.props.find((candidate) => candidate.propId === 'brazier');
    const shove = preview.shoves.find((candidate) => candidate.kind === 'prop');
    expect(prop?.destroyed).toBe(false);
    expect(prop?.to).toEqual({ x: 11, y: 5 });
    expect(shove?.to).toEqual({ x: 11, y: 5 });
    expect(shove?.landingSurfaces).toContain('oil');

    const actual = resolve(battle, caster, 'shove', target);
    expect(actual.props.find((candidate) => candidate.propId === 'brazier')?.pos).toEqual({
      x: 11,
      y: 5,
    });
  });

  it('lets ally-target healing include the caster without widening hostile areas', () => {
    const source = battleFor('enc_forest_road', ['nilak', 'kaya']);
    const base = placed(source, { p0: { x: 1, y: 3 }, p1: { x: 4, y: 3 } }, ['p0', 'p1']);
    const battle = {
      ...base,
      units: base.units.map((unit) =>
        unit.id === 'p0'
          ? { ...withStatus(withStatus(unit, 'burning'), 'blinded'), hp: unit.hp - 8 }
          : unit,
      ),
    };
    const caster = battle.units.find((unit) => unit.id === 'p0');
    if (!caster) throw new Error('ally-target caster fixture missing');

    const healing = previewAbility(CONTENT, battle, caster, ability('healing_stream'), caster.pos);
    const selfHeal = healing.targets.find((target) => target.unitId === caster.id);
    expect(selfHeal?.heal).toBeGreaterThan(0);
    expect(selfHeal?.clearedStatuses).toEqual(['burning', 'blinded']);
    const healed = resolve(battle, caster, 'healing_stream', caster.pos);
    expect(healed.unit(caster.id)?.hp).toBeGreaterThan(caster.hp);
    expect(statusIds(healed.unit(caster.id))).not.toEqual(
      expect.arrayContaining(['burning', 'blinded']),
    );

    const selfPreview = previewAbility(CONTENT, battle, caster, ability('heat_shield'), caster.pos);
    expect(selfPreview.targets.find((target) => target.unitId === caster.id)?.statuses).toEqual([
      expect.objectContaining({ id: 'guarded', appliedStatus: 'guarded' }),
    ]);

    const hostileArea = previewAbility(CONTENT, battle, caster, ability('fire_blast'), caster.pos);
    expect(hostileArea.targets.some((target) => target.unitId === caster.id)).toBe(false);
    const hostileActual = resolve(battle, caster, 'fire_blast', caster.pos);
    expect(
      hostileActual.events.some((event) => event.type === 'damaged' && event.unitId === caster.id),
    ).toBe(false);
  });

  it('reports cabbage-cart status collateral and both shove destinations', () => {
    const source = battleFor('enc_quarry_gate');
    const battle = placed(source, { p0: { x: 4, y: 6 }, e6: { x: 7, y: 6 } }, ['p0', 'e6']);
    const caster = battle.units.find((unit) => unit.id === 'p0');
    const victim = battle.units.find((unit) => unit.id === 'e6');
    if (!caster || !victim) throw new Error('cart fixture missing a unit');
    const target = { x: 6, y: 6 };

    const preview = previewAbility(CONTENT, battle, caster, ability('shatterpoint'), target);
    const prop = preview.props.find((candidate) => candidate.propId === 'cabbage_cart');
    const affected = prop?.affectedEnemies.find((unit) => unit.unitId === victim.id);
    expect(prop?.destroyed).toBe(true);
    expect(affected?.statuses.find((status) => status.requestedStatus === 'blinded')?.chance).toBe(
      0.9,
    );
    expect(preview.shoves.filter((shove) => shove.id === victim.id).length).toBe(2);
    expect(preview.shoves.some((shove) => shove.to.x === 8)).toBe(true);
    expect(preview.shoves.some((shove) => shove.to.x === 10)).toBe(true);

    const actual = resolve(battle, caster, 'shatterpoint', target);
    expect(actual.unit(victim.id)?.pos).toEqual({ x: 10, y: 6 });
  });

  it('uses real shove pathing for edges, blockers, and a two-cell boss', () => {
    const edgeSource = battleFor('enc_forest_road');
    const edgeVictimId = edgeSource.units.find((unit) => unit.faction === 'enemy')?.id;
    if (!edgeVictimId) throw new Error('edge fixture has no enemy');
    const edgeBattle = placed(
      edgeSource,
      { p0: { x: 17, y: 3 }, [edgeVictimId]: { x: 18, y: 3 } },
      ['p0', edgeVictimId],
    );
    const edgeCaster = edgeBattle.units.find((unit) => unit.id === 'p0');
    const edgeVictim = edgeBattle.units.find((unit) => unit.id === edgeVictimId);
    if (!edgeCaster || !edgeVictim) throw new Error('edge fixture missing a unit');
    const edgePreview = previewAbility(
      CONTENT,
      edgeBattle,
      edgeCaster,
      ability('air_blast'),
      edgeVictim.pos,
    );
    const edgeShove = edgePreview.shoves.find((shove) => shove.id === edgeVictim.id);
    expect(edgeShove).toMatchObject({
      to: { x: 19, y: 3 },
      distance: 2,
      movedDistance: 1,
      blocked: true,
    });
    expect(
      resolve(edgeBattle, edgeCaster, 'air_blast', edgeVictim.pos).unit(edgeVictim.id)?.pos,
    ).toEqual({
      x: 19,
      y: 3,
    });

    const blockedVictimId = edgeSource.units.find((unit) => unit.faction === 'enemy')?.id;
    const blockedById = edgeSource.units.find((unit) => unit.id === 'p1')?.id;
    if (!blockedVictimId || !blockedById) throw new Error('blocker fixture is incomplete');
    const blockedBattle = placed(
      edgeSource,
      {
        p0: { x: 12, y: 3 },
        [blockedVictimId]: { x: 14, y: 3 },
        [blockedById]: { x: 15, y: 3 },
      },
      ['p0', blockedVictimId, blockedById],
    );
    const blockedCaster = blockedBattle.units.find((unit) => unit.id === 'p0');
    const blockedVictim = blockedBattle.units.find((unit) => unit.id === blockedVictimId);
    if (!blockedCaster || !blockedVictim) throw new Error('blocker fixture missing a unit');
    const blockedPreview = previewAbility(
      CONTENT,
      blockedBattle,
      blockedCaster,
      ability('air_blast'),
      blockedVictim.pos,
    );
    expect(blockedPreview.shoves.find((shove) => shove.id === blockedVictim.id)).toMatchObject({
      to: { x: 14, y: 3 },
      movedDistance: 0,
      blocked: true,
    });

    const bossSource = battleFor('enc_grumbler', ['nima', 'kaya']);
    const bossId = bossSource.units.find((unit) => unit.name === 'Grumbler')?.id;
    if (!bossId) throw new Error('boss fixture has no Grumbler');
    const bossBattle = placed(bossSource, { p0: { x: 13, y: 5 }, [bossId]: { x: 15, y: 5 } }, [
      'p0',
      bossId,
    ]);
    const bossCaster = bossBattle.units.find((unit) => unit.id === 'p0');
    const boss = bossBattle.units.find((unit) => unit.id === bossId);
    if (!bossCaster || !boss) throw new Error('boss fixture missing a unit');
    expect(boss.size).toBe(2);
    const bossPreview = previewAbility(
      CONTENT,
      bossBattle,
      bossCaster,
      ability('air_blast'),
      boss.pos,
    );
    expect(bossPreview.shoves.find((shove) => shove.id === boss.id)).toMatchObject({
      from: { x: 15, y: 5 },
      to: { x: 17, y: 5 },
      distance: 2,
      movedDistance: 2,
      blocked: false,
    });
    expect(resolve(bossBattle, bossCaster, 'air_blast', boss.pos).unit(boss.id)?.pos).toEqual({
      x: 17,
      y: 5,
    });
  });

  it('reports status upgrades, clears, and cleanse results without rolling', () => {
    const source = battleFor('enc_forest_road', ['nilak', 'kaya']);
    const base = placed(source, { p0: { x: 1, y: 3 }, p1: { x: 4, y: 3 } }, ['p0', 'p1']);
    const chilledBattle = {
      ...base,
      units: base.units.map((unit) => (unit.id === 'p1' ? withStatus(unit, 'chilled') : unit)),
    };
    const chilledCaster = chilledBattle.units.find((unit) => unit.id === 'p0');
    const chilledVictim = chilledBattle.units.find((unit) => unit.id === 'p1');
    if (!chilledCaster || !chilledVictim) throw new Error('status fixture missing a unit');
    const ice = previewAbility(
      CONTENT,
      chilledBattle,
      chilledCaster,
      ability('ice_spikes'),
      chilledVictim.pos,
    );
    expect(ice.targets[0]?.statuses[0]).toMatchObject({
      id: 'chilled',
      appliedStatus: 'frozen',
      clearedStatuses: ['chilled'],
    });

    const burningBattle = {
      ...base,
      units: base.units.map((unit) => (unit.id === 'p1' ? withStatus(unit, 'burning') : unit)),
    };
    const burningCaster = burningBattle.units.find((unit) => unit.id === 'p0');
    const burningVictim = burningBattle.units.find((unit) => unit.id === 'p1');
    if (!burningCaster || !burningVictim) throw new Error('burning fixture missing a unit');
    const wet = previewAbility(
      CONTENT,
      burningBattle,
      burningCaster,
      ability('water_whip'),
      burningVictim.pos,
    );
    expect(wet.targets[0]?.statuses[0]?.clearedStatuses).toContain('burning');

    const cleanseBattle = {
      ...base,
      units: base.units.map((unit) =>
        unit.id === 'p1' ? withStatus(withStatus(unit, 'burning'), 'blinded') : unit,
      ),
    };
    const cleanseCaster = cleanseBattle.units.find((unit) => unit.id === 'p0');
    const cleanseVictim = cleanseBattle.units.find((unit) => unit.id === 'p1');
    if (!cleanseCaster || !cleanseVictim) throw new Error('cleanse fixture missing a unit');
    const cleanse = previewAbility(
      CONTENT,
      cleanseBattle,
      cleanseCaster,
      ability('healing_stream'),
      cleanseVictim.pos,
    );
    expect(cleanse.targets.find((target) => target.unitId === cleanseVictim.id)).toMatchObject({
      heal: expect.any(Number),
      clearedStatuses: ['burning', 'blinded'],
    });
    expect(statusIds(cleanseBattle.units.find((unit) => unit.id === cleanseVictim.id))).toEqual([
      'burning',
      'blinded',
    ]);
  });

  it('keeps chance branches descriptive while applying guaranteed statuses in order', () => {
    const source = battleFor('enc_forest_road', ['nilak', 'kaya']);
    const battle = placed(source, { p0: { x: 1, y: 3 }, p1: { x: 4, y: 3 } }, ['p0', 'p1']);
    const caster = battle.units.find((unit) => unit.id === 'p0');
    const victim = battle.units.find((unit) => unit.id === 'p1');
    if (!caster || !victim) throw new Error('mixed status fixture missing a unit');

    const mixed: Ability = {
      ...ability('water_whip'),
      id: 'preview_mixed_statuses',
      effects: [
        { kind: 'status', status: 'wet', duration: 2, chance: 0.5, to: 'hit' },
        { kind: 'status', status: 'stunned', duration: 1, chance: 1, to: 'hit' },
      ],
    };
    const preview = previewAbility(CONTENT, battle, caster, mixed, victim.pos);
    expect(preview.statuses.filter((status) => status.unitId === victim.id)).toEqual([
      expect.objectContaining({ requestedStatus: 'wet', appliedStatus: 'wet', chance: 0.5 }),
      expect.objectContaining({ requestedStatus: 'stunned', appliedStatus: 'stunned', chance: 1 }),
    ]);

    const ordered: Ability = {
      ...mixed,
      id: 'preview_ordered_statuses',
      effects: [
        { kind: 'status', status: 'chilled', duration: 2, chance: 1, to: 'hit' },
        { kind: 'status', status: 'chilled', duration: 2, chance: 1, to: 'hit' },
      ],
    };
    const upgraded = previewAbility(CONTENT, battle, caster, ordered, victim.pos);
    expect(upgraded.statuses.filter((status) => status.unitId === victim.id)).toEqual([
      expect.objectContaining({ requestedStatus: 'chilled', appliedStatus: 'chilled' }),
      expect.objectContaining({
        requestedStatus: 'chilled',
        appliedStatus: 'frozen',
        clearedStatuses: ['chilled'],
      }),
    ]);
    expect(statusIds(battle.units.find((unit) => unit.id === victim.id))).toEqual([]);

    const landingBattle = {
      ...battle,
      grid: withSurface(
        battle.grid,
        { x: 5, y: 3 },
        {
          id: 'ice',
          duration: 3,
          spread: 0,
        },
      ),
    };
    const shoveThenStatus: Ability = {
      ...mixed,
      id: 'preview_contact_chance',
      effects: [
        { kind: 'push', distance: 1 },
        { kind: 'status', status: 'stunned', duration: 1, chance: 1, to: 'hit' },
      ],
    };
    const landing = previewAbility(CONTENT, landingBattle, caster, shoveThenStatus, victim.pos);
    expect(landing.shoves[0]?.landingStatuses).toEqual([{ id: 'chilled', chance: 0.4 }]);
    expect(landing.statuses.find((status) => status.requestedStatus === 'stunned')).toMatchObject({
      appliedStatus: 'stunned',
      chance: 1,
    });
  });
});
