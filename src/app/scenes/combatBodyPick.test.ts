import { describe, expect, it } from 'vitest';
import type { Unit, Vec2 } from '../../core/types';
import { Camera } from '../../render/camera';
import { actorSilhouetteGeometry } from '../../render/geometry/actorSilhouette';
import { resolveCombatBodyPick } from './combatBodyPick';

function unit(id: string, pos: Vec2, size: 1 | 2 = 2): Unit {
  return {
    id,
    name: id,
    faction: 'enemy',
    element: 'earth',
    characterId: null,
    enemyId: 'driller',
    disciplineId: null,
    level: 1,
    xp: 0,
    pos,
    size,
    hp: 10,
    ap: 2,
    move: 3,
    bankedAp: 0,
    pendingAp: 0,
    base: { maxHp: 10, maxAp: 2, maxMove: 3, power: 1, defense: 1, speed: 1, focus: 1 },
    abilities: [],
    cooldowns: {},
    statuses: [],
    ai: 'none',
    temporary: false,
    sprite: 'unit.enemy.driller',
  };
}

function fixture(projection: 'orthographic' | 'oblique', size: 1 | 2 = 2, square = true) {
  const boss = unit('boss', { x: 15, y: 5 }, size);
  const camera = new Camera(
    { width: 1194, height: 540, dpr: 1 },
    { width: 24, height: 14 },
    projection,
  );
  camera.scale = 1;
  camera.centre();
  const box = camera.spriteBox(boss.pos, boss.size, square);
  const silhouette = actorSilhouetteGeometry(
    { ...box, width: box.size * boss.size },
    boss.size,
    null,
    2,
  );
  const point = {
    x: box.x + box.size,
    y: (silhouette.bar.silhouetteTop + box.y + box.size * 0.86) / 2,
  };
  return { boss, box, point };
}

describe('large upright actor body picking', () => {
  for (const projection of ['orthographic', 'oblique'] as const) {
    it(`resolves empty floor inside a scaled 2x2 body in ${projection}`, () => {
      const { boss, box, point } = fixture(projection);
      const result = resolveCombatBodyPick({
        point,
        groundTile: { x: 12, y: 3 },
        actors: [{ unit: boss, box, scale: 2, frameHeadroom: null }],
        units: [boss],
        props: [],
        protectedTiles: new Set(),
        caster: { x: 10, y: 5 },
      });
      expect(result.unit?.id).toBe('boss');
      expect(result.tile).toEqual({ x: 15, y: 5 });
    });
  }

  it('leaves a reachable move cell under the body unchanged', () => {
    const { boss, box, point } = fixture('oblique');
    const groundTile = { x: 12, y: 3 };
    expect(
      resolveCombatBodyPick({
        point,
        groundTile,
        actors: [{ unit: boss, box, scale: 2, frameHeadroom: null }],
        units: [boss],
        props: [],
        protectedTiles: new Set(['12,3']),
        caster: { x: 10, y: 5 },
      }),
    ).toEqual({ tile: groundTile });
  });

  it("leaves another unit's ground cell unchanged", () => {
    const { boss, box, point } = fixture('oblique');
    const behind = unit('behind', { x: 12, y: 3 }, 1);
    expect(
      resolveCombatBodyPick({
        point,
        groundTile: behind.pos,
        actors: [{ unit: boss, box, scale: 2, frameHeadroom: null }],
        units: [boss, behind],
        props: [],
        protectedTiles: new Set(),
        caster: { x: 10, y: 5 },
      }),
    ).toEqual({ tile: behind.pos });
  });

  it('leaves a pointer outside the silhouette unchanged', () => {
    const { boss, box } = fixture('orthographic');
    const groundTile = { x: 12, y: 3 };
    expect(
      resolveCombatBodyPick({
        point: { x: box.x - box.size * 3, y: box.y },
        groundTile,
        actors: [{ unit: boss, box, scale: 2, frameHeadroom: null }],
        units: [boss],
        props: [],
        protectedTiles: new Set(),
        caster: null,
      }),
    ).toEqual({ tile: groundTile });
  });

  it('leaves 1x1 actors and gate-off 2x1 footprints unchanged', () => {
    for (const [size, square] of [
      [1, true],
      [2, false],
    ] as const) {
      const { boss, box, point } = fixture('oblique', size, square);
      const groundTile = { x: 12, y: 3 };
      expect(
        resolveCombatBodyPick({
          point,
          groundTile,
          actors: [{ unit: boss, box, scale: 2, frameHeadroom: null }],
          units: [boss],
          props: [],
          protectedTiles: new Set(),
          caster: null,
          squareFootprints: square,
        }),
      ).toEqual({ tile: groundTile });
    }
  });

  it('aims at the nearest legal footprint cell', () => {
    const { boss, box, point } = fixture('oblique');
    const result = resolveCombatBodyPick({
      point,
      groundTile: { x: 12, y: 3 },
      actors: [{ unit: boss, box, scale: 2, frameHeadroom: null }],
      units: [boss],
      props: [],
      protectedTiles: new Set(),
      legalTargets: new Set(['16,5', '15,6']),
      caster: { x: 15, y: 8 },
    });
    expect(result.tile).toEqual({ x: 15, y: 6 });
  });
});
