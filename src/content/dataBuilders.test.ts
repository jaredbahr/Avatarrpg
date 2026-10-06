import { describe, expect, it } from 'vitest';
import { ASSETS } from './assets/manifest';
import { CHARACTERS } from './characters';
import { DISCIPLINES } from './disciplines';
import { ENCOUNTERS } from './encounters';
import { ALL_SOUNDS, soundSchema } from './sounds';

describe('content builders preserve their authored values', () => {
  it('preserves every character ladder', () => {
    expect(Object.fromEntries(CHARACTERS.map(({ id, kit }) => [id, kit]))).toEqual({
      kaya: [
        { level: 1, ability: 'fire_jab' },
        { level: 2, ability: 'flame_arc' },
        { level: 3, choose: ['fire_blast', 'fire_step'] },
        { level: 5, specialize: ['flame_shaping', 'lightning_path'] },
      ],
      tenzo: [
        { level: 1, ability: 'fire_jab' },
        { level: 2, ability: 'fire_blast' },
        { level: 3, choose: ['fire_step', 'flame_arc'] },
        { level: 5, specialize: ['flame_shaping', 'lightning_path'] },
      ],
      nilak: [
        { level: 1, ability: 'water_whip' },
        { level: 2, ability: 'healing_stream' },
        { level: 3, choose: ['water_pull', 'ice_path'] },
        { level: 5, specialize: ['ice_shaping', 'healing_path'] },
      ],
      sura: [
        { level: 1, ability: 'water_whip' },
        { level: 2, ability: 'ice_path' },
        { level: 3, choose: ['healing_stream', 'water_pull'] },
        { level: 5, specialize: ['ice_shaping', 'healing_path'] },
      ],
      bo: [
        { level: 1, ability: 'rock_throw' },
        { level: 2, ability: 'stone_stance' },
        { level: 3, choose: ['earth_wall', 'shockwave'] },
        { level: 5, specialize: ['earth_shaping', 'metalbending_path'] },
      ],
      lin_mei: [
        { level: 1, ability: 'rock_throw' },
        { level: 2, ability: 'shockwave' },
        { level: 3, choose: ['earth_wall', 'raise_rubble'] },
        { level: 5, specialize: ['earth_shaping', 'metalbending_path'] },
      ],
      nima: [
        { level: 1, ability: 'air_blast' },
        { level: 2, ability: 'air_scooter' },
        { level: 3, choose: ['air_shield', 'gust'] },
        { level: 5, specialize: ['air_shaping', 'sound_bending'] },
      ],
      jinu: [
        { level: 1, ability: 'air_blast' },
        { level: 2, ability: 'gust' },
        { level: 3, choose: ['air_shield', 'air_scooter'] },
        { level: 5, specialize: ['air_shaping', 'sound_bending'] },
      ],
      riko: [
        { level: 1, ability: 'strike' },
        { level: 2, ability: 'chi_block' },
        { level: 3, choose: ['take_cover', 'bolas'] },
        { level: 5, specialize: ['field_craft', 'engineering'] },
      ],
      wen: [
        { level: 1, ability: 'strike' },
        { level: 2, ability: 'gauntlet_spark' },
        { level: 3, choose: ['take_cover', 'bolas'] },
        { level: 5, specialize: ['field_craft', 'engineering'] },
      ],
    });
  });

  it('preserves every discipline ladder', () => {
    expect(Object.fromEntries(DISCIPLINES.map(({ id, kit }) => [id, kit]))).toEqual({
      flame_shaping: [
        { level: 5, ability: 'fire_wall' },
        { level: 7, ability: 'heat_shield' },
        { level: 10, ability: 'dragon_breath' },
      ],
      lightning_path: [
        { level: 5, ability: 'lightning' },
        { level: 7, ability: 'lightning_arc' },
        { level: 10, ability: 'lightning_storm' },
      ],
      ice_shaping: [
        { level: 5, ability: 'ice_spikes' },
        { level: 7, choose: ['tidal_wave', 'ice_shield'] },
        { level: 10, ability: 'octopus_form' },
      ],
      healing_path: [
        { level: 5, ability: 'healing_hands' },
        { level: 7, ability: 'purifying_mist' },
        { level: 10, ability: 'life_tide' },
      ],
      earth_shaping: [
        { level: 5, ability: 'mudslide' },
        { level: 7, choose: ['seismic_sense', 'boulder'] },
        { level: 10, ability: 'fissure' },
      ],
      metalbending_path: [
        { level: 5, ability: 'metal_cable' },
        { level: 7, ability: 'metal_armor' },
        { level: 10, ability: 'metalbending' },
      ],
      air_shaping: [
        { level: 5, ability: 'cyclone' },
        { level: 7, ability: 'air_cushion' },
        { level: 10, ability: 'tornado' },
      ],
      sound_bending: [
        { level: 5, ability: 'sonic_boom' },
        { level: 7, ability: 'deafening_shout' },
        { level: 10, ability: 'shatterpoint' },
      ],
      field_craft: [
        { level: 5, ability: 'smoke_bomb' },
        { level: 7, choose: ['shield_bash', 'rally'] },
        { level: 10, ability: 'pressure_points' },
      ],
      engineering: [
        { level: 5, ability: 'electrified_glove' },
        { level: 7, ability: 'shock_mine' },
        { level: 10, ability: 'disruptor_array' },
      ],
    });
  });

  it('preserves every encounter placement', () => {
    const placements = ENCOUNTERS.flatMap((encounter) => [
      ...encounter.enemies,
      ...encounter.allies,
      ...encounter.reinforcements,
      ...encounter.conditionalEnemies.flatMap((group) => group.placements),
      ...encounter.variants.flatMap((variant) => variant.enemies ?? []),
    ]);
    expect(placements).toEqual(
      [
        ['bandit_thug', 17, 5],
        ['bandit_thug', 17, 7],
        ['bandit_slinger', 18, 3],
        ['bandit_thug', 18, 6],
        ['bandit_slinger', 16, 2],
        ['bandit_slinger', 17, 5],
        ['bandit_slinger', 18, 3],
        ['bandit_slinger', 18, 7],
        ['bandit_bruiser', 17, 5],
        ['bandit_bruiser', 17, 7],
        ['fire_deserter', 16, 3],
        ['bandit_thug', 17, 6],
        ['bandit_bruiser', 16, 8],
        ['bandit_thug', 17, 4],
        ['bandit_slinger', 17, 9],
        ['bandit_bruiser', 16, 3],
        ['bandit_earthbender', 17, 6],
        ['bandit_bruiser', 16, 8],
        ['merc_blade', 17, 5],
        ['merc_blade', 17, 6],
        ['merc_crossbow', 16, 3],
        ['ruon_ally', 5, 5],
        ['merc_blade', 16, 7],
        ['merc_crossbow', 18, 8],
        ['merc_blade', 15, 8],
        ['merc_sergeant', 17, 9],
        ['grumbler', 15, 5],
        ['bandit_earthbender', 16, 2],
        ['bandit_thug', 14, 3],
        ['bandit_thug', 14, 8],
        ['bandit_slinger', 17, 9],
        ['bandit_earthbender', 13, 10],
        ['grumbler', 15, 5],
        ['merc_crossbow', 16, 2],
      ].map(([enemyId, x, y]) => ({ enemyId, pos: { x, y } })),
    );
  });

  it('preserves all image entries and the helper-backed crossbow sheet', () => {
    const images = Object.entries(ASSETS).flatMap(([key, entry]) =>
      entry.kind === 'image' ? [[key, entry.url, entry.palette]] : [],
    );
    expect(images).toEqual([
      ['npc.elder', 'art/npcs/mira.png', 'neutral'],
      ['npc.shopkeeper', 'art/npcs/gao.png', 'earth'],
      ['world.turtle_ducks', 'art/world/turtle-ducks-nest.webp', 'earth'],
      ['world.runoff_marker', 'art/world/runoff-marker.png', 'neutral'],
      ['world.tea_station', 'art/props/tea-station.png', 'earth'],
      ['npc.kid', 'art/npcs/pella.png', 'air'],
      ['npc.dorin', 'art/npcs/dorin.png', 'earth'],
      ['world.route_sign', 'art/world/route-sign.png', 'neutral'],
      ['prop.barrel', 'art/props/barrel.png', 'water'],
      ['prop.flask', 'art/props/flask.png', 'earth'],
      ['prop.brazier', 'art/props/brazier.png', 'fire'],
      ['prop.hay', 'art/props/hay.png', 'air'],
      ['prop.rubble', 'art/props/rubble.png', 'earth'],
      ['prop.cart', 'art/props/cart.png', 'air'],
      ['portrait.enemy.slinger', 'art/portraits/enemy.slinger.png', 'enemy'],
      ['portrait.enemy.bruiser', 'art/portraits/enemy.bruiser.png', 'enemy'],
      ['portrait.enemy.quarrybender', 'art/portraits/enemy.quarrybender.png', 'earth'],
      ['portrait.enemy.crossbow', 'art/portraits/enemy.crossbow.png', 'enemy'],
      ['portrait.enemy.thug', 'art/portraits/enemy.thug.png', 'enemy'],
      ['portrait.enemy.deserter', 'art/portraits/enemy.deserter.webp', 'fire'],
      ['portrait.enemy.driller', 'art/portraits/enemy.grumbler.png', 'enemy'],
      ['portrait.kaya', 'art/portraits/kaya.png', 'fire'],
      ['portrait.tenzo', 'art/portraits/tenzo.png', 'fire'],
      ['portrait.nilak', 'art/portraits/nilak.png', 'water'],
      ['portrait.sura', 'art/portraits/sura.png', 'water'],
      ['portrait.bo', 'art/portraits/bo.png', 'earth'],
      ['portrait.linmei', 'art/portraits/linmei.png', 'earth'],
      ['portrait.nima', 'art/portraits/nima.png', 'air'],
      ['portrait.jinu', 'art/portraits/jinu.png', 'air'],
      ['portrait.riko', 'art/portraits/riko.png', 'nonbender'],
      ['portrait.wen', 'art/portraits/wen.png', 'nonbender'],
      ['portrait.mira', 'art/portraits/mira.png', 'earth'],
      ['portrait.gao', 'art/portraits/gao.png', 'earth'],
      ['portrait.pella', 'art/portraits/pella.png', 'air'],
      ['portrait.dorin', 'art/portraits/dorin.png', 'earth'],
      ['portrait.ruon', 'art/portraits/ruon.png', 'neutral'],
      ['portrait.jin', 'art/portraits/jin.png', 'nonbender'],
    ]);
    expect(ASSETS['unit.enemy.crossbow']).toEqual({
      kind: 'sheet',
      atlas: 'art/units/crossbow.json',
      pixelsPerTile: 128,
      footprint: { w: 1, h: 1 },
      anchor: { x: 0.5, y: 0.85 },
      facing: 'mirror',
      palette: 'enemy',
      clips: {
        idle: {
          frames: ['unit.enemy.crossbow/idle/0', 'unit.enemy.crossbow/idle/1'],
          fps: 1,
          loop: true,
        },
        walk: {
          frames: ['unit.enemy.crossbow/walk/0', 'unit.enemy.crossbow/walk/1'],
          fps: 4,
          loop: true,
        },
        cast: {
          frames: [
            'unit.enemy.crossbow/cast/0',
            'unit.enemy.crossbow/cast/1',
            'unit.enemy.crossbow/cast/2',
          ],
          fps: 8,
          loop: false,
        },
        hit: { frames: ['unit.enemy.crossbow/hit/0'], fps: 1, loop: false },
        ko: { frames: ['unit.enemy.crossbow/ko/0'], fps: 1, loop: false },
      },
    });
  });

  it('materializes every omitted sound property through schema defaults', () => {
    for (const { def } of ALL_SOUNDS) {
      const parsed = soundSchema.parse(def);
      const voices =
        parsed.kind === 'layers' ? parsed.voices : parsed.kind === 'voice' ? [parsed] : [];
      for (const voice of voices) {
        expect(voice).toEqual(
          expect.objectContaining({
            noise: expect.any(String),
            filter: expect.any(String),
            q: expect.any(Number),
            attack: expect.any(Number),
            decay: expect.any(Number),
            body: expect.any(Number),
            gain: expect.any(Number),
            crack: expect.any(Boolean),
          }),
        );
      }
    }
  });
});
