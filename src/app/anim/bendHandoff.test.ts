import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { GameEvent, Unit, Vec2 } from '../../core/types';
import { CONTENT } from '../../content';
import type { Heading } from '../../content/assets/clips';
import { headingClip } from '../../content/assets/clips';
import type { BendEffectDef, BendSetDef } from '../../content/bends';
import { BEND_FX } from '../../content/fxCels';
import { bendFxIndex, parseBendFxPage } from '../../render/fx/bendFx';
import type { BendFxIndex } from '../../render/fx/bendFx';
import type { ResolvedBendFrame, SheetClips } from '../../render/sheets/store';
import { Animator } from '../animator';
import { bendSceneAt } from './bendChoreo';
import type { BendSources } from './bendHandoff';
import { isBendingAttack, partyBendSprites, planBendCast, unitFoot } from './bendHandoff';
import { TIMING, choreograph } from './choreography';
import type { BendTrack, FloaterTrack, PoseTrack } from './timeline';

const read = (path: string): unknown => JSON.parse(readFileSync(join('public', path), 'utf8'));
const fx = bendFxIndex(
  read(BEND_FX.data) as BendEffectDef[],
  BEND_FX.pages.map((path) => parseBendFxPage(read(path), path)),
);
const SETS: Record<string, BendSetDef> = {
  'unit.fire.kaya': read('art/units/kaya-bend.json') as BendSetDef,
  'unit.water.sura': read('art/units/sura-bend.json') as BendSetDef,
  'unit.earth.bo': read('art/units/bo-bend.json') as BendSetDef,
};

/** A loaded bend's cels, as `SheetStore.bendFrame` resolves them. */
function frameOf(sprite: string, heading: Heading, index: number): ResolvedBendFrame | null {
  const facing = SETS[sprite]?.facings[heading];
  if (!facing || index >= facing.frames.length) return null;
  return {
    frame: { x: 0, y: 0, w: facing.frameSize.width, h: facing.frameSize.height },
    anchor: facing.anchor,
    pixelsPerTile: 128,
    sockets: facing.socketsPerFrame.find((row) => row.frame === index)?.sockets ?? {},
    heading,
    index,
    ms: facing.frameMs[index] ?? 0,
  } as unknown as ResolvedBendFrame;
}

const loaded: BendSources = { fx, setOf: (sprite) => SETS[sprite], frameOf };
const gClips: Record<string, SheetClips> = {
  'unit.fire.kaya': read('art/units/kaya-g-clips.json') as SheetClips,
  'unit.water.sura': read('art/units/sura-g-clips.json') as SheetClips,
};

const unit = (
  id: string,
  sprite: string,
  element: string,
  pos: Vec2,
  faction: Unit['faction'] = 'party',
  hp = 20,
): Unit =>
  ({
    id,
    sprite,
    element,
    faction,
    pos,
    size: 1,
    hp,
    base: { maxHp: 20 },
  }) as unknown as Unit;

const kaya = unit('kaya', 'unit.fire.kaya', 'fire', { x: 1, y: 3 });
const foe = unit('foe', 'unit.enemy.thug', 'nonbender', { x: 5, y: 3 }, 'enemy');
const ability = (id: string) => CONTENT.abilities.get(id)!;

const used = (by: Unit, abilityId: string, target: Vec2): GameEvent => ({
  type: 'abilityUsed',
  unitId: by.id,
  abilityId,
  target,
  tiles: [target],
});
const hurt = (id: string, amount: number): GameEvent => ({
  type: 'damaged',
  unitId: id,
  amount,
  crit: false,
  damageType: 'fire',
  sourceId: 'kaya',
});

const CURSOR = 1000;
function run(
  events: GameEvent[],
  options: { bends?: BendSources; clips?: boolean; rate?: number; units?: Unit[] } = {},
) {
  return choreograph({
    content: CONTENT,
    events,
    unitsBefore: options.units ?? [kaya, foe],
    cursor: CURSOR,
    rate: options.rate ?? 1,
    pushIndex: 0,
    projection: 'oblique',
    ...(options.bends ? { bends: options.bends } : {}),
    ...(options.clips ? { clipsOf: (sprite: string) => gClips[sprite] } : {}),
  });
}

const jab = [used(kaya, 'fire_jab', foe.pos), hurt('foe', 7)];

describe('which casts bend', () => {
  it('admits single-target ranged damage of the caster element only', () => {
    const fire = ['fire_jab', 'lightning'];
    for (const id of fire) expect(isBendingAttack(kaya, ability(id)), id).toBe(true);
    const sura = unit('sura', 'unit.water.sura', 'water', { x: 0, y: 0 });
    for (const id of ['water_whip', 'water_pull'])
      expect(isBendingAttack(sura, ability(id)), id).toBe(true);
    const bo = unit('bo', 'unit.earth.bo', 'earth', { x: 0, y: 0 });
    for (const id of ['rock_throw', 'metalbending', 'metal_cable'])
      expect(isBendingAttack(bo, ability(id)), id).toBe(true);
  });

  it('keeps area, melee, support, other elements and enemies on the legacy cast', () => {
    for (const id of [
      'flame_arc',
      'dragon_breath',
      'fire_blast',
      'lightning_storm',
      'lightning_arc',
      'fire_wall',
      'fire_step',
      'heat_shield',
      'strike',
      'water_whip',
    ])
      expect(isBendingAttack(kaya, ability(id)), id).toBe(false);
    const sura = unit('sura', 'unit.water.sura', 'water', { x: 0, y: 0 });
    for (const id of ['healing_stream', 'ice_shield', 'healing_hands', 'octopus_form'])
      expect(isBendingAttack(sura, ability(id)), id).toBe(false);
    expect(isBendingAttack({ ...kaya, faction: 'enemy' }, ability('fire_jab'))).toBe(false);
    expect(isBendingAttack({ ...kaya, faction: 'ally' }, ability('fire_jab'))).toBe(false);
  });

  it('turns down a cast at the caster’s own tile, a missing bend, heading, cel or effect', () => {
    const at = (sources: BendSources | undefined, target = foe.pos) =>
      planBendCast(sources, kaya, kaya.pos, ability('fire_jab'), target, undefined, 'oblique');
    expect(at(loaded)).toBeDefined();
    expect(at(loaded, kaya.pos)).toBeUndefined();
    expect(at(undefined)).toBeUndefined();
    expect(at({ ...loaded, setOf: () => undefined })).toBeUndefined();
    expect(at({ ...loaded, setOf: () => SETS['unit.water.sura'] })).toBeUndefined();
    expect(at({ ...loaded, frameOf: () => null })).toBeUndefined();
    expect(
      at({ ...loaded, frameOf: (s, h, i) => (i === 5 ? null : frameOf(s, h, i)) }),
    ).toBeUndefined();
    const noEffect: BendFxIndex = { ...fx, effect: () => undefined };
    expect(at({ ...loaded, fx: noEffect })).toBeUndefined();
  });

  it('faces the Animator’s eight-way heading toward the target', () => {
    const heading = (target: Vec2) =>
      planBendCast(loaded, kaya, kaya.pos, ability('fire_jab'), target, undefined, 'oblique')?.plan
        .heading;
    // On the oblique board a grid +x step is screen south-east, +x-y is east.
    expect(heading({ x: 5, y: 3 })).toBe('southEast');
    expect(heading({ x: 3, y: 1 })).toBe('east');
    expect(heading({ x: 3, y: 5 })).toBe('south');
    expect(heading({ x: 1, y: 0 })).toBe('northEast');
  });

  it('aims from the caster’s drawn feet, lifted by its ground', () => {
    const cast = planBendCast(
      loaded,
      kaya,
      kaya.pos,
      ability('fire_jab'),
      foe.pos,
      undefined,
      'oblique',
      (pos) => (pos.x === kaya.pos.x ? 0.12 : 0),
    );
    expect(cast?.plan.shot.from).toEqual(unitFoot(kaya.pos, 1, 'oblique', 0.12));
    expect(unitFoot({ x: 2, y: 3 }, 1, 'orthographic')).toEqual({ x: 2.5, y: 3.85 });
  });

  it('preloads only party units whose sheet has a bend', () => {
    const units = [
      kaya,
      unit('sura', 'unit.water.sura', 'water', { x: 0, y: 0 }),
      unit('bo', 'unit.earth.bo', 'earth', { x: 0, y: 1 }),
      unit('copy', 'unit.fire.kaya', 'fire', { x: 0, y: 2 }, 'enemy'),
      foe,
    ];
    expect(partyBendSprites(units).sort()).toEqual([
      'unit.earth.bo',
      'unit.fire.kaya',
      'unit.water.sura',
    ]);
    expect(partyBendSprites([foe, { ...kaya, faction: 'enemy' }])).toEqual([]);
  });
});

describe('a bending attack in the choreography', () => {
  const bent = run(jab, { bends: loaded });
  const track = bent.tracks.find((t): t is BendTrack => t.kind === 'bend')!;
  const plan = track.plan;
  const impactAt = CURSOR + bendSceneAt(plan, plan.arrivals[1]!);
  const hold = plan.holds.find((h) => h.at === plan.arrivals[1])!;

  it('plays the bend in place of the legacy cast', () => {
    expect(track.start).toBe(CURSOR);
    expect(track.duration).toBe(plan.duration);
    expect(plan.shot.releases).toHaveLength(2);
    const kinds = bent.tracks.map((t) => t.kind);
    expect(kinds).not.toContain('emitter');
    expect(kinds).not.toContain('shake');
    expect(bent.tracks.some((t) => t.kind === 'pose' && (t as PoseTrack).unitId === 'kaya')).toBe(
      false,
    );
  });

  it('shows the one damage, flash, floater and health change at the last release', () => {
    const jabLands = CURSOR + bendSceneAt(plan, plan.arrivals[0]!);
    expect(jabLands).toBeLessThan(impactAt);
    expect(bent.health).toEqual([{ unitId: 'foe', hp: 13, fallen: false, at: impactAt }]);
    const flashes = bent.tracks.filter((t) => t.kind === 'flash');
    expect(flashes).toHaveLength(1);
    expect(flashes[0]!.start).toBe(impactAt);
    const floaters = bent.tracks.filter((t): t is FloaterTrack => t.kind === 'floater');
    expect(floaters.map((f) => f.text)).toEqual(['7']);
    expect(floaters[0]!.start).toBe(impactAt + hold.ms + 30);
    expect(bent.sounds.filter((s) => s.key === 'hit').map((s) => s.at)).toEqual([impactAt]);
    // Nothing of the rules result shows at the jab.
    for (const t of bent.tracks) if (t.kind !== 'bend') expect(t.start).not.toBe(jabLands);
  });

  it('holds the struck unit through the damage release’s impact hold', () => {
    expect(hold.ms).toBe(100);
    const flash = bent.tracks.find((t) => t.kind === 'flash')!;
    expect(flash.duration).toBe(TIMING.flash + hold.ms);
    const stop = bent.tracks.find(
      (t): t is PoseTrack => t.kind === 'pose' && t.unitId === 'foe' && t.start === impactAt,
    );
    expect(stop?.duration).toBe(hold.ms);
    const recoil = bent.tracks.find(
      (t): t is PoseTrack => t.kind === 'pose' && t.unitId === 'foe' && t.start > impactAt,
    );
    expect(recoil?.start).toBe(impactAt + hold.ms);
  });

  it('lets the throw finish before the next thing plays', () => {
    expect(bent.cursor).toBeGreaterThanOrEqual(CURSOR + plan.duration);
  });

  it('shows a miss at the same moment, once', () => {
    const missed = run(
      [used(kaya, 'fire_jab', foe.pos), { type: 'attackMissed', unitId: 'kaya', targetId: 'foe' }],
      { bends: loaded },
    );
    const floaters = missed.tracks.filter((t): t is FloaterTrack => t.kind === 'floater');
    expect(floaters.map((f) => [f.text, f.start])).toEqual([['miss', impactAt + 30]]);
    expect(missed.sounds.filter((s) => s.key === 'miss').map((s) => s.at)).toEqual([impactAt]);
    expect(missed.health).toEqual([]);
  });

  it('knocks out after the bend, with the bar emptied at the hit', () => {
    const lethal = run(
      [used(kaya, 'fire_jab', foe.pos), hurt('foe', 20), { type: 'unitDied', unitId: 'foe' }],
      {
        bends: loaded,
      },
    );
    const ko = lethal.tracks.find(
      (t): t is PoseTrack => t.kind === 'pose' && t.clip === 'ko' && t.unitId === 'foe',
    )!;
    expect(lethal.health[0]).toEqual({ unitId: 'foe', hp: 0, fallen: false, at: impactAt });
    expect(ko.start).toBeGreaterThanOrEqual(CURSOR + plan.duration);
    expect(lethal.health[1]).toMatchObject({ hp: 0, fallen: true, at: ko.start });
  });

  it('pre-rolls a G-sheet victim before the bend damage release', () => {
    const victim = unit('sura', 'unit.water.sura', 'water', { x: 5, y: 3 }, 'enemy');
    const out = run([used(kaya, 'fire_jab', victim.pos), hurt(victim.id, 7)], {
      bends: loaded,
      clips: true,
      units: [kaya, victim],
    });
    const bend = out.tracks.find((track): track is BendTrack => track.kind === 'bend')!;
    const impactAt = CURSOR + bendSceneAt(bend.plan, bend.plan.arrivals[1]!);
    const reaction = out.tracks.find(
      (track): track is PoseTrack =>
        track.kind === 'pose' && track.unitId === victim.id && track.clip === 'hit',
    );
    expect(reaction?.start).toBeLessThan(impactAt);
    expect(
      out.tracks.find((track) => track.kind === 'flash' && track.unitId === victim.id)?.start,
    ).toBe(impactAt);
  });

  it('keeps a lethal G-sheet victim in reaction until the KO starts after it ends', () => {
    const victim = unit('sura', 'unit.water.sura', 'water', { x: 5, y: 3 }, 'enemy');
    const out = run(
      [
        used(kaya, 'fire_jab', victim.pos),
        hurt(victim.id, 20),
        { type: 'unitDied', unitId: victim.id },
      ],
      { bends: loaded, clips: true, units: [kaya, victim] },
    );
    const reaction = out.tracks.find(
      (track): track is PoseTrack =>
        track.kind === 'pose' && track.unitId === victim.id && track.clip === 'hit',
    )!;
    const ko = out.tracks.find(
      (track): track is PoseTrack =>
        track.kind === 'pose' && track.unitId === victim.id && track.clip === 'ko',
    )!;
    expect(ko.start).toBeGreaterThanOrEqual(reaction.start + reaction.duration);
  });

  it('plays the other characters’ bends, one release each', () => {
    const sura = unit('sura', 'unit.water.sura', 'water', { x: 1, y: 3 });
    const bo = unit('bo', 'unit.earth.bo', 'earth', { x: 1, y: 3 });
    for (const [caster, id, releases] of [
      [sura, 'water_whip', 1],
      [bo, 'rock_throw', 2],
    ] as const) {
      const out = run([used(caster, id, foe.pos), hurt('foe', 5)], {
        bends: loaded,
        units: [caster, foe],
      });
      const bend = out.tracks.find((t): t is BendTrack => t.kind === 'bend');
      expect(bend?.plan.shot.releases, id).toHaveLength(releases);
      expect(out.health, id).toHaveLength(1);
    }
  });
});

describe('the legacy cast, unchanged', () => {
  const legacy = (events: GameEvent[], options: Parameters<typeof run>[1] = {}) => {
    const { bends: _, ...rest } = options;
    return run(events, rest);
  };

  it('when the bend is idle, loading or failed, its pages are not in, or an effect is missing', () => {
    const cases: BendSources[] = [
      { ...loaded, setOf: () => undefined },
      { ...loaded, frameOf: () => null },
      { ...loaded, fx: { ...fx, effect: () => undefined } },
    ];
    for (const bends of cases) expect(run(jab, { bends })).toEqual(legacy(jab));
    // Effects not decoded: the animator is handed no sources at all.
    expect(run(jab)).toEqual(legacy(jab));
  });

  it('for enemies, even on a sheet with a bend', () => {
    const copy = unit('copy', 'unit.fire.kaya', 'fire', { x: 1, y: 3 }, 'enemy');
    const target = unit('kaya', 'unit.fire.kaya', 'fire', { x: 5, y: 3 });
    const events = [used(copy, 'fire_jab', target.pos), hurt('kaya', 4)];
    const units = [copy, target];
    expect(run(events, { bends: loaded, units })).toEqual(legacy(events, { units }));
  });

  it('for area abilities and casts at the caster’s own tile', () => {
    const arc = [used(kaya, 'flame_arc', foe.pos), hurt('foe', 3)];
    expect(run(arc, { bends: loaded })).toEqual(legacy(arc));
    const self = [used(kaya, 'fire_jab', kaya.pos)];
    expect(run(self, { bends: loaded })).toEqual(legacy(self));
  });

  it('under reduced motion', () => {
    expect(run(jab, { bends: loaded, rate: 0.02 })).toEqual(legacy(jab, { rate: 0.02 }));
  });
});

describe('the animator plays it where it was laid', () => {
  const animator = () => {
    const a = new Animator(CONTENT, { motionReduced: () => false, bends: () => loaded });
    a.setProjection('oblique');
    return a;
  };

  it('starts the bend at the choreography cursor, queued or not, with the damage on it', () => {
    const a = animator();
    a.push(0, [used(kaya, 'fire_jab', { x: 5, y: 3 })], [kaya, foe]);
    const first = a.finishesAt;
    a.push(0, jab, [kaya, foe]);
    const expected = run(jab, { bends: loaded });
    const plan = expected.tracks.find((t): t is BendTrack => t.kind === 'bend')!.plan;
    const impact = first + bendSceneAt(plan, plan.arrivals[1]!);
    expect(a.bendPose(first, 'kaya')).toEqual({ heading: 'southEast', index: 0, held: false });
    expect(a.unitHealth(impact - 1, foe).hp).toBe(20);
    expect(a.unitHealth(impact, foe).hp).toBe(13);
  });

  it('leaves the stance facing the heading it bent toward', () => {
    const a = animator();
    const up = { x: 1, y: 0 };
    a.push(0, [used(kaya, 'fire_jab', up), hurt('foe', 1)], [kaya, { ...foe, pos: up }]);
    const after = a.finishesAt + 1;
    expect(a.bendPose(after, 'kaya')).toBeUndefined();
    expect(a.locomotion(after, 'kaya', 'stance', 'unit.fire.kaya').clip).toBe(
      headingClip('stance', 'northEast'),
    );
  });

  it('plays the legacy cast under reduced motion', () => {
    const a = new Animator(CONTENT, { motionReduced: () => true, bends: () => loaded });
    a.setProjection('oblique');
    a.push(0, jab, [kaya, foe]);
    expect(a.bendPose(0, 'kaya')).toBeUndefined();
    expect(a.unitPose(0, 'kaya', 'unit.fire.kaya')?.clip).toBe('cast');
  });
});
