/**
 * Working Ba Dan's routines against the real village: every leg a legal walk
 * on open ground, the loop closing on the anchor, the activities real ones
 * from the schedule, and no tile anyone else ever needs.
 */

import { expect, it } from 'vitest';
import { CONTENT } from '../index';
import { residentRoutineSchema } from '../schemas';
import { BA_DAN_ROUTINES, PARKED_ROUTINES } from './routines';
import { cachedGrid, pathCost, posKey } from '../../core/rules/grid';
import { exitCells } from '../../core/story/world';
import type { ResidentSlot, Vec2 } from '../../core/types';

/** Every activity a resident or role can be placed doing, variants included. */
function activities(id: string): Set<string> {
  const slots: ResidentSlot[] = [];
  const resident = CONTENT.residents.get(id);
  if (resident) {
    slots.push(resident.fallback);
    for (const slot of Object.values(resident.schedule)) if (slot !== 'home') slots.push(slot);
    for (const override of resident.overrides ?? []) {
      slots.push(
        ...Object.values(override.slots).filter((s): s is ResidentSlot => typeof s === 'object'),
      );
      if (override.all && typeof override.all === 'object') slots.push(override.all);
    }
  }
  const role = CONTENT.backgroundRoles.get(id);
  if (role) {
    slots.push(...Object.values(role.slots).filter((s): s is ResidentSlot => Boolean(s)));
    if (role.accompanies) slots.push(role.accompanies.slot);
  }
  return new Set(
    slots.flatMap((slot) => [slot.activity, ...(slot.variants ?? []).map((v) => v.activity)]),
  );
}

/** The parked routes are checked too, so they are ready the day their art lands. */
const ROUTINES = [...BA_DAN_ROUTINES, ...PARKED_ROUTINES];

it('parses, one routine a person', () => {
  for (const routine of ROUTINES) expect(() => residentRoutineSchema.parse(routine)).not.toThrow();
  const ids = ROUTINES.map((routine) => routine.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(BA_DAN_ROUTINES.map((routine) => routine.id)).toEqual(['lw.npc.gao']);
  // The household adult is still a placeholder figure: its basket waits for art.
  expect(PARKED_ROUTINES.map((routine) => routine.id)).toEqual(['bg.pella_household']);
});

it('runs from a real anchor, in activities the schedule really places them doing', () => {
  for (const routine of ROUTINES) {
    const known = activities(routine.id);
    expect(known.size, `${routine.id} is a resident or a role`).toBeGreaterThan(0);
    for (const activity of routine.activities)
      expect(known.has(activity), `${routine.id} does ${activity}`).toBe(true);
    const site = CONTENT.anchors.get(routine.anchor)?.site;
    expect(site?.kind === 'map' && site.mapId === routine.mapId).toBe(true);
  }
});

it('walks legal steps on open ground and closes the loop at the anchor', () => {
  for (const routine of ROUTINES) {
    const map = CONTENT.maps.get(routine.mapId);
    const site = CONTENT.anchors.get(routine.anchor)?.site;
    if (!map || site?.kind !== 'map') throw new Error(`${routine.id} has no map anchor`);
    const ctx = {
      grid: cachedGrid(map),
      blocked: new Set<string>(),
      surfaces: CONTENT.surfaces,
      size: 1 as const,
    };
    let from: Vec2 = site.pos;
    for (const [index, leg] of routine.legs.entries()) {
      // pathCost refuses a blocked tile, a jump, and a diagonal past a blocked corner.
      expect(pathCost(ctx, from, leg.path), `${routine.id} leg ${index}`).not.toBeNull();
      from = leg.path.at(-1) ?? from;
    }
    expect(from, `${routine.id} comes home`).toEqual(site.pos);
  }
});

it('keeps off every tile someone else needs: anchors, doors, signs, benches, exits, walls', () => {
  for (const routine of ROUTINES) {
    const map = CONTENT.maps.get(routine.mapId);
    if (!map) throw new Error(routine.mapId);
    const home = CONTENT.residents.get(routine.id)?.home;
    const reserved = new Map<string, string>();
    const reserve = (pos: Vec2, why: string) => reserved.set(posKey(pos), why);
    for (const anchor of CONTENT.anchors.values()) {
      const site = anchor.site;
      if (anchor.id === routine.anchor || anchor.id === home) continue;
      if (site.kind === 'map' && site.mapId === map.id) reserve(site.pos, anchor.id);
      if (site.kind === 'private' && site.door.mapId === map.id) reserve(site.door.pos, anchor.id);
    }
    for (const npc of map.npcs) if (npc.pos) reserve(npc.pos, npc.id);
    for (const spot of map.restSpots ?? []) reserve(spot.pos, spot.label);
    for (const exit of map.exits ?? [])
      for (const cell of exitCells(exit)) reserve(cell, exit.label);
    if (map.exit) reserve(map.exit.pos, map.exit.label);
    for (const trigger of map.triggers ?? [])
      for (const cell of trigger.area) reserve(cell, trigger.id);
    // A house's footprint, `=` notches included, is drawn as wall.
    for (const piece of map.scene?.scenery ?? [])
      if (piece.fadeWhenOccluding) for (const cell of piece.footprint) reserve(cell, piece.id);
    for (const leg of routine.legs)
      for (const tile of leg.path)
        expect(reserved.get(posKey(tile)), `${routine.id} at ${posKey(tile)}`).toBeUndefined();
  }
});
