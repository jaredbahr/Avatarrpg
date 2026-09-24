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

- JavaScript is governed by the current bundle-budget ADR. ADR 0048 supersedes
  this decision's original 300 KB ceiling with 320 KB gzipped
  (`scripts/check-bundle-size.mjs`).
- Assets get their own gate in A2: 4 MB per scene bundle, 25 MB total precache. `workbox.globPatterns` gains `webp,json`.

## Consequences

- Adding a unit or an enemy needs a `sheet` entry and an atlas, never a change in `src/core/`.
- Phase 2 content can be authored against the contract with painters as placeholders.
- The art bible is a generation spec that produces frames in exactly this shape.

## Amendment, 2026-09-16: as built

The runtime landed with the look-gate milestone, ahead of any generated art.
What it decided along the way, where it departs from the plan above, and
why:

- **Every unit already draws through the sheet path.** A key with a
  `painter` entry gets a sheet baked from that painter's poses
  (`src/render/sheets/bake.ts`): the full clip table, laid out by the same
  pure `layoutSheet` the art scripts use, into an atlas of exactly the shape
  a real sheet has. Real sheets replace baked ones key by key with no other
  change, and both backends and the clip logic were exercised for weeks
  before the first real frame existed.
- **No Pixi `Assets` or `Spritesheet`.** One `fetch` for the JSON and one
  `Image` for the PNG (`src/render/sheets/store.ts`), parsed by
  `parseAtlasJson`, so the Canvas 2D backend reads the same file through the
  same code and the WebGL backend makes frame textures as views onto one
  uploaded texture (`new Texture({ source, frame })`), never through the
  global cache.
- **The anchor stands on the tile's foot line.** The frame's anchor
  `(0.5, 0.85)` is placed 85% of the way down the tile the unit stands on,
  centred on its footprint. A 192-tall frame therefore rises 0.425 tile above
  the tile's top edge and dips 0.075 below its bottom; the head overlaps the
  tile above. The health bar sits above the art's headroom, which is 0 for a
  baked placeholder that lives inside the tile.
- **A baked painter sits inside the tile.** The painter's square box is
  placed in the frame so that its ground shadow (`0.86` of the box) lands on
  the foot line; the top 0.415 tile of the frame is empty until the
  cel-shaded figures use it. Baked at the zoom's sprite bucket, capped at
  256 device pixels a tile, in a set bounded by bytes (48 MB) and cleared on
  resize, for the iOS canvas cap.
- **The choreography names the pose.** A pose track carries the frame it
  shows (a cast's wind-up is frame 0, release 1, recover 2; a melee holds
  its strike through the recover; hit and KO are frame 0), so a clip's
  timing never has to be guessed from a phase's clock. A walk clip advances
  by distance instead of time, two poses a tile at 4 fps, so a fast and a
  slow unit both stride. Idle breathes on the map clock with a per-unit
  phase so a row does not breathe in step.
- **One facing, mirrored, at draw time.** Sheets face screen-right; the
  backends flip about the anchor for the other side. `facing: 'both'` is
  reserved and currently draws as `mirror`.
- **Validation is in `validateContent`.** The manifest travels in the content
  bundle: every entry parses, every sheet has `idle` and `cast`, frame counts
  stay in the clip table's bounds, frame names are `<key>/<clip>/<index>`,
  a sheet's footprint matches its unit's size, and every sprite key a
  character, enemy, prop or NPC names has an entry.
- **A probe atlas is committed.** `public/art/test/probe.png` and its JSON,
  five flat-colour frames written by `scripts/make-probe-atlas.mjs`, sit
  behind `unit.test.probe`; `e2e/sheets.spec.ts` points a unit at it and
  reads the colour back on both backends, so the loader and the frame
  drawing are covered before any generated art lands.
- **Art scripts are the next slice**, in TypeScript under `tsx` rather than
  `.mjs`, sharing `layoutSheet` and the zod schema; the asset budget gate
  arrives with them.

## Amendment, 2026-09-16: the scripts against real generator output

- **JPEG is read, never written.** The scripts decode a JPEG through
  `jpeg-js` (pure JavaScript, dev-only, beside `pngjs`; `sharp` stays
  rejected for its native binary) for portraits and paintings, and read
  any file's size from its header (`imageSize`) so an inventory decodes
  nothing. Sheet frames stay PNG only: a lossy edge on the key colour
  fringes after keying.
- **Image entries are validated.** `art:validate` checks every `image`
  entry the way it checks sheets: the file exists under `public/`, is the
  PNG or WebP its name says, a `portrait.*` key measures 512×512 and no file
  passes 512 KB. The loader falls back to the drawn placeholder on a missing
  file, so without this a typo shipped green.
- **`art:portrait`** makes the 512 px PNG from a candidate: the centre square,
  anything clear composited onto the parchment, the box filter down, the
  manifest line with the palette the manifest carries. **`art:inventory`**
  lists a folder of loosely named pictures with what the game takes each
  for and the command that takes it in. **`art:map`** crops a painting up to
  a tenth off the map's aspect and reports the band in tiles, and refuses
  further. **`art:normalise`** stops on a background that is not the key,
  reports a figure too small to stand its height, and names files it passed
  over. Raw pictures travel on an `art-intake` branch under `art/incoming/`,
  which `check:assets` refuses in any checkout, so they never reach `main`.
