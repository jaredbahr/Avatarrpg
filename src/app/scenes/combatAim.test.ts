import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { grumblerAimCheckpoint } from '../../../scripts/e2e/grumbler-aim-checkpoint';
import { loadQuarryCheckpoint } from '../../../scripts/e2e/quarry-checkpoints';
import { CONTENT } from '../../content';
import { isValidTarget, targetableTiles } from '../../core/rules/abilities';
import { occupiedCells } from '../../core/rules/grid';
import type { GameState, Vec2 } from '../../core/types';
import { Session } from '../session';
import { CombatScene } from './CombatScene';

const checkpoint = grumblerAimCheckpoint();
type Mode = { kind: 'move' } | { kind: 'aim'; abilityId: string };

interface AimScene {
  app: {
    state: GameState;
    content: typeof CONTENT;
    session: Session;
    animator: { busy: ReturnType<typeof vi.fn> };
    dispatch: ReturnType<typeof vi.fn>;
  };
  renderer: object;
  victoryBeat: null;
  handedOffTo: string;
  pending: Vec2 | null;
  mode: Mode;
  skipBattleOpening: ReturnType<typeof vi.fn>;
  resolvePointer: ReturnType<typeof vi.fn>;
  renderHud: ReturnType<typeof vi.fn>;
  onTap(x: number, y: number): void;
}

/**
 * Pointer/body picking has its own geometry suite. Supply its resolved tile at
 * that boundary, then exercise the actual scene tap handler and turn guards.
 * HUD painting is a spy; no command is allowed to commit until confirmation.
 */
function tap(tile: Vec2, mode: Mode = { kind: 'aim', abilityId: checkpoint.abilityId }): AimScene {
  const scene = Object.create(CombatScene.prototype) as unknown as AimScene;
  scene.app = {
    state: checkpoint.state,
    content: CONTENT,
    session: Session.fromMeta(checkpoint.session),
    animator: { busy: vi.fn(() => false) },
    dispatch: vi.fn(),
  };
  scene.renderer = {};
  scene.victoryBeat = null;
  scene.handedOffTo = checkpoint.casterId;
  scene.pending = null;
  scene.mode = mode;
  scene.skipBattleOpening = vi.fn(() => false);
  scene.resolvePointer = vi.fn(() => ({ tile }));
  scene.renderHud = vi.fn();
  const before = structuredClone(scene.app.state);
  const sessionBefore = scene.app.session.toMeta();

  scene.onTap(180, 220);

  expect(scene.resolvePointer).toHaveBeenCalledWith(180, 220, 'tap');
  expect(scene.renderHud).toHaveBeenCalledOnce();
  expect(scene.app.dispatch).not.toHaveBeenCalled();
  expect(scene.app.state).toBe(checkpoint.state);
  expect(scene.app.state).toEqual(before);
  expect(scene.app.session.toMeta()).toEqual(sessionBefore);
  return scene;
}

describe('combat tap aim acceptance', () => {
  it('uses the earned Grumbler turn and exact reloadable save', () => {
    expect(checkpoint.transcript).toHaveLength(79);
    expect(createHash('sha256').update(checkpoint.json).digest('hex')).toBe(
      '417c0bbcfff4994a8bffcf9b95af6187b0c9efb09280413fdb012ecd3450f64d',
    );
    expect(loadQuarryCheckpoint(checkpoint.json)).toEqual(checkpoint.state);
    expect(checkpoint.state.battle).toMatchObject({
      encounterId: 'enc_grumbler',
      phase: 'active',
      round: 2,
    });
    const battle = checkpoint.state.battle;
    if (!battle) throw new Error('Missing earned battle');
    const caster = battle.units.find((unit) => unit.id === checkpoint.casterId);
    const boss = battle.units.find((unit) => unit.id === checkpoint.targetId);
    const ability = CONTENT.abilities.get(checkpoint.abilityId);
    if (!caster || !boss || !ability) throw new Error('Missing earned aim participants');
    expect(caster).toMatchObject({ pos: { x: 8, y: 1 }, ap: 5 });
    expect(boss).toMatchObject({ pos: { x: 12, y: 7 }, hp: 138, size: 2 });
    expect(occupiedCells(boss)).toContainEqual(checkpoint.far);
    expect(targetableTiles(CONTENT, battle, caster, ability)).toContainEqual(checkpoint.far);
    expect(isValidTarget(CONTENT, battle, caster, ability, checkpoint.far)).toEqual({
      ok: false,
      reason: 'Out of range.',
    });
    expect(isValidTarget(CONTENT, battle, caster, ability, checkpoint.near).ok).toBe(true);
  });

  it('accepts a highlighted far boss cell as the reachable aim cell before confirmation', () => {
    expect(tap(checkpoint.far).pending).toEqual(checkpoint.near);
  });

  it('keeps an already reachable near boss tap unchanged', () => {
    expect(tap(checkpoint.near).pending).toEqual(checkpoint.near);
  });

  it('keeps move-mode ground selection on the tapped cell', () => {
    expect(tap(checkpoint.far, { kind: 'move' }).pending).toEqual(checkpoint.far);
  });

  it.each(['flame_arc', 'fire_blast'])('keeps the exact %s area aim cell', (abilityId) => {
    expect(tap(checkpoint.far, { kind: 'aim', abilityId }).pending).toEqual(checkpoint.far);
  });

  it('keeps an invalid empty-ground tap for the existing validation reason', () => {
    const empty = { x: 1, y: 10 };
    const battle = checkpoint.state.battle;
    const ability = CONTENT.abilities.get(checkpoint.abilityId);
    const caster = battle?.units.find((unit) => unit.id === checkpoint.casterId);
    if (!battle || !ability || !caster) throw new Error('Missing earned battle');
    expect(
      battle.units.some((unit) =>
        occupiedCells(unit).some((cell) => cell.x === empty.x && cell.y === empty.y),
      ),
    ).toBe(false);
    expect(isValidTarget(CONTENT, battle, caster, ability, empty).ok).toBe(false);
    expect(tap(empty).pending).toEqual(empty);
  });

  it('keeps a size-one enemy tap on that enemy', () => {
    const enemy = checkpoint.state.battle?.units.find(
      (unit) => unit.faction === 'enemy' && unit.size === 1 && unit.hp > 0,
    );
    if (!enemy) throw new Error('Missing earned size-one enemy');
    expect(tap(enemy.pos).pending).toEqual(enemy.pos);
  });
});
