/**
 * Prints Ba Dan's set-piece plan as JSON (every piece and member: id, name, cells, height in figures, kind) for the kit
 * picture tool (`kit-picture.py`, tool T1 of `docs/level-design.md` section 9). Run: `npx tsx scripts/art/topdown/kit-plan.ts`.
 */
import { BA_DAN_SET_PIECE_PLAN } from '../../../src/content/scenes/baDan.setpieces';

const pieces = BA_DAN_SET_PIECE_PLAN.pieces.map((p) => ({
  id: p.id,
  focal: p.focal === true,
  bulk: p.bulk === true,
  members: p.members.map((m) => ({
    id: m.id,
    name: m.name,
    x: m.x,
    y: m.y,
    w: m.w,
    h: m.h,
    height: m.height,
    solid: m.solid,
    kind: m.kind,
    have: m.have ?? null,
  })),
}));
process.stdout.write(
  `${JSON.stringify({ mapId: BA_DAN_SET_PIECE_PLAN.mapId, pieces }, null, 1)}\n`,
);
