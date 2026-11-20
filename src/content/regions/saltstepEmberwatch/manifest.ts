/**
 * Saltstep and Emberwatch (RG-02): Act II's first region, MQ-02 "Paper and Stone". Saltstep is a
 * market on the water down the coast road from Ba Dan; Emberwatch is the old outpost across the
 * bay, reached by Tavi's ferry. This is the pipeline-trial slice (`docs/pipeline-proof-plan.md`
 * §6, owner's scope of 2026-11-15): the Saltstep market and Emberwatch, Veyra's guest-ally fight
 * at the freight pontoon (Scene 2.5) and one optional side fight (SF-2.1). Its log is
 * `docs/pipeline-trial-log.md`.
 *
 * Entered from Ba Dan's coast road once Act I is over, won or lost (the coast-road sign's `Condition`,
 * in `maps/world.ts`). Every map has its top-down scene. No music rows yet, so each map keeps the
 * track already playing.
 */
import type { RegionManifest } from '../../regions/types';

export const SALTSTEP_EMBERWATCH: RegionManifest = {
  id: 'saltstep_emberwatch',
  name: 'Saltstep and Emberwatch',
  mapIds: [
    'saltstep_market',
    'saltstep_pontoon',
    'emberwatch_parade',
    'emberwatch_power_yard',
    'saltstep_platform',
  ],
  // Ba Dan's coast road is this region's way in, and the market's west road its way home.
  neighbours: ['ba_dan_valley'],
  // Approved by the owner on #784 (2026-11-18): Saltstep (MQ-02) 3-4 and Emberwatch (MQ-03) 4-5.
  // This one region holds both, so its band is their union. Every Act I route ends on level 4, and
  // SF-2.1 can lift a party to 5 before MQ-03.
  levelBand: { minLevel: 3, maxLevel: 5, placeholder: false },
  // Waiting for the region's own area track (ADR 0108; the owner listens first). With no row a map
  // keeps whatever is playing, so the coast road carries Ba Dan's theme down to the water. A track
  // may belong to one region only (ADR 0111 §4), so Act I's cannot be borrowed.
  music: {},

  // The plates run two cells past the grid either side, three above and two below, as Act I's do.
  scenes: {
    saltstep_market: { url: 'art/topdown/saltstep-market/scene.json', cameraCentreMargin: 1 },
    saltstep_pontoon: { url: 'art/topdown/saltstep-pontoon/scene.json', cameraCentreMargin: 1 },
    saltstep_platform: { url: 'art/topdown/saltstep-platform/scene.json', cameraCentreMargin: 1 },
    emberwatch_parade: { url: 'art/topdown/emberwatch-parade/scene.json', cameraCentreMargin: 1 },
    emberwatch_power_yard: {
      url: 'art/topdown/emberwatch-power-yard/scene.json',
      cameraCentreMargin: 1,
    },
  },
  load: () => import('./content').then((module) => module.SALTSTEP_EMBERWATCH_CONTENT),
};
