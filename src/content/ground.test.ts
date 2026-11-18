/**
 * Ground as data (ADR 0120): the shared classifier holds the rules on Ba Dan's board, and the two report-only
 * placement checks (`docs/level-design.md` §9, validators 6 and 10) are pinned to today's findings, so a change to
 * the tracks, the aprons or the rows shows here as a diff to read.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT } from './index';
import { BA_DAN_ANCHORS } from './residents/baDan';
import { BA_DAN_GROUND, BA_DAN_GROUND_SPEC } from './scenes/baDan.ground';
import { GROUND_CELL, GroundTerrain, edgeGrowth, trackCells, type GroundSpec } from './ground';
import {
  anchorPlaces,
  apronReport,
  bareAnchors,
  desireLinesClear,
  exitPlaces,
} from './groundChecks';
import { validateTopDownLayout } from './schemas';

const village = () => {
  const map = CONTENT.maps.get('ba_dan_village');
  if (!map) throw new Error('no village');
  return map;
};
const places = () => {
  const map = village();
  return [...anchorPlaces(BA_DAN_ANCHORS, map.id), ...exitPlaces(map)];
};

describe("Ba Dan's ground", () => {
  it('is drawn over the live rows', () => {
    expect(BA_DAN_GROUND_SPEC.rows).toBe(village().rows);
  });

  it('keeps the classifier pure and seeded', () => {
    for (const file of ['src/content/ground.ts', 'src/content/scenes/baDan.ground.ts'])
      expect(readFileSync(file, 'utf8')).not.toMatch(
        /Math\.random\(|Date\.now\(|document\.\w|window\.\w/,
      );
    expect(BA_DAN_GROUND.classify(380, 260)).toEqual(BA_DAN_GROUND.classify(380, 260));
  });

  it('passes the layout rules on its own, but for the tree line its trees will stand on (stage 5)', () => {
    const map = village();
    const problems = validateTopDownLayout(map, {
      mapId: map.id,
      terrain: BA_DAN_GROUND.layer(),
      objects: [],
      slots: [],
    });
    const other = problems.filter((p) => !/ blocked \(\d+,\d+\) is neither/.test(p));
    expect(other).toEqual([]);
    const cells = problems
      .map((p) => /blocked \((\d+),(\d+)\)/.exec(p))
      .map((m) => map.rows[Number(m?.[2])]?.[Number(m?.[1])]);
    expect(new Set(cells)).toEqual(new Set(['T']));
  });

  it("stands every figure on its own cell's class: the rules win", () => {
    const map = village();
    const tr = BA_DAN_GROUND;
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) {
        const ch = map.rows[y]?.[x] ?? '';
        if (map.legend[ch]?.blocked) continue;
        const px = tr.grid.x + x * GROUND_CELL + GROUND_CELL / 2,
          py = tr.grid.y + y * GROUND_CELL + GROUND_CELL / 2;
        const made = tr.madeAt(px, py);
        expect(tr.classAt(px, py), `(${x},${y}) '${ch}'`).toBe(
          made ? made.k : tr.cellNatural(x, y),
        );
      }
  });

  it('reads the canal as water inside a kerb, and the bridge as ground', () => {
    const at = (x: number, y: number) => BA_DAN_GROUND.classify(x * 40 + 20, y * 40 + 20);
    expect(at(5, 12).ground).toBe('water');
    expect(at(13, 12).ground).toBe('ground');
    expect(BA_DAN_GROUND.classify(5 * 40 + 20, 12 * 40 - 2)).toMatchObject({
      ground: 'ground',
      kerb: true,
    });
    expect(at(0, 9).ground).toBe('water');
    expect(at(13, 9).ground).toBe('rock');
  });

  it('pins desireLinesClear (report-only): the worn ground round the table and the post, and the welcome crowd', () => {
    expect(desireLinesClear(village(), BA_DAN_GROUND_SPEC, places())).toEqual([
      'desireLinesClear "ba_dan_village": track "square_table" crosses blocked (13,9) (14,9)',
      'desireLinesClear "ba_dan_village": track "gate_post" crosses blocked (27,7) (28,7)',
      'desireLinesClear "ba_dan_village": "welcome.leto" at (26,12) is 2 cells from the track network',
    ]);
  });

  it('pins the aprons report (report-only): the court, the welcome ground and two recovery spots are unchanged', () => {
    expect(bareAnchors(apronReport(BA_DAN_GROUND_SPEC, places()), 'ba_dan_village')).toEqual([
      'aprons "ba_dan_village": "bd04.court" at (12,15) stands on unchanged ground',
      'aprons "ba_dan_village": "bd04.yard" at (13,16) stands on unchanged ground',
      'aprons "ba_dan_village": "welcome.bo_shan" at (27,11) stands on unchanged ground',
      'aprons "ba_dan_village": "welcome.leto" at (26,12) stands on unchanged ground',
      'aprons "ba_dan_village": "welcome.amri" at (25,11) stands on unchanged ground',
      'aprons "ba_dan_village": "recovery.bo_shan" at (14,16) stands on unchanged ground',
      'aprons "ba_dan_village": "recovery.leto" at (17,10) stands on unchanged ground',
    ]);
  });

  it('keeps the welcome ground quiet: no track, apron or growth is drawn there on purpose', () => {
    expect(BA_DAN_GROUND_SPEC.quiet).toEqual([[18, 10, 28, 12]]);
  });
});

describe('the ground checks', () => {
  const spec: GroundSpec = {
    mapId: 'fixture',
    rows: ['....', '.B..', '....'],
    classes: [
      { id: 'void', tile: { set: 'cliff32', key: 'LLLL' }, reads: 'void', terrain: 'V' },
      { id: 'dust', tile: { set: 'q_floor32b', key: 'LLLL' }, reads: 'ground', terrain: 'D' },
    ],
    chars: {},
    fallback: 'dust',
    beyond: 'void',
    margin: { left: 1, right: 1, top: 1, bottom: 1 },
    tracks: [
      {
        id: 'lane',
        line: [
          [0, 1.5],
          [4, 1.5],
        ],
        width: 1,
        wear: 2,
      },
    ],
    aprons: [{ id: 'step', kind: 'packed', at: [3.5, 0.5], r: 0.7 }],
    growth: [],
    mouths: [],
    mouthReach: 2,
    seed: 1,
  };
  const map = { ...village(), id: 'fixture', width: 4, height: 3, rows: spec.rows };

  it('finds a blocked cell on a track and a place off the network', () => {
    expect(trackCells(spec.tracks[0] ?? { line: [], width: 0 }, 4, 3).length).toBe(4);
    expect(
      desireLinesClear(map, spec, [
        { id: 'near', cell: { x: 0, y: 0 } },
        { id: 'far', cell: { x: 3, y: 3 } },
      ]),
    ).toEqual([
      'desireLinesClear "fixture": track "lane" crosses blocked (1,1)',
      'desireLinesClear "fixture": "far" at (3,3) is 2 cells from the track network',
    ]);
  });

  it('reports an anchor on an apron or a worn track as changed, and one on neither as bare', () => {
    const rows = apronReport(spec, [
      { id: 'door', cell: { x: 3, y: 0 } },
      { id: 'lane', cell: { x: 0, y: 1 } },
      { id: 'corner', cell: { x: 0, y: 0 } },
    ]);
    expect(rows.map((r) => r.ground)).toEqual([['apron:step'], ['track:lane'], []]);
  });

  it('runs growth along every edge between two kinds of cell, from the rows', () => {
    expect(edgeGrowth('g', spec.rows, 'B', '.', ['north'], 0.1, 0.3, 0.1)).toEqual([
      {
        id: 'g.north.1.1',
        line: [
          [1, 0.9],
          [2, 0.9],
        ],
        width: 0.3,
        density: 0.1,
      },
    ]);
  });

  it('draws a made shape exactly on the cell lines and blends the rest', () => {
    const tr = new GroundTerrain({
      ...spec,
      classes: [
        ...spec.classes,
        { id: 'plinth', tile: { set: 'flag32', key: 'c0000' }, reads: 'rock', terrain: 'C' },
      ],
      chars: { B: 'inherit' },
      made: { B: { class: 'plinth', made: { shape: 'cell' }, draw: 'plinth' } },
    });
    // cell (1,1) spans plate px 80..119 on both axes
    expect(tr.madeAt(80, 80)?.k).toBe(2);
    expect(tr.madeAt(119, 119)?.k).toBe(2);
    expect(tr.madeAt(79, 100)).toBeUndefined();
    expect(tr.cellNatural(1, 1)).toBe(1);
  });
});
