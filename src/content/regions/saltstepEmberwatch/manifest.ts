/**
 * Saltstep and Emberwatch (RG-02): Act II's first region, MQ-02 "Paper and Stone". Saltstep is a
 * market on the water down the coast road from Ba Dan; Emberwatch is the old outpost across the
 * bay, reached by Tavi's ferry. This is the pipeline-trial slice (`docs/pipeline-proof-plan.md`
 * §6, owner's scope of 2026-11-15): the Saltstep market and Emberwatch, Veyra's guest-ally fight
 * at the freight pontoon (Scene 2.5) and one optional side fight (SF-2.1). Its log is
 * `docs/pipeline-trial-log.md`.
 *
 * Entered from Ba Dan's coast road once Act I is over, won or lost (the coast-road sign's `Condition`,
 * in `maps/world.ts`). PLACEHOLDER ART AND MUSIC: no scenes yet, so every map draws its bare board,
 * and the music rows borrow Act I's tracks.
 */
import type { RegionManifest } from '../../regions/types';

export const SALTSTEP_EMBERWATCH: RegionManifest = {
  id: 'saltstep_emberwatch',
  name: 'Saltstep and Emberwatch',
  mapIds: ['saltstep_market', 'saltstep_pontoon', 'emberwatch_parade', 'emberwatch_power_yard'],
  // Ba Dan's coast road is this region's way in, and the market's west road its way home.
  neighbours: ['ba_dan_valley'],
  // PLACEHOLDER until the owner answers #784: every Act I route ends on level 4, and SF-2.1 can
  // lift a party to 5 before MQ-03.
  levelBand: { minLevel: 4, maxLevel: 5, placeholder: true },
  // PLACEHOLDER: Act I's tracks until the region's own area track is made and approved (ADR 0108,
  // 0111 §4). Every map must name a track (`music.test.ts`): the town theme for Saltstep and its
  // pontoon, the road theme for Emberwatch, the quarry theme for the power yard's fight.
  music: {
    saltstep_market: 'ba-dan',
    saltstep_pontoon: 'ba-dan',
    emberwatch_parade: 'road',
    emberwatch_power_yard: 'quarry',
  },
  // TODO(region): each map's top-down scene once its board is drawn and approved (ADR 0104).
  scenes: {},
  load: () => import('./content').then((module) => module.SALTSTEP_EMBERWATCH_CONTENT),
};
