/**
 * Combat's bend handoff (ADR 0055, step 7): which cast plays the caster's
 * bend instead of the legacy cast, and the plan it plays.
 *
 * A bend set belongs to the unit asset, not to an ability: every bending
 * attack a character has plays its one bend. An ability is a bending attack
 * when all of these hold:
 * - the caster is a party unit and the ability is of the caster's element;
 * - it aims at one unit (`targeting.shape === 'unit'`) beyond arm's reach
 *   (`range > 1`), and not at the caster's own tile;
 * - it deals damage, and is not tagged heal, buff or mobility.
 * Area, cone, line and blast abilities keep the legacy cast, whose area and
 * impact visuals a one-target bend would lose; how they should bend is open.
 *
 * This is presentation only. The reducer has already resolved the one attack
 * and its one damage event; the plan decides only when that shows.
 */

import type { Ability, Unit, Vec2 } from '../../core/types';
import { SQUARE_FOOTPRINTS, footprintFoot } from '../../core/rules/footprint';
import type { BendSetDef } from '../../content/bends';
import type { Heading } from '../../content/assets/clips';
import { resolveAsset } from '../../content/assets/manifest';
import type { BendFxIndex } from '../../render/fx/bendFx';
import { BEND_FX_PX_PER_TILE } from '../../render/fx/bendFxSample';
import type { Point } from '../../render/fx/trajectory';
import type { Projection } from '../../render/projection';
import { projectGround } from '../../render/projection';
import { FOOT_LINE } from '../../render/sheets/bake';
import type { ResolvedBendFrame } from '../../render/sheets/store';
import { partyScale } from './actorScale';
import type { BendPlan } from './bendChoreo';
import { bendSceneAt, planBend } from './bendChoreo';
import { screenDirection, walkHeading } from './direction';

/** See the module comment. */
export function isBendingAttack(unit: Unit, ability: Ability): boolean {
  return (
    unit.faction === 'party' &&
    unit.element === ability.element &&
    ability.targeting.shape === 'unit' &&
    ability.range > 1 &&
    !ability.tags.some((tag) => tag === 'heal' || tag === 'buff' || tag === 'mobility') &&
    ability.effects.some((effect) => effect.kind === 'damage')
  );
}

/** The sprites combat preloads a bend for at its start: party units whose sheet has one. */
export function partyBendSprites(units: readonly Unit[]): string[] {
  const sprites = new Set<string>();
  for (const unit of units) {
    const asset = resolveAsset(unit.sprite);
    if (unit.faction === 'party' && asset.kind === 'sheet' && asset.bend) sprites.add(unit.sprite);
  }
  return [...sprites];
}

/**
 * Where a unit's cel stands, in board units: the foot point both backends
 * place a sheet frame's anchor on (`Camera.spriteBox` plus `FOOT_LINE`),
 * lifted by `lift` tiles for the ground it stands on.
 */
export function unitFoot(
  pos: Vec2,
  size: 1 | 2,
  projection: Projection,
  lift = 0,
  square = SQUARE_FOOTPRINTS,
): Point {
  const point = footprintFoot(pos, size, square);
  if (projection === 'oblique') {
    const ground = projectGround(point, 'oblique');
    return { x: ground.x, y: ground.y - 0.86 + FOOT_LINE - lift };
  }
  return { x: point.x, y: point.y - 0.5 + FOOT_LINE - lift };
}

/** What the bend lookups answer; all of it must be in, or the cast is legacy. */
export interface BendSources {
  /** Only a bend whose pages and data are both loaded. */
  readonly setOf: (sprite: string) => BendSetDef | undefined;
  readonly frameOf: (sprite: string, heading: Heading, index: number) => ResolvedBendFrame | null;
  /** Only once every effect page has loaded. */
  readonly fx: BendFxIndex;
}

export interface BendCast {
  readonly plan: BendPlan;
  readonly fx: BendFxIndex;
  /** Scene ms from the bend's start at which the damage release lands. */
  readonly impactAt: number;
  /** The damage release's impact hold, ms: the struck unit's hit-stop. */
  readonly hitStop: number;
  /** Scene ms from the bend's start at which the first release leaves the hand. */
  readonly launchAt: number;
  /** The damage release's impact flash. */
  readonly flash: number;
}

/**
 * The bend a cast plays, or undefined for the legacy cast: an ineligible
 * ability, no loaded bend or effect, a heading or cel missing, or a target on
 * the caster's own tile.
 */
export function planBendCast(
  sources: BendSources | undefined,
  caster: Unit,
  casterPos: Vec2,
  ability: Ability,
  target: Vec2,
  struck: { readonly pos: Vec2; readonly size: number } | undefined,
  projection: Projection,
  lift: (pos: Vec2) => number = () => 0,
  square = SQUARE_FOOTPRINTS,
): BendCast | undefined {
  if (!sources || !isBendingAttack(caster, ability)) return undefined;
  const set = sources.setOf(caster.sprite);
  if (!set || set.unitAsset !== caster.sprite) return undefined;
  const from = footprintFoot(casterPos, caster.size, square);
  const to = struck
    ? footprintFoot(struck.pos, struck.size as 1 | 2, square)
    : { x: target.x + 0.5, y: target.y + 0.5 };
  const vector = { x: to.x - from.x, y: to.y - from.y };
  const tiles = Math.max(Math.abs(target.x - casterPos.x), Math.abs(target.y - casterPos.y));
  if (tiles === 0 || Math.hypot(vector.x, vector.y) < 1e-9) return undefined;
  const heading = walkHeading(screenDirection(vector, projection));
  const facing = set.facings[heading];
  const attack = facing?.attacks[0];
  const effect = attack ? sources.fx.effect(attack.effectId) : undefined;
  if (!facing || !attack || !effect) return undefined;
  const cel = (index: number) => sources.frameOf(caster.sprite, heading, index);
  if (facing.frames.some((_, index) => cel(index) === null)) return undefined;

  const scale = partyScale(projection);
  const landing = struck
    ? unitFoot(struck.pos, struck.size as 1 | 2, projection, lift(struck.pos), square)
    : unitFoot(target, 1, projection, lift(target));
  const plan = planBend(sources.fx, {
    heading,
    facing,
    attack,
    effect,
    cel,
    foot: unitFoot(casterPos, caster.size, projection, lift(casterPos), square),
    to: {
      x: landing.x + (effect.impact.offsetPx.x / BEND_FX_PX_PER_TILE) * scale,
      y: landing.y + (effect.impact.offsetPx.y / BEND_FX_PX_PER_TILE) * scale,
    },
    scale,
    tiles,
  });
  const release = attack.damageRelease;
  const arrival = plan.arrivals[release] ?? plan.shot.releases[release]?.launchAt ?? plan.ends;
  return {
    plan,
    fx: sources.fx,
    impactAt: bendSceneAt(plan, arrival),
    hitStop: plan.holds.find((hold) => hold.at === arrival)?.ms ?? 0,
    launchAt: bendSceneAt(plan, plan.shot.releases[0]?.launchAt ?? 0),
    flash: effect.impact.flash,
  };
}
