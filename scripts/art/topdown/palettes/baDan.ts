/**
 * Ba Dan's region palette (ADR 0119, the cohesion pilot, 2026-11-17): every colour the village's
 * ground and objects may use, as ramps from dark to light. Derived from the village's own art (a
 * k-means of the calm bake's 2,839 colours in OKLab, weighted by the square root of each colour's
 * pixel count so the small objects count beside the acres of grass), then tidied by hand into
 * ramps: near-duplicates merged, the void's four blacks cut to two, a stone highlight, a white, a
 * water glint and a cool slate ramp for the dressed stone added (without it the plinths' cool greys
 * fell to the water's blue).
 *
 * The board's bake remaps every plate and upright pixel to its nearest colour here (OKLab, no
 * dithering). Characters are never remapped. The shadow tone `#322125` is in the ink ramp, so the
 * owner's hard shadows land exactly on it.
 */
export const BA_DAN_RAMPS = {
  /** The void, the darkest outlines, and the hard shadow tone. */
  ink: ['#110c0e', '#1d1719', '#322125'],
  /** Cobble, plinths, flags, the well and the shrine: warm greys. */
  stone: [
    '#3e3234',
    '#4c4241',
    '#564e4c',
    '#635f60',
    '#77726f',
    '#857f7a',
    '#938e86',
    '#acaba2',
    '#c8c3b6',
  ],
  /** The plinths' and kerbs' cooler dressed stone (the baker's own `STONE` ramp), kept off the water. */
  slate: ['#3e3d47', '#4f4e58', '#5d5b63', '#706e77'],
  /** Earth, timber and thatch-browns: the aprons, doors, carts, barrels and crates. */
  wood: [
    '#312626',
    '#331b17',
    '#4c3428',
    '#5e3e2b',
    '#795235',
    '#8a5d40',
    '#a17041',
    '#b48655',
    '#d19961',
  ],
  /** Lacquered posts and beams, blossom, the stall's awning: the village's red. */
  lacquer: ['#4a1c19', '#59201d', '#6b2a20', '#8b322a', '#9e422e', '#c5503c'],
  /** Plaster, paper windows, linen and the lamps' glow. */
  plaster: ['#ead570', '#f0c39c', '#ebddba', '#fbf3dc'],
  /** Grass, leaves and the roof tiles' green, with the olive of dry grass and moss. */
  green: [
    '#28392c',
    '#3a4833',
    '#383e2e',
    '#3d573b',
    '#555f40',
    '#476b42',
    '#64734b',
    '#56824b',
    '#779759',
    '#a3bd6a',
  ],
  /** The canal, the ford, wet stones. */
  water: ['#2e414e', '#375d69', '#587376', '#558d93', '#a9c6c4'],
} as const;

export const BA_DAN_PALETTE: readonly string[] = Object.values(BA_DAN_RAMPS).flat();
