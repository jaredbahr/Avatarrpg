# ADR 0003: Asset contract for cel-shaded frame sheets

**Status:** accepted, 2026-09-15 (schema lands in Phase A2)

## Context

`src/content/assets/manifest.ts` is the art swap point. Its `image` entry is
one still per key, which cannot describe an animated unit. Art will be
AI-generated (see `docs/art-bible.md`), and the known weakness of generated
art is consistency of one character across many frames.

## Decision

### Pose sheets, not animation sheets

Each clip is one to four key poses. The animator supplies motion (eased
lunges, arcs, squash and stretch, recoil) and particle effects supply the
bending. Budget: 12 to 16 frames per unit instead of 40 to 80, which cuts the
consistency risk by roughly four.

### Clip vocabulary

| Clip    | Poses                         | Required | Fallback                |
| ------- | ----------------------------- | -------- | ----------------------- |
| `idle`  | 2                             | yes      | —                       |
| `walk`  | 2–4                           | no       | `idle` + bob            |
| `cast`  | 3 (wind-up, release, recover) | yes      | `idle`                  |
| `melee` | 2                             | no       | `cast`                  |
| `hit`   | 1                             | no       | `idle` + flash + recoil |
| `ko`    | 1                             | no       | `hit` + fade            |

A missing atlas falls back to the painter. Nothing ever renders as nothing.

### One facing, mirrored

Two consistent facings are beyond generation today. Sprites face screen-right;
enemies are mirrored. Asymmetric costume details flip, and that is accepted;
the art bible forbids text and lettering on costumes for the same reason.

### Frame specification

- `pixelsPerTile: 128` at 1x. A one-tile unit is 128×192 (one tile wide, 1.5 tall) anchored at (0.5, 0.85) so the head overlaps the tile above. The two-tile boss is 256×192.
- Atlases are PNG, at most 2048×2048, in the TexturePacker JSON-hash format Pixi's `Spritesheet` loads natively. WebP is an optimisation for later.
- Frame names: `<unitKey>/<clip>/<index>` (for example `unit.fire.kaya/cast/1`).

### Manifest entry

```ts
type AssetEntry =
  | { kind: 'painter'; painter: string; palette: string; variant?: string } // placeholder, today's default
  | { kind: 'image'; url: string } // still art: portraits, props
  | {
      kind: 'sheet';
      atlas: string; // 'art/units/fire.json'
      pixelsPerTile: number;
      footprint: { w: number; h: number }; // in tiles
      anchor: { x: number; y: number }; // fraction of the frame
      facing: 'mirror' | 'both';
      clips: Partial<
        Record<
          ClipName,
          { frames: string[]; fps: number; loop: boolean; events?: { hit?: number } }
        >
      >;
    };
```

The zod schema lives in `src/content/schemas.ts`; `validateContent` checks the
required clips exist and every frame name is present in the atlas JSON.

### One pipeline for placeholders and real art

A runtime baker in `src/render/sheets/` paints each painter's poses into an
in-memory atlas of the same `sheet` shape. Both backends and the clip runtime
therefore have one code path, exercised before any generated art lands. Real
sheets replace baked ones key by key.

### Loading

- WebGL: Pixi `Assets.load(atlas.json)` → `Spritesheet` → per-frame `Texture`.
- Canvas 2D: the same JSON parsed once, then `drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh)` per frame.
- Portraits stay `image` entries drawn through `painterCanvas` in `src/app/ui/dom.ts`.
- Ground stays the procedural shader. Painted terrain decals layer on top as sprites in Phase C.

### Budgets

- JavaScript stays at 300 KB gzipped (`scripts/check-bundle-size.mjs`).
- Assets get their own gate in A2: 4 MB per scene bundle, 25 MB total precache. `workbox.globPatterns` gains `webp,json`.

## Consequences

- Adding a unit or an enemy needs a `sheet` entry and an atlas, never a change in `src/core/`.
- Phase 2 content can be authored against the contract with painters as placeholders.
- The art bible is a generation spec that produces frames in exactly this shape.
