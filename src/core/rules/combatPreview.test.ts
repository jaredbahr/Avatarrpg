import { describe, expect, it } from 'vitest';
import { formatShoveMovement } from '../../app/ui/combatPreviewText';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { DEFAULT_TILE, tileAt, withSurface, withTile } from './grid';
import { hitBreakdown, hitChance, rollHit } from './damage';
import { weatherAt } from './obscurement';
import { previewAbility, resolveAbility } from './abilities';
import { BattleDraft } from '../state/battleDraft';
import { createBattle, createGame } from '../state/createGame';
import type { Ability, BattleState, ContentIndex, Grid, StatusId, Unit, Vec2 } from '../types';

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

function resolve(
  battle: BattleState,
  caster: Unit,
  abilityId: string,
  target: Vec2,
  squareFootprints?: boolean,
): BattleDraft {
  const draft = new BattleDraft(CONTENT, battle, new RngCursor(0x12345678), {
    squareFootprints,
  });
  const live = draft.unit(caster.id);
  if (!live) throw new Error('caster missing from draft');
  resolveAbility(draft, live, ability(abilityId), target, draft.rng);
  return draft;
}

/** Flat, empty ground so a shove path has nothing to snag on. */
function openGround(battle: BattleState): BattleState {
  return {
    ...battle,
    grid: {
      ...battle.grid,
      tiles: battle.grid.tiles.map((tile) => ({
        ...tile,
        blocked: false,
        blocksSight: false,
        cover: false,
        elevation: 0,
        terrain: 'dirt',
      })),
    },
  };
}

/** Wall a single cell's sight without changing anything else about the ground. */
function withSightBlocker(battle: BattleState, pos: Vec2): BattleState {
  const tile = tileAt(battle.grid, pos);
  if (!tile) throw new Error(`Off-grid blocker ${pos.x},${pos.y}`);
  return { ...battle, grid: withTile(battle.grid, pos, { ...tile, blocksSight: true }) };
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
    // Enemy ids follow the map's props in the serial, so look one up instead of naming it.
    const enemyId = source.units.find((unit) => unit.faction === 'enemy')?.id;
    if (!enemyId) throw new Error('water barrel fixture has no enemy');
    const battle = placed(source, { p0: { x: 13, y: 3 }, [enemyId]: { x: 15, y: 3 } }, [
      'p0',
      enemyId,
    ]);
    const caster = battle.units.find((unit) => unit.id === 'p0');
    const victim = battle.units.find((unit) => unit.id === enemyId);
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
    expect(preview.terrain).not.toContain('Pushes 1');

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
    expect(selfHeal?.heal).toBe(caster.base.maxHp - caster.hp);
    expect(selfHeal?.healAtCapacity).toBe(false);
    // Nothing was rolled, so there is nothing to break down.
    expect(selfHeal?.hitBreakdown).toBeNull();
    expect(selfHeal?.clearedStatuses).toEqual(['burning', 'blinded']);

    const ally = battle.units.find((unit) => unit.id === 'p1');
    if (!ally) throw new Error('ally healing fixture missing');
    const allyBattle = {
      ...battle,
      units: battle.units.map((unit) =>
        unit.id === ally.id ? { ...unit, hp: unit.hp - 3 } : unit,
      ),
    };
    const allyPreview = previewAbility(
      CONTENT,
      allyBattle,
      caster,
      ability('healing_stream'),
      ally.pos,
    );
    const allyHeal = allyPreview.targets.find((target) => target.unitId === ally.id);
    expect(allyHeal?.heal).toBe(
      ally.base.maxHp - allyBattle.units.find((unit) => unit.id === ally.id)!.hp,
    );
    expect(allyHeal?.healAtCapacity).toBe(false);

    const fullPreview = previewAbility(
      CONTENT,
      battle,
      caster,
      ability('healing_stream'),
      ally.pos,
    );
    const fullAlly = fullPreview.targets.find((target) => target.unitId === ally.id);
    expect(fullAlly).toMatchObject({ heal: 0, healAtCapacity: true, clearedStatuses: [] });
    expect(fullPreview.terrain).not.toContain('Clears effects');
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

  it('caps multiple heal effects against the remaining HP capacity', () => {
    const source = battleFor('enc_forest_road', ['nilak', 'kaya']);
    const base = placed(source, { p0: { x: 1, y: 3 }, p1: { x: 4, y: 3 } }, ['p0', 'p1']);
    const battle = {
      ...base,
      units: base.units.map((unit) =>
        unit.id === 'p0' ? { ...unit, hp: unit.base.maxHp - 5 } : unit,
      ),
    };
    const caster = battle.units.find((unit) => unit.id === 'p0');
    if (!caster) throw new Error('multi-heal caster fixture missing');

    const doubleHeal: Ability = {
      ...ability('healing_stream'),
      id: 'preview_double_heal',
      effects: [
        { kind: 'heal', base: 8, scale: 0 },
        { kind: 'heal', base: 8, scale: 0 },
      ],
    };
    const preview = previewAbility(CONTENT, battle, caster, doubleHeal, caster.pos);
    expect(preview.targets.find((target) => target.unitId === caster.id)).toMatchObject({
      heal: 5,
    });
  });

  it('reports cabbage-cart status collateral and both shove destinations', () => {
    const source = battleFor('enc_quarry_gate');
    const enemyId = source.units.find((unit) => unit.faction === 'enemy')?.id;
    if (!enemyId) throw new Error('cart fixture has no enemy');
    const placedBattle = placed(source, { p0: { x: 4, y: 6 }, [enemyId]: { x: 7, y: 6 } }, [
      'p0',
      enemyId,
    ]);
    let grid = placedBattle.grid;
    for (const [x, elevation] of [
      [7, 2],
      [8, 1],
      [9, 1],
      [10, 0],
    ] as const) {
      const tile = tileAt(grid, { x, y: 6 });
      if (!tile) throw new Error('cart ledge fixture is off-grid');
      grid = withTile(grid, { x, y: 6 }, { ...tile, elevation });
    }
    const battle = { ...placedBattle, grid };
    const caster = battle.units.find((unit) => unit.id === 'p0');
    const victim = battle.units.find((unit) => unit.id === enemyId);
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
    expect(
      preview.shoves
        .filter((shove) => shove.id === victim.id)
        .map((shove) => shove.originKind)
        .sort(),
    ).toEqual(['area', 'propBreak']);
    expect(preview.shoves.some((shove) => shove.to.x === 8)).toBe(true);
    expect(preview.shoves.some((shove) => shove.to.x === 10)).toBe(true);
    expect(
      preview.shoves
        .filter((shove) => shove.id === victim.id)
        .map((shove) => shove.ledgeDropDamage),
    ).toEqual([3, 3]);

    const actual = resolve(battle, caster, 'shatterpoint', target);
    expect(actual.unit(victim.id)?.pos).toEqual({ x: 10, y: 6 });
  });

  it('classifies shove origins and deliberate zero-movement stops', () => {
    const source = battleFor('enc_forest_road');
    const victimId = source.units.find((unit) => unit.faction === 'enemy')?.id;
    if (!victimId) throw new Error('origin fixture has no enemy');
    const battle = placed(openGround(source), { p0: { x: 5, y: 5 }, [victimId]: { x: 6, y: 5 } }, [
      'p0',
      victimId,
    ]);
    const caster = battle.units.find((unit) => unit.id === 'p0');
    const victim = battle.units.find((unit) => unit.id === victimId);
    if (!caster || !victim) throw new Error('origin fixture is incomplete');

    const melee = previewAbility(CONTENT, battle, caster, ability('shove'), victim.pos).shoves[0];
    expect(melee).toMatchObject({ originKind: 'caster', stopReason: null });

    const pull = previewAbility(CONTENT, battle, caster, ability('water_pull'), victim.pos)
      .shoves[0];
    expect(pull).toMatchObject({
      originKind: 'caster',
      movedDistance: 0,
      stopReason: 'adjacent',
    });

    const centre = previewAbility(CONTENT, battle, caster, ability('shockwave'), victim.pos)
      .shoves[0];
    expect(centre).toMatchObject({
      originKind: 'area',
      movedDistance: 0,
      stopReason: 'centre',
    });

    const coneBattle = placed(battle, { p0: { x: 5, y: 5 }, [victimId]: { x: 7, y: 5 } }, [
      'p0',
      victimId,
    ]);
    const coneCaster = coneBattle.units.find((unit) => unit.id === 'p0');
    const coneVictim = coneBattle.units.find((unit) => unit.id === victimId);
    if (!coneCaster || !coneVictim) throw new Error('cone fixture is incomplete');
    expect(
      previewAbility(CONTENT, coneBattle, coneCaster, ability('gust'), coneVictim.pos).shoves[0],
    ).toMatchObject({ originKind: 'caster' });

    const tileShove: Ability = {
      ...ability('shockwave'),
      id: 'preview_tile_shove',
      targeting: { shape: 'tile' },
    };
    expect(previewAbility(CONTENT, battle, caster, tileShove, victim.pos).shoves[0]).toMatchObject({
      originKind: 'area',
      stopReason: 'centre',
    });

    const selfPull: Ability = {
      ...ability('water_pull'),
      id: 'preview_self_pull',
      targeting: { shape: 'self' },
    };
    expect(previewAbility(CONTENT, battle, caster, selfPull, caster.pos).shoves[0]).toMatchObject({
      id: caster.id,
      from: caster.pos,
      originKind: 'caster',
      stopReason: 'centre',
    });
  });

  it('a real Water Pull that ends beside the caster moved, not "already there"', () => {
    const source = openGround(battleFor('enc_forest_road'));
    const victimId = source.units.find((unit) => unit.faction === 'enemy')?.id;
    if (!victimId) throw new Error('water pull fixture has no enemy');
    const battle = placed(source, { p0: { x: 3, y: 5 }, [victimId]: { x: 6, y: 5 } }, [
      'p0',
      victimId,
    ]);
    const caster = battle.units.find((unit) => unit.id === 'p0');
    if (!caster) throw new Error('water pull caster is missing');
    const shove = previewAbility(CONTENT, battle, caster, ability('water_pull'), { x: 6, y: 5 })
      .shoves[0];
    expect(shove).toMatchObject({ to: { x: 4, y: 5 }, movedDistance: 2, stopReason: 'adjacent' });
    if (!shove) throw new Error('no shove forecast');
    expect(
      formatShoveMovement(
        shove.name,
        shove.mode,
        shove.movedDistance,
        shove.distance,
        shove.stopReason,
        [],
        shove.originKind,
      ),
    ).toBe(`${shove.name}: pulled 2 tiles closer`);
  });

  it('uses slide stop reasons for diagonal blockers and caster-footprint contact', () => {
    const source = openGround(battleFor('enc_forest_road'));
    const victimId = source.units.find((unit) => unit.faction === 'enemy')?.id;
    if (!victimId) throw new Error('stop-reason fixture has no enemy');

    const diagonalBase = placed(source, { p0: { x: 3, y: 5 }, [victimId]: { x: 7, y: 6 } }, [
      'p0',
      victimId,
    ]);
    const blockingTile = tileAt(diagonalBase.grid, { x: 5, y: 4 });
    if (!blockingTile) throw new Error('diagonal blocker is off-grid');
    const diagonalBattle = {
      ...diagonalBase,
      grid: withTile(diagonalBase.grid, { x: 5, y: 4 }, { ...blockingTile, blocked: true }),
    };
    const diagonalCaster = diagonalBattle.units.find((unit) => unit.id === 'p0');
    if (!diagonalCaster) throw new Error('diagonal caster is missing');
    const blastPull: Ability = {
      ...ability('water_pull'),
      id: 'preview_diagonal_blast_pull',
      range: 9,
      requiresLineOfSight: false,
      targeting: { shape: 'blast', radius: 2 },
      effects: [{ kind: 'pull', distance: 2 }],
    };
    expect(
      previewAbility(CONTENT, diagonalBattle, diagonalCaster, blastPull, { x: 5, y: 5 }).shoves[0],
    ).toMatchObject({
      to: { x: 6, y: 5 },
      movedDistance: 1,
      stopReason: 'obstacle',
    });

    const wideBase = placed(source, { p0: { x: 7, y: 5 }, [victimId]: { x: 5, y: 5 } }, [
      'p0',
      victimId,
    ]);
    const wideBattle: BattleState = {
      ...wideBase,
      units: wideBase.units.map((unit) =>
        unit.id === victimId ? { ...unit, size: 2 as const } : unit,
      ),
    };
    const wideCaster = wideBattle.units.find((unit) => unit.id === 'p0');
    if (!wideCaster) throw new Error('wide-unit caster is missing');
    expect(
      previewAbility(CONTENT, wideBattle, wideCaster, ability('water_pull'), { x: 5, y: 5 })
        .shoves[0],
    ).toMatchObject({ movedDistance: 0, stopReason: 'adjacent', originKind: 'caster' });
  });

  it('keeps resolved push and pull destinations unchanged by stop-reason reporting', () => {
    const source = openGround(battleFor('enc_forest_road'));
    const victimId = source.units.find((unit) => unit.faction === 'enemy')?.id;
    if (!victimId) throw new Error('resolution fixture has no enemy');
    const battle = placed(source, { p0: { x: 5, y: 5 }, [victimId]: { x: 7, y: 5 } }, [
      'p0',
      victimId,
    ]);
    const caster = battle.units.find((unit) => unit.id === 'p0');
    if (!caster) throw new Error('resolution caster is missing');

    expect(resolve(battle, caster, 'air_blast', { x: 7, y: 5 }).unit(victimId)?.pos).toEqual({
      x: 9,
      y: 5,
    });
    expect(resolve(battle, caster, 'water_pull', { x: 7, y: 5 }).unit(victimId)?.pos).toEqual({
      x: 6,
      y: 5,
    });
  });

  it('uses real shove pathing for edges, blockers, and a legacy 2x1 boss', () => {
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
      stopReason: 'obstacle',
    });

    const bossSource = battleFor('enc_grumbler', ['nima', 'kaya']);
    const bossId = bossSource.units.find((unit) => unit.name === 'Grumbler')?.id;
    if (!bossId) throw new Error('boss fixture has no Grumbler');
    // Row 3 runs clear to the east edge; rows 4-7 end in the drill shaft.
    const bossBattle = placed(bossSource, { p0: { x: 13, y: 3 }, [bossId]: { x: 15, y: 3 } }, [
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
      false,
    );
    expect(bossPreview.shoves.find((shove) => shove.id === boss.id)).toMatchObject({
      from: { x: 15, y: 3 },
      to: { x: 17, y: 3 },
      distance: 2,
      movedDistance: 2,
      blocked: false,
    });
    expect(
      resolve(bossBattle, bossCaster, 'air_blast', boss.pos, false).unit(boss.id)?.pos,
    ).toEqual({ x: 17, y: 3 });
    // Shipped 2x2 twin: the preview and reducer must agree even though the
    // square's lower row changes where this legacy-clear lane stops it.
    const squareBossShove = previewAbility(
      CONTENT,
      bossBattle,
      bossCaster,
      ability('air_blast'),
      boss.pos,
      true,
    ).shoves.find((shove) => shove.id === boss.id);
    expect(resolve(bossBattle, bossCaster, 'air_blast', boss.pos, true).unit(boss.id)?.pos).toEqual(
      squareBossShove?.to,
    );

    // Its second cell stops at the shaft's lip: one step, then blocked.
    const shaftBattle = placed(bossSource, { p0: { x: 13, y: 5 }, [bossId]: { x: 15, y: 5 } }, [
      'p0',
      bossId,
    ]);
    const shaftCaster = shaftBattle.units.find((unit) => unit.id === 'p0');
    const shaftBoss = shaftBattle.units.find((unit) => unit.id === bossId);
    if (!shaftCaster || !shaftBoss) throw new Error('shaft fixture missing a unit');
    expect(
      previewAbility(
        CONTENT,
        shaftBattle,
        shaftCaster,
        ability('air_blast'),
        shaftBoss.pos,
        false,
      ).shoves.find((shove) => shove.id === shaftBoss.id),
    ).toMatchObject({ to: { x: 16, y: 5 }, movedDistance: 1, blocked: true });

    const icePath = previewAbility(
      CONTENT,
      bossBattle,
      bossCaster,
      ability('ice_path'),
      boss.pos,
      false,
    );
    expect(icePath.targets).toHaveLength(0);
    expect(icePath.surfaceContacts).toHaveLength(2);
    for (const contact of icePath.surfaceContacts) {
      expect(contact).toEqual(
        expect.objectContaining({
          unitId: boss.id,
          name: boss.name,
          surface: 'ice',
          status: expect.objectContaining({
            requestedStatus: 'chilled',
            appliedStatus: 'chilled',
            chance: 0.4,
          }),
        }),
      );
    }

    const alreadyIced = {
      ...bossBattle,
      grid: withSurface(bossBattle.grid, boss.pos, { id: 'ice', duration: 3, spread: 0 }),
    };
    const refreshIce: Ability = {
      ...ability('ice_path'),
      id: 'preview_refresh_ice',
      targeting: { shape: 'tile' },
      effects: [{ kind: 'surface', surface: 'ice', duration: 3, area: 'center' }],
    };
    const refreshPreview = previewAbility(
      CONTENT,
      alreadyIced,
      bossCaster,
      refreshIce,
      boss.pos,
      false,
    );
    expect(refreshPreview.surfaceContacts).toEqual([]);
    expect(refreshPreview.targets).toEqual([]);
  });

  it('pushes a legacy 2x1 caster away from the cell that reached the target', () => {
    const source = battleFor('enc_quarry_gate');
    const casterId = source.units.find((unit) => unit.faction === 'party')?.id;
    const victimId = source.units.find((unit) => unit.faction === 'enemy')?.id;
    if (!casterId || !victimId) throw new Error('size-2 caster fixture is incomplete');

    const target = { x: 2, y: 5 };
    const placedBattle = placed(
      openGround(source),
      { [casterId]: { x: 2, y: 2 }, [victimId]: target },
      [casterId, victimId],
    );
    /*
     * (2,3) walls the anchor cell (2,2) off from the target, so only the second
     * cell (3,2) can see it. That cell is the firing origin, and the push has
     * to run away from it — down-left here, not straight down from the anchor.
     */
    const blocked = withSightBlocker(placedBattle, { x: 2, y: 3 });
    const battle: BattleState = {
      ...blocked,
      units: blocked.units.map((unit) =>
        unit.id === casterId ? { ...unit, size: 2 as const } : unit,
      ),
    };
    const caster = battle.units.find((unit) => unit.id === casterId);
    if (!caster) throw new Error('size-2 caster is missing');
    expect(caster.size).toBe(2);

    const preview = previewAbility(CONTENT, battle, caster, ability('air_blast'), target, false);
    expect(preview.shoves.find((shove) => shove.id === victimId)).toMatchObject({
      to: { x: 0, y: 7 },
      originKind: 'caster',
    });
    expect(preview.terrain.some((note) => note.startsWith('Pushes '))).toBe(false);

    const actual = resolve(battle, caster, 'air_blast', target, false);
    expect(actual.unit(victimId)?.pos).toEqual({ x: 0, y: 7 });

    // Shipped 2x2 twin: its extra firing origins may choose a different shove
    // vector, but bounded preview and actual resolution stay identical.
    const squareShove = previewAbility(
      CONTENT,
      battle,
      caster,
      ability('air_blast'),
      target,
      true,
    ).shoves.find((shove) => shove.id === victimId);
    expect(resolve(battle, caster, 'air_blast', target, true).unit(victimId)?.pos).toEqual(
      squareShove?.to,
    );
  });

  it('records lethal surface contact with actual HP loss and no post-death status', () => {
    const source = battleFor('enc_forest_road');
    const enemyId = source.units.find((unit) => unit.faction === 'enemy')?.id;
    if (!enemyId) throw new Error('lethal contact fixture has no enemy');
    const base = placed(source, { p0: { x: 1, y: 3 }, [enemyId]: { x: 4, y: 3 } }, ['p0', enemyId]);
    const battle = {
      ...base,
      units: base.units.map((unit) => (unit.id === enemyId ? { ...unit, hp: 1 } : unit)),
    };
    const caster = battle.units.find((unit) => unit.id === 'p0');
    const victim = battle.units.find((unit) => unit.id === enemyId);
    if (!caster || !victim) throw new Error('lethal contact fixture missing a unit');

    const preview = previewAbility(CONTENT, battle, caster, ability('fire_wall'), victim.pos);
    expect(preview.surfaceContacts).toEqual([
      expect.objectContaining({
        unitId: victim.id,
        surface: 'fire',
        damage: 1,
        status: null,
      }),
    ]);

    const actual = resolve(battle, caster, 'fire_wall', victim.pos);
    expect(actual.unit(victim.id)?.hp).toBe(0);
    expect(actual.events).toContainEqual({ type: 'unitDied', unitId: victim.id });
  });

  it('does not mark a harmless friendly surface contact as damage warning', () => {
    const source = battleFor('enc_forest_road', ['nilak', 'kaya']);
    const battle = placed(source, { p0: { x: 1, y: 3 }, p1: { x: 4, y: 3 } }, ['p0', 'p1']);
    const caster = battle.units.find((unit) => unit.id === 'p0');
    const ally = battle.units.find((unit) => unit.id === 'p1');
    if (!caster || !ally) throw new Error('harmless surface fixture missing a unit');
    const oilPaint: Ability = {
      ...ability('ice_path'),
      id: 'preview_oil_paint',
      targeting: { shape: 'tile' },
      effects: [{ kind: 'surface', surface: 'oil', duration: -1, area: 'center' }],
    };

    const preview = previewAbility(CONTENT, battle, caster, oilPaint, ally.pos);
    expect(preview.surfaceContacts).toEqual([
      expect.objectContaining({ unitId: ally.id, surface: 'oil', damage: 0, status: null }),
    ]);
    expect(preview.hitsFriendly).toBe(false);
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

/**
 * Obscurement must reach the confirm step, or the preview lies about a mechanic
 * the player can see on the board.
 */
describe('obscurement preview parity', () => {
  function openGrid(width = 10, height = 5): Grid {
    return { width, height, tiles: Array.from({ length: width * height }, () => DEFAULT_TILE) };
  }

  /** The forest road plus a sandstorm, kept out of `content/` on purpose. */
  function stormContent(): ContentIndex {
    const encounter = CONTENT.encounters.get('enc_forest_road');
    if (!encounter) throw new Error('Missing forest road encounter');
    return {
      ...CONTENT,
      encounters: new Map(CONTENT.encounters).set('enc_forest_road', {
        ...encounter,
        weather: { id: 'sandstorm', schedule: [{ fromRound: 1, intensity: 2 }] },
      }),
    };
  }

  /** One caster and one victim four tiles apart on a clean board. */
  function pair(content: ContentIndex, steamCells: readonly Vec2[] = []) {
    const game = createGame(content, {
      seed: 'obscurement-preview',
      party: [{ characterId: 'kaya', level: 3, autoChoose: true }],
      startNode: '',
    });
    const rng = new RngCursor(game.rng);
    const base = createBattle(content, game, 'enc_forest_road', rng, { variantId: 'thugs' });
    const casterBase = base.units.find((unit) => unit.faction === 'party');
    const victimBase = base.units.find((unit) => unit.faction === 'enemy');
    if (!casterBase || !victimBase) throw new Error('Missing preview fixture units');

    let grid = openGrid();
    for (const cell of steamCells) {
      grid = withSurface(grid, cell, { id: 'steam', duration: 2, spread: 0 });
    }

    const caster: Unit = { ...casterBase, pos: { x: 1, y: 2 } };
    const victim: Unit = { ...victimBase, pos: { x: 5, y: 2 } };
    const units = [caster, victim];
    // Props keep their real-map coordinates, which belong to a grid we replaced.
    const battle: BattleState = {
      ...base,
      grid,
      units,
      order: units.map((unit) => unit.id),
      props: [],
    };
    return { content, battle, caster, victim };
  }

  it('previews the same chance the roll uses inside, through and under weather', () => {
    const inside = pair(CONTENT, [{ x: 5, y: 2 }]);
    const insidePreview = previewAbility(
      CONTENT,
      inside.battle,
      inside.caster,
      ability('rock_throw'),
      inside.victim.pos,
    );
    const insideRow = insidePreview.targets.find((t) => t.unitId === inside.victim.id);
    expect(insideRow?.hitChance).toBe(65);
    expect(insideRow?.hitChance).toBe(
      hitChance(CONTENT, inside.battle.grid, inside.caster, inside.victim),
    );

    const through = pair(CONTENT, [{ x: 3, y: 2 }]);
    const throughPreview = previewAbility(
      CONTENT,
      through.battle,
      through.caster,
      ability('rock_throw'),
      through.victim.pos,
    );
    expect(throughPreview.targets.find((t) => t.unitId === through.victim.id)?.hitChance).toBe(75);
    expect(throughPreview.targets.find((t) => t.unitId === through.victim.id)?.hitChance).toBe(
      hitChance(CONTENT, through.battle.grid, through.caster, through.victim),
    );

    const storm = stormContent();
    const weather = pair(storm);
    expect(weatherAt(storm, weather.battle.encounterId, weather.battle.round)).toBe(2);
    const weatherPreview = previewAbility(
      storm,
      weather.battle,
      weather.caster,
      ability('rock_throw'),
      weather.victim.pos,
    );
    const weatherRow = weatherPreview.targets.find((t) => t.unitId === weather.victim.id);
    expect(weatherRow?.hitChance).toBe(60);
    expect(weatherRow?.hitChance).toBe(
      hitChance(storm, weather.battle.grid, weather.caster, weather.victim, 2),
    );
  });

  it('hands the roll the exact probability the preview showed', () => {
    const rolls = (content: ContentIndex, steamCells: readonly Vec2[], weather: 0 | 1 | 2) => {
      const { battle, caster, victim } = pair(content, steamCells);
      const probabilities: number[] = [];
      // A cursor that records the probability it is asked for and never misses.
      const spy = {
        chance: (probability: number) => {
          probabilities.push(probability);
          return true;
        },
      } as unknown as RngCursor;
      rollHit(spy, content, battle.grid, caster, victim, weather);
      return probabilities[0];
    };

    expect(rolls(CONTENT, [{ x: 5, y: 2 }], 0)).toBe(0.65);
    expect(rolls(CONTENT, [{ x: 3, y: 2 }], 0)).toBe(0.75);
    expect(rolls(stormContent(), [], 2)).toBe(0.6);
  });

  it('hands the confirm step the whole breakdown, not just the total', () => {
    // A cloud on the target and one on the line, cover on the target's tile and
    // the caster a tier above: every component is non-zero at once.
    const base = pair(CONTENT, [
      { x: 5, y: 2 },
      { x: 3, y: 2 },
    ]);
    const casterTile = tileAt(base.battle.grid, base.caster.pos);
    const victimTile = tileAt(base.battle.grid, base.victim.pos);
    if (!casterTile || !victimTile) throw new Error('Missing breakdown fixture tiles');
    const grid = withTile(
      withTile(base.battle.grid, base.caster.pos, { ...casterTile, elevation: 1 }),
      base.victim.pos,
      { ...victimTile, cover: true },
    );
    const battle: BattleState = { ...base.battle, grid };
    const { caster, victim } = base;

    const preview = previewAbility(CONTENT, battle, caster, ability('rock_throw'), victim.pos);
    const row = preview.targets.find((t) => t.unitId === victim.id);
    if (!row) throw new Error('Preview lost the breakdown target');

    const weather = weatherAt(CONTENT, battle.encounterId, battle.round);
    expect(row.hitBreakdown).toEqual(hitBreakdown(CONTENT, grid, caster, victim, weather));
    expect(row.hitChance).toBe(row.hitBreakdown?.chance);
    expect(row.hitBreakdown).toMatchObject({
      chance: 50,
      base: 90,
      elevation: 10,
      cover: -20,
      plunging: 10,
      statuses: 0,
      obscurement: { inside: -25, through: -15, attacker: 0, weather: 0, total: -40 },
    });

    // RNG-free: the second preview is identical and the source battle is not
    // touched, so opening and closing the confirm step cannot change the shot.
    const before = JSON.stringify(battle);
    const again = previewAbility(CONTENT, battle, caster, ability('rock_throw'), victim.pos);
    expect(again.targets).toEqual(preview.targets);
    expect(JSON.stringify(battle)).toBe(before);
  });
});
