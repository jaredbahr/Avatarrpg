/**
 * Prints Ba Dan's set-piece plan as JSON (every piece and member: id, name, cells, height in figures, kind, art file) for the kit
 * picture tool (`kit-picture.py`, tool T1 of `docs/level-design.md` section 9). Run: `npx tsx scripts/art/topdown/kit-plan.ts`.
 */
import { BA_DAN_SPRITES, baDanObjects, memberArt } from '../../../src/content/scenes/baDan.layout';
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
    art: memberArt(m.id) ?? null,
  })),
}));
/** The art the rim's trees are actually drawn with: each sprite once, and how many of each stand. */
const rim: Record<string, { art: string; count: number }> = {};
for (const o of baDanObjects())
  if (o.id.startsWith('rim-tree')) {
    rim[o.sprite] = { art: BA_DAN_SPRITES[o.sprite] ?? '', count: (rim[o.sprite]?.count ?? 0) + 1 };
  }
process.stdout.write(
  `${JSON.stringify({ mapId: BA_DAN_SET_PIECE_PLAN.mapId, pieces, rim }, null, 1)}\n`,
);
