/** Art-space silhouettes, in map tiles. Sort at the object's ground contact.
 * These redraw the same painting pixels, so both backends share exact edges.
 * Canopy and trunk are separate: the air beneath branches stays transparent.
 */
export interface SceneryLayer {
  readonly id: string;
  readonly depth: number;
  readonly outlines: readonly (readonly (readonly [number, number])[])[];
}

export const RIVERSIDE_SCENERY: readonly SceneryLayer[] = [
  {
    id: 'banyan',
    depth: 12.3,
    outlines: [
      [
        [7.3, 9.5],
        [7.8, 8.6],
        [8.5, 8.3],
        [8.4, 7.6],
        [9.2, 7.2],
        [9.9, 7.4],
        [10.4, 6.9],
        [11.1, 7.4],
        [11.8, 7.1],
        [12.6, 7.6],
        [13.2, 7.6],
        [13.5, 8.3],
        [14.2, 8.6],
        [14.1, 9.1],
        [14.8, 9.4],
        [14.4, 10],
        [13.9, 10.1],
        [14.2, 10.6],
        [13.5, 10.8],
        [12.8, 10.2],
        [12.3, 10.6],
        [11.7, 10.1],
        [11.2, 10.6],
        [10.5, 10.2],
        [10, 10.7],
        [9.5, 10.3],
        [8.9, 10.6],
        [8.4, 10.1],
        [7.7, 10.4],
      ],
      [
        [10.5, 9.8],
        [11.5, 9.7],
        [11.2, 10.8],
        [10.7, 11.6],
        [11.1, 12.1],
        [10.3, 12],
        [9.6, 11.7],
        [10.2, 10.9],
      ],
    ],
  },
  {
    id: 'tea-eaves',
    depth: 19.6,
    outlines: [
      [
        [2, 15.5],
        [4.1, 14.5],
        [4.5, 13.9],
        [4.9, 14.8],
        [6.4, 15.1],
        [6.6, 14.9],
        [6.3, 15.7],
        [7.3, 16.4],
        [8.6, 16.7],
        [8.8, 16.3],
        [9.1, 16.4],
        [8.6, 17.3],
        [7.4, 17.9],
        [6.2, 18.4],
        [5.1, 17.7],
        [3.6, 17.1],
      ],
    ],
  },
  {
    id: 'foreground-boughs',
    depth: 24,
    outlines: [
      [
        [11.4, 21],
        [12.2, 20],
        [12.1, 19],
        [12.8, 18.7],
        [12.6, 17.8],
        [13.5, 17.1],
        [14.2, 17.5],
        [14.7, 16.9],
        [15.4, 17.2],
        [15.8, 18],
        [16.7, 18.1],
        [17.1, 19],
        [18, 19.5],
        [17.8, 20.3],
        [18.6, 20.8],
        [18, 21.7],
        [17, 22.2],
        [16.3, 21.7],
        [15.5, 22.2],
        [14.8, 22],
        [14.1, 22.8],
        [13.3, 22.3],
        [12.4, 22.8],
        [11.6, 22.2],
      ],
    ],
  },
];

/** Even-odd containment also drives the unobtrusive hidden-party marker. */
export function behindScenery(x: number, y: number): boolean {
  return RIVERSIDE_SCENERY.some(
    (layer) =>
      y < layer.depth &&
      layer.outlines.some((points) => {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
          const a = points[i],
            b = points[j];
          if (!a || !b) continue;
          if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0])
            inside = !inside;
        }
        return inside;
      }),
  );
}
