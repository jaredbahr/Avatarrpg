import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, startGame, waitForIdle } from './helpers';
import type { DayPhase } from '../src/core/types';
import type { NpcMarker } from '../src/render/view';

/**
 * ADR 0047 test 18 (M8), the Ba Dan day matrix.
 *
 * For each phase of the village day — and midday and afternoon on the
 * riverside — a fresh game that has heard `mira_intro` (so nobody is held by
 * the briefing) waits through the real `wait` command from Mira's table, or
 * the riverside tea porch, and the map is then asked what it drew: the
 * header's phase label, exactly one gate watch, one marker per id for every
 * NPC the state places, and no figure standing on a party tile.
 *
 * The tables are `src/content/residents/baDan.ts` §8 written out: the rota
 * that carries `service: 'gate_watch'`, and every NpcDef the state makes
 * visible in that phase. Markers are keyed as the renderer keys them: a
 * resident's id, a background role's id, or an unbound NpcDef's id.
 */

type Spot = {
  readonly name: string;
  /** The explore node's map, and the rest spot the wait is taken from. */
  readonly node: string;
  readonly mapId: string;
  readonly spot: { readonly x: number; readonly y: number };
};

const VILLAGE: Spot = {
  name: 'village',
  node: 'village_explore',
  mapId: 'ba_dan_village',
  spot: { x: 10, y: 5 },
};
const RIVERSIDE: Spot = {
  name: 'riverside',
  node: 'riverside_explore',
  mapId: 'ba_dan_riverside',
  spot: { x: 8, y: 18 },
};

/** Who holds the gate post in each phase (§4's rota). */
const WATCH: Readonly<Record<DayPhase, string>> = {
  dawn: 'lw.npc.dorin',
  morning: 'lw.npc.dorin',
  midday: 'bg.relief_watch',
  afternoon: 'lw.npc.dorin',
  evening: 'lw.npc.hanru',
  night: 'lw.npc.hanru',
};
const WATCH_IDS = ['bg.relief_watch', 'lw.npc.dorin', 'lw.npc.hanru'];
/** `bd03.post` (§3, W8): the one tile a gate watch is ever drawn on. */
const GATE_POST = { x: 17, y: 6 };

const VILLAGE_NPCS: Readonly<Record<DayPhase, readonly string[]>> = {
  // Mira's table; Gao's shopfront; Pella's court with the household adult;
  // Dorin on the post with Hanru on the handover tile beside him.
  dawn: [
    'bg.pella_household',
    'lw.npc.dorin',
    'lw.npc.gao',
    'lw.npc.hanru',
    'lw.npc.mira',
    'lw.npc.pella',
    'riverside_sign',
  ],
  // Pella is in class (the notice stands in for her) and Hanru is home.
  morning: ['lw.npc.dorin', 'lw.npc.gao', 'lw.npc.mira', 'riverside_sign', 'school_notice'],
  // The relief watch takes the post; Dorin is at the riverside drill.
  midday: [
    'bg.pella_household',
    'bg.relief_watch',
    'lw.npc.gao',
    'lw.npc.mira',
    'lw.npc.pella',
    'riverside_sign',
  ],
  // Mira walks the bank and Pella watches the otter: both riverside.
  afternoon: ['lw.npc.dorin', 'lw.npc.gao', 'riverside_sign'],
  evening: [
    'bg.pella_household',
    'lw.npc.dorin',
    'lw.npc.gao',
    'lw.npc.hanru',
    'lw.npc.mira',
    'lw.npc.pella',
    'riverside_sign',
  ],
  night: ['lw.npc.hanru', 'riverside_sign'],
};

const RIVERSIDE_NPCS: Readonly<Partial<Record<DayPhase, readonly string[]>>> = {
  midday: ['lw.npc.dorin', 'riverside_shrine'],
  afternoon: ['lw.npc.mira', 'lw.npc.pella', 'riverside_shrine'],
};

const NPCS: Readonly<Record<string, Readonly<Partial<Record<DayPhase, readonly string[]>>>>> = {
  [VILLAGE.mapId]: VILLAGE_NPCS,
  [RIVERSIDE.mapId]: RIVERSIDE_NPCS,
};

/** `startGame` takes the character list, which is how the other specs set a party's size. */
const SOLO = ['kaya'];
const SIX = ['nima', 'kaya', 'sura', 'bo', 'wen', 'jinu'];

type Case = {
  readonly spot: Spot;
  readonly phase: DayPhase;
  /** The day the last wait lands on, from a fresh game's `midday` day 1 start. */
  readonly day: number;
  /**
   * The waits that reach `phase` from midday, in order. Midday needs two:
   * `wait` refuses the phase the clock is already showing (ADR 0047 §1).
   */
  readonly waits: readonly DayPhase[];
  readonly parties: readonly (readonly string[])[];
};

const CASES: readonly Case[] = [
  { spot: VILLAGE, phase: 'dawn', day: 2, waits: ['dawn'], parties: [SOLO, SIX] },
  { spot: VILLAGE, phase: 'morning', day: 2, waits: ['morning'], parties: [SOLO] },
  { spot: VILLAGE, phase: 'midday', day: 2, waits: ['evening', 'midday'], parties: [SOLO] },
  { spot: VILLAGE, phase: 'afternoon', day: 1, waits: ['afternoon'], parties: [SOLO] },
  { spot: VILLAGE, phase: 'evening', day: 1, waits: ['evening'], parties: [SOLO, SIX] },
  { spot: VILLAGE, phase: 'night', day: 1, waits: ['night'], parties: [SOLO] },
  { spot: RIVERSIDE, phase: 'midday', day: 2, waits: ['evening', 'midday'], parties: [SOLO] },
  { spot: RIVERSIDE, phase: 'afternoon', day: 1, waits: ['afternoon'], parties: [SOLO] },
];

const label = (phase: DayPhase) => phase.charAt(0).toUpperCase() + phase.slice(1);
/** The post, and its relief, stand on the village (§3): no watch is drawn on the river. */
const watchFor = (spot: Spot, phase: DayPhase) => (spot === VILLAGE ? WATCH[phase] : null);

interface Look {
  readonly clock: { readonly day: number; readonly phase: DayPhase };
  readonly label: string | null;
  readonly npcs: readonly { readonly id: string; readonly tile: { x: number; y: number } }[];
  readonly party: readonly { readonly x: number; readonly y: number }[];
  /** The state's own answer for who is placed and drawn here. */
  readonly figures: readonly string[];
}

interface ResidentTap {
  readonly npcId: string;
  readonly pos: { readonly x: number; readonly y: number };
}

const look = (page: Page): Promise<Look> =>
  page.evaluate(() => {
    const app = window.fnt!.app;
    const scene = (app as unknown as { scene: { lastNpcs: readonly NpcMarker[] } }).scene;
    return {
      clock: app.state!.world.clock,
      label: document.querySelector('.explore-phase')?.textContent ?? null,
      npcs: scene.lastNpcs
        .filter((npc) => !npc.id.startsWith('trigger:'))
        .map((npc) => {
          const at = npc.renderPos ?? npc.pos;
          return { id: npc.id, tile: { x: Math.round(at.x), y: Math.round(at.y) } };
        }),
      party: (app.partyPositions() ?? []).map((seat) => ({ x: seat.x, y: seat.y })),
      figures: app.residents.figures().flatMap((who) => (who.pos ? [who.id] : [])),
    };
  });

/** A fresh game whose party has heard Mira out and is standing at the rest spot. */
async function arrive(page: Page, entry: Case, party: readonly string[]): Promise<void> {
  await resetStorage(page, '?renderer=canvas');
  await startGame(
    page,
    ['Jared'],
    [...party],
    `ba-dan-${entry.spot.name}-${entry.phase}-${party.length}`,
  );
  await enterNode(page, entry.spot.node);
  await page.evaluate(
    ({ mapId, spot }) => {
      const app = window.fnt!.app;
      const state = app.state!;
      app.adoptSave(
        {
          ...state,
          // The briefing, heard: Mira keeps her own schedule from here (§4).
          story: { ...state.story, visited: [...state.story.visited, 'mira_intro'] },
          location: { mapId, pos: spot },
        },
        undefined,
      );
    },
    { mapId: entry.spot.mapId, spot: entry.spot.spot },
  );
  await settled(page);
}

/** Every wait goes through the command the hotbar uses, and must be accepted. */
async function advance(page: Page, entry: Case): Promise<void> {
  for (const until of entry.waits) {
    const events = await page.evaluate(
      (phase) =>
        window
          .fnt!.app.dispatch({ type: 'wait', until: phase as 'midday' })
          .map((event) => event.type),
      until,
    );
    expect(events, `wait until ${until} from the rest spot`).toContain('phaseChanged');
    await settled(page);
  }
}

/** The frame loops have caught up: playback is over and nobody is still walking. */
async function settled(page: Page): Promise<void> {
  await waitForIdle(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let frames = 0;
        const step = (): void => {
          frames += 1;
          if (frames >= 3 && !window.fnt!.app.residents.moving()) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
  );
}

function check(entry: Case, seen: Look): void {
  // (a) The header says what time it is.
  expect(seen.clock).toEqual({ day: entry.day, phase: entry.phase });
  expect(seen.label).toBe(label(entry.phase));

  // (c) Everything the state places on this map is drawn, and drawn once.
  const drawn = new Map<string, number>();
  for (const npc of seen.npcs) drawn.set(npc.id, (drawn.get(npc.id) ?? 0) + 1);
  expect([...drawn.keys()].sort()).toEqual(
    [...(NPCS[entry.spot.mapId]![entry.phase] ?? [])].sort(),
  );
  expect(
    [...drawn.values()].filter((count) => count !== 1),
    'one marker per id',
  ).toEqual([]);
  for (const id of seen.figures) expect(drawn.get(id), `${id} drawn once`).toBe(1);

  // (b) Exactly one gate watch, on the post, and the right one for the phase.
  // Filtered by the post tile, not by WATCH_IDS alone: at the two handover
  // phases (dawn, evening) Dorin and Hanru are co-present (ADR §4), one on
  // the post and the off-duty one on the handover tile beside it, so an
  // id-only filter would catch both.
  const watch = seen.npcs.filter((npc) => npc.tile.x === GATE_POST.x && npc.tile.y === GATE_POST.y);
  expect(
    watch.every((npc) => WATCH_IDS.includes(npc.id)),
    'only a watch id stands on the post',
  ).toBe(true);
  expect(watch).toEqual(
    watchFor(entry.spot, entry.phase)
      ? [{ id: watchFor(entry.spot, entry.phase)!, tile: GATE_POST }]
      : [],
  );

  // (d) Nobody is drawn on a party member's tile.
  expect(
    seen.npcs.filter((npc) =>
      seen.party.some((seat) => seat.x === npc.tile.x && seat.y === npc.tile.y),
    ),
    'no NPC overlaps a party tile',
  ).toEqual([]);
}

/** Tap every named resident from the same arrived state; each must open and pin itself. */
async function checkResidentTaps(page: Page): Promise<void> {
  const base = await page.evaluate(() => window.fnt!.app.state!);
  const residents = await page.evaluate(() =>
    window
      .fnt!.app.residents.figures()
      .filter(
        (figure): figure is typeof figure & ResidentTap =>
          figure.npcId !== null && figure.pos !== null,
      )
      .map((figure) => ({ npcId: figure.npcId, pos: figure.pos })),
  );

  for (const resident of residents) {
    const opened = await page.evaluate(
      ({ saved, target }) => {
        const app = window.fnt!.app;
        app.adoptSave(saved, undefined);
        app.dispatch({ type: 'walkTo', pos: target.pos });
        return {
          screen: app.state!.screen,
          npcId: app.state!.world.talk?.npcId ?? null,
        };
      },
      { saved: base, target: resident },
    );
    expect(opened.screen, resident.npcId).toBe('dialogue');
    expect(opened.npcId, resident.npcId).toBe(resident.npcId);
  }

  await page.evaluate((saved) => window.fnt!.app.adoptSave(saved, undefined), base);
  await settled(page);
}

for (const entry of CASES) {
  for (const party of entry.parties) {
    test(`the ${entry.spot.name} at ${entry.phase} draws its roster once, with a party of ${party.length}`, async ({
      page,
    }) => {
      await arrive(page, entry, party);
      await advance(page, entry);
      check(entry, await look(page));
      await checkResidentTaps(page);
    });
  }
}
