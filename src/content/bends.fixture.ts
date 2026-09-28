/**
 * The approved r9 south-east bends, as numbers, for `bends.test.ts`.
 *
 * Copied from `bend-r9/out/final/{fire,earth,water}-timing.json` in the art
 * tools checkout: cel count and timing, key frames (named as r9 names them,
 * with the shared role each plays), the smear cel, the attacks' frames, sockets
 * and hit-stop, and the measured wrist and ankle sockets per cel, in 320 px
 * cel coordinates. r9 records no foot anchor and no impact hold, so those are
 * placeholders; everything else is the take as approved. Test data only:
 * nothing at runtime imports this file.
 */

import type { BendAttackCue, BendElement, BendFrameSockets, HeadingBendDef } from './bends';

/** LW x,y, RW x,y, LA x,y, RA x,y for one cel. */
type SocketRow = readonly [number, number, number, number, number, number, number, number];

interface R9Take {
  readonly take: string;
  readonly unitAsset: string;
  readonly element: BendElement;
  readonly frameMs: readonly number[];
  readonly root: { readonly x: number; readonly y: number };
  readonly keyFrames: HeadingBendDef['keyFrames'];
  readonly smearFrame: number;
  readonly attack: BendAttackCue;
  readonly sockets: readonly SocketRow[];
}

/** Kaya's fire bend: 13 cels, a jab (LW f2, 60 ms) and a cross (RW f6, 100 ms). */
export const R9_FIRE: R9Take = {
  take: 'kaya-r9f-a',
  unitAsset: 'unit.fire.kaya',
  element: 'fire',
  frameMs: [60, 60, 110, 50, 120, 40, 150, 110, 70, 110, 70, 70, 120],
  root: { x: 65, y: 61 },
  keyFrames: {
    F1: { frame: 2, role: 'contact' },
    F2: { frame: 4, role: 'anticipation' },
    F3: { frame: 6, role: 'contact' },
    F4: { frame: 9, role: 'recovery' },
  },
  smearFrame: 5,
  attack: {
    id: 'fire-strike',
    effectId: 'fx.fire.jet',
    releases: [
      { frame: 2, launchFrame: 2, socket: 'LW', launchHoldMs: 60, impactHoldMs: 0 },
      { frame: 6, launchFrame: 6, socket: 'RW', launchHoldMs: 100, impactHoldMs: 0 },
    ],
    damageRelease: 1,
  },
  sockets: [
    [202.4, 151.1, 167.4, 142.9, 181, 218, 139, 227],
    [213.7, 152.7, 168.4, 146.5, 186, 213.7, 140, 221],
    [229.5, 154.9, 156.1, 157, 196.2, 217.7, 141, 221],
    [222.9, 163, 159.3, 162.1, 220, 228, 141, 221],
    [221.9, 165.6, 164.6, 163.8, 232.3, 230.4, 143, 219],
    [220.6, 176.3, 212.8, 186.7, 232.3, 229.4, 143, 218],
    [214.9, 172.3, 245.3, 179.4, 231.3, 232.4, 142, 221],
    [215.9, 172.2, 238.3, 176.7, 228.5, 231.1, 142, 221],
    [222, 170.2, 216, 173.1, 224, 225, 144, 218],
    [224.9, 161.7, 185.9, 168.2, 212.8, 223.5, 142, 221],
    [212.3, 160, 175.3, 157.5, 191.5, 219.6, 138, 224],
    [203.8, 155.4, 169.5, 146.4, 180, 217, 138, 226],
    [202.4, 151.1, 167.4, 142.9, 181, 218, 139, 227],
  ],
};

/** Bo's earth bend: 12 cels, a stomp (LA f4, 50 ms) and a drive (LW f6, 110 ms). */
export const R9_EARTH: R9Take = {
  take: 'bo-r9e-a',
  unitAsset: 'unit.earth.bo',
  element: 'earth',
  frameMs: [60, 80, 150, 40, 130, 50, 170, 120, 80, 130, 90, 120],
  root: { x: 68, y: 61 },
  keyFrames: {
    E2: { frame: 2, role: 'anticipation' },
    E3: { frame: 4, role: 'contact' },
    E4: { frame: 6, role: 'contact' },
    E5: { frame: 9, role: 'recovery' },
  },
  smearFrame: 3,
  attack: {
    id: 'earth-strike',
    effectId: 'fx.earth.slab',
    releases: [
      { frame: 4, launchFrame: 4, socket: 'LA', launchHoldMs: 50, impactHoldMs: 0 },
      { frame: 6, launchFrame: 6, socket: 'LW', launchHoldMs: 110, impactHoldMs: 0 },
    ],
    damageRelease: 1,
  },
  sockets: [
    [204.9, 157.1, 164.1, 151.3, 185, 219, 130, 228],
    [195.5, 153.7, 148.2, 158.3, 186, 217, 131, 226],
    [180.3, 158.9, 115.5, 163.1, 190.9, 201.7, 130, 230],
    [194.8, 161.7, 129.2, 168.5, 204.2, 226.4, 130, 230],
    [198.1, 163.4, 132.9, 169.8, 208.7, 232, 130, 231],
    [218.4, 178.8, 142.6, 182.8, 208.7, 231, 130, 230],
    [246.7, 179.3, 151.6, 195.5, 207.7, 231, 129, 230],
    [243.4, 178, 151.2, 191.4, 208.7, 230, 130, 229],
    [228.7, 174.1, 147.2, 178.5, 208.7, 230, 130, 229],
    [212.4, 164.9, 139.8, 164.4, 208.7, 229, 130, 228],
    [209.2, 160.8, 161.8, 159.6, 191.9, 218.3, 131, 227],
    [204.9, 157.1, 164.1, 151.3, 185, 219, 130, 228],
  ],
};

/** Sura's water bend: 11 cels, one release (LW f5, 80 ms). */
export const R9_WATER: R9Take = {
  take: 'sura-r9w-final',
  unitAsset: 'unit.water.sura',
  element: 'water',
  frameMs: [60, 70, 110, 150, 40, 140, 110, 70, 130, 80, 120],
  root: { x: 64, y: 62 },
  keyFrames: {
    W2: { frame: 2, role: 'anticipation' },
    W3: { frame: 3, role: 'anticipation' },
    W4: { frame: 5, role: 'release' },
    W5: { frame: 8, role: 'recovery' },
  },
  smearFrame: 4,
  attack: {
    id: 'water-strike',
    effectId: 'fx.water.whip',
    releases: [{ frame: 5, launchFrame: 5, socket: 'LW', launchHoldMs: 80, impactHoldMs: 0 }],
    damageRelease: 0,
  },
  sockets: [
    [206.8, 161.4, 173.3, 153.4, 180, 218, 135, 227],
    [223.1, 161.9, 154.5, 167, 190.7, 219.5, 134, 225],
    [210.3, 126.9, 115.7, 163.5, 196.7, 221, 135, 225],
    [136.2, 136.6, 114, 163.3, 195.7, 221, 134, 225],
    [195.1, 149.9, 136.3, 168.8, 197.7, 218, 136, 222],
    [241.4, 154.7, 151.8, 177.2, 197.7, 218, 136, 222],
    [245.7, 167.6, 135.3, 164.9, 197.7, 218, 136, 222],
    [233.9, 169.6, 136.8, 168.8, 196.7, 220, 135, 224],
    [206.4, 168.2, 137.3, 166.4, 195.7, 221, 134, 225],
    [206.3, 163.4, 163.7, 159, 180.7, 216.5, 134, 225],
    [206.8, 161.4, 173.3, 153.4, 180, 218, 135, 227],
  ],
};

export const R9_TAKES = [R9_FIRE, R9_EARTH, R9_WATER] as const;

/** The atlas frame names a take's cels pack under. */
export function r9FrameNames(take: R9Take): string[] {
  return take.frameMs.map((_, index) => `${take.take}/${index}`);
}

/** A take as one heading's bend. */
export function r9Heading(take: R9Take): HeadingBendDef {
  const socketsPerFrame = take.sockets.map(
    ([lwX, lwY, rwX, rwY, laX, laY, raX, raY], frame): BendFrameSockets => ({
      frame,
      sockets: {
        LW: { x: lwX, y: lwY },
        RW: { x: rwX, y: rwY },
        LA: { x: laX, y: laY },
        RA: { x: raX, y: raY },
      },
    }),
  );
  return {
    frames: r9FrameNames(take),
    frameMs: [...take.frameMs],
    sourceSize: { width: 320, height: 320 },
    root: take.root,
    anchor: { x: 0.5, y: 0.9 },
    keyFrames: take.keyFrames,
    smearFrame: take.smearFrame,
    attacks: [take.attack],
    socketsPerFrame,
  };
}
