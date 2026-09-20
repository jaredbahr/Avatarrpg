/** Generate projected ground and ownership guides from an authoritative combat map. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { AMBUSH_ROAD, QUARRY_FLOOR } from '../../src/content/maps/combat';
import type { MapDef } from '../../src/core/types';

const MAPS: Record<string, MapDef> = {
  ambush_road: AMBUSH_ROAD,
  quarry_floor: QUARRY_FLOOR,
};

export function projectedPoint(x: number, y: number): readonly [number, number] {
  return [768 + (x - y) * 64, (x + y) * 32];
}

type ElevatedCell = { readonly x: number; readonly y: number; readonly elevation: 1 | 2 };
type EdgeSide = 'north' | 'east' | 'south' | 'west';

function elevation(key: string | undefined): 0 | 1 | 2 {
  return key === 'A' ? 2 : key === '^' ? 1 : 0;
}

function cellsAtElevation(map: MapDef): ElevatedCell[] {
  const cells: ElevatedCell[] = [];
  for (let y = 0; y < map.height; y++) {
    const row = map.rows[y] ?? '';
    for (let x = 0; x < map.width; x++) {
      const value = elevation(row[x]);
      if (value) cells.push({ x, y, elevation: value });
    }
  }
  return cells;
}

function components(cells: readonly ElevatedCell[]): ElevatedCell[][] {
  const pending = new Map(cells.map((cell) => [`${cell.x},${cell.y}`, cell]));
  const groups: ElevatedCell[][] = [];
  while (pending.size) {
    const first = pending.values().next().value as ElevatedCell | undefined;
    if (!first) break;
    pending.delete(`${first.x},${first.y}`);
    const group: ElevatedCell[] = [];
    const queue = [first];
    while (queue.length) {
      const cell = queue.pop();
      if (!cell) continue;
      group.push(cell);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const neighbor = pending.get(`${cell.x + dx},${cell.y + dy}`);
        if (!neighbor || neighbor.elevation !== cell.elevation) continue;
        pending.delete(`${neighbor.x},${neighbor.y}`);
        queue.push(neighbor);
      }
    }
    groups.push(group.sort((a, b) => a.y - b.y || a.x - b.x));
  }
  return groups;
}

function edgePoints(
  x: number,
  y: number,
  side: EdgeSide,
): readonly [readonly [number, number], readonly [number, number]] {
  if (side === 'north') return [projectedPoint(x, y), projectedPoint(x + 1, y)];
  if (side === 'east') return [projectedPoint(x + 1, y), projectedPoint(x + 1, y + 1)];
  if (side === 'south') return [projectedPoint(x + 1, y + 1), projectedPoint(x, y + 1)];
  return [projectedPoint(x, y + 1), projectedPoint(x, y)];
}

function lowerNeighbor(map: MapDef, x: number, y: number, side: EdgeSide): number {
  const [dx, dy]: readonly [number, number] =
    side === 'north' ? [0, -1] : side === 'east' ? [1, 0] : side === 'south' ? [0, 1] : [-1, 0];
  const row = map.rows[y + dy];
  return elevation(row?.[x + dx]);
}

function writeCliffGuide(map: MapDef, outputRoot: string): void {
  const groups = components(cellsAtElevation(map));
  const slices = groups.map((footprint, index) => {
    const cellElevation = footprint[0]?.elevation;
    if (!cellElevation) throw new Error('An elevated component is empty.');
    const front = footprint.reduce((current, cell) =>
      cell.x + cell.y > current.x + current.y ? cell : current,
    );
    const exposedEdges = footprint.flatMap((cell) =>
      (['north', 'east', 'south', 'west'] as const).flatMap((side) => {
        const lower = lowerNeighbor(map, cell.x, cell.y, side);
        if (lower >= cell.elevation) return [];
        const [from, to] = edgePoints(cell.x, cell.y, side);
        return [{ cell: { x: cell.x, y: cell.y }, side, drop: cell.elevation - lower, from, to }];
      }),
    );
    return {
      id: `${map.id}-cliff-${String(index + 1).padStart(2, '0')}`,
      elevation: cellElevation,
      footprint: footprint.map(({ x, y }) => ({ x, y })),
      depth: { x: front.x + 0.5, y: front.y + 0.5 },
      frontCell: { x: front.x, y: front.y },
      frontGroundCorner: projectedPoint(front.x + 1, front.y + 1),
      exposedEdges,
    };
  });
  const shapes = slices
    .map((slice, index) => {
      const fill = slice.elevation === 2 ? '#9d675d' : '#6f89a1';
      const cells = slice.footprint
        .map(
          (cell) =>
            `<polygon points="${diamond(cell.x, cell.y)}" fill="${fill}" fill-opacity=".45"/>`,
        )
        .join('');
      const edges = slice.exposedEdges
        .map(
          (edge) =>
            `<line x1="${edge.from[0]}" y1="${edge.from[1]}" x2="${edge.to[0]}" y2="${edge.to[1]}" stroke="#271d19" stroke-width="8"/>`,
        )
        .join('');
      const [labelX, labelY] = projectedPoint(slice.frontCell.x + 0.5, slice.frontCell.y + 0.5);
      return `${cells}${edges}<text x="${labelX}" y="${labelY}" fill="#271d19" font-size="20" text-anchor="middle">${index + 1}</text>`;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-128 -192 2304 1280" width="2304" height="1280"><rect x="-128" y="-192" width="2304" height="1280" fill="#f4ead5"/>${shapes}</svg>`;
  writeFileSync(`${outputRoot}/cliff-guide.svg`, svg);
  writeFileSync(
    `${outputRoot}/cliff-slices.json`,
    JSON.stringify(
      {
        map: map.id,
        projection: 'x=768+(x-y)*64; y=(x+y)*32',
        sourceContract:
          'One transparent upright painted cliff/terrace slice per entry. Keep the listed footprint, front ground corner and depth; paint no ground, actors, surfaces, cover or props.',
        slices,
      },
      null,
      2,
    ),
  );
}

function diamond(x: number, y: number): string {
  return (
    projectedPoint(x, y) +
    ' ' +
    projectedPoint(x + 1, y) +
    ' ' +
    projectedPoint(x + 1, y + 1) +
    ' ' +
    projectedPoint(x, y + 1)
  );
}

function color(key: string): string {
  if (key === '=') return '#d5c08e';
  if (key === ',') return '#8d9870';
  if (key === '^' || key === 'A') return '#a79a82';
  if (key === 'r') return '#7e766b';
  if (key === '~') return '#6f9ea2';
  if (key === 'o') return '#4b4038';
  if (key === 'm') return '#7b624d';
  return '#b6a789';
}

export function writeProjectedGuide(map: MapDef, outputRoot: string): void {
  const ground: string[] = [];
  const ownership: string[] = [];
  const counts: Record<string, number> = {};
  const elevated: { x: number; y: number; key: string }[] = [];
  for (let y = 0; y < map.height; y++) {
    const row = map.rows[y] ?? '';
    for (let x = 0; x < map.width; x++) {
      const key = row[x] ?? '.';
      counts[key] = (counts[key] ?? 0) + 1;
      ground.push(`<polygon points="${diamond(x, y)}" fill="${color(key)}"/>`);
      ownership.push(
        `<polygon points="${diamond(x, y)}" fill="${key === '^' || key === 'A' ? '#d14a3a' : 'none'}" stroke="#483c31" stroke-width="1"/>`,
      );
      if (key === '^' || key === 'A') elevated.push({ x, y, key });
    }
  }
  mkdirSync(outputRoot, { recursive: true });
  const svg = (body: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-128 -192 2304 1280" width="2304" height="1280">${body}</svg>`;
  writeFileSync(`${outputRoot}/ground-guide.svg`, svg(ground.join('')));
  writeFileSync(`${outputRoot}/scenery-guide.svg`, svg(ownership.join('')));
  writeFileSync(
    `${outputRoot}/scene-mask.json`,
    JSON.stringify(
      {
        map: map.id,
        projection: 'oblique',
        project: 'x=768+(x-y)*64; y=(x+y)*32',
        dimensions: [map.width, map.height],
        counts,
        elevated,
        spawns: map.partySpawns,
        props: map.props ?? [],
        note: 'Ground is projected into scene chunks; elevated surfaces need separate depth-owned scenery slices.',
      },
      null,
      2,
    ),
  );
  writeCliffGuide(map, outputRoot);
}

const mapId = process.argv[2];
if (mapId) {
  const map = MAPS[mapId];
  if (!map) throw new Error(`Unknown map: ${mapId}`);
  writeProjectedGuide(map, `art/raw/${mapId === 'ambush_road' ? 'cutting' : 'driller'}`);
}
