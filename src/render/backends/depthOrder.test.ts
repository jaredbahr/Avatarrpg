import { describe, expect, it } from 'vitest';
import { sceneryZ, shadowZ } from './depthOrder';

interface Child {
  name: string;
  zIndex: number;
}

/** Pixi's sortChildren: a stable sort on zIndex, ties left in child order. */
function pixiOrder(children: readonly Child[]): string[] {
  return [...children].sort((a, b) => a.zIndex - b.zIndex).map((child) => child.name);
}

/**
 * Canvas 2D's occupants: scenery is listed ahead of every figure and the sort
 * is stable, and a figure paints its own shadow before itself.
 */
function canvasOrder(depths: { scenery: number; figure: number }): string[] {
  const occupants = [
    { depth: depths.scenery, names: ['scenery'] },
    { depth: depths.figure, names: ['shadow', 'figure'] },
  ];
  return occupants.sort((a, b) => a.depth - b.depth).flatMap((occupant) => occupant.names);
}

describe('equal-depth ties on WebGL', () => {
  const tie = 412.5;

  it('sorts scenery under a figure and its shadow, whatever the child order', () => {
    const figure = { name: 'figure', zIndex: tie };
    const shadow = { name: 'shadow', zIndex: shadowZ(tie) };
    const scenery = { name: 'scenery', zIndex: sceneryZ(tie) };
    // The figure's sprites were added first, as after a map change reuses them.
    for (const children of [
      [figure, shadow, scenery],
      [scenery, shadow, figure],
      [shadow, figure, scenery],
    ])
      expect(pixiOrder(children)).toEqual(['scenery', 'shadow', 'figure']);
    expect(canvasOrder({ scenery: tie, figure: tie })).toEqual(['scenery', 'shadow', 'figure']);
  });

  it('still lets a figure behind the piece sort under it, as on Canvas 2D', () => {
    // One pixel of ground depth dwarfs the bias.
    const figure = tie - 1;
    const children = [
      { name: 'scenery', zIndex: sceneryZ(tie) },
      { name: 'shadow', zIndex: shadowZ(figure) },
      { name: 'figure', zIndex: figure },
    ];
    expect(pixiOrder(children)).toEqual(canvasOrder({ scenery: tie, figure }));
    expect(pixiOrder(children)).toEqual(['shadow', 'figure', 'scenery']);
  });
});
