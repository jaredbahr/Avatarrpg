# Grumbler quarry driller

The quarry-floor boss has a nine-pose illustrated sheet and matching machine
portrait. The design follows the approved quarry target's industrial language:
tracked mass, riveted rust armor, dark iron, restrained brass, an amber cab slit
and a chunky steel drill. It remains an original machine with the existing
two-tile footprint. No operator likeness, weapon, ability or destination is added.

| Deliverable                | Path                                      |
| -------------------------- | ----------------------------------------- |
| Runtime atlas and metadata | `public/art/units/grumbler.{png,json}`    |
| UI portrait                | `public/art/portraits/enemy.grumbler.png` |
| Exact generation prompts   | `docs/art/grumbler-prompts.json`          |
| Grid importer              | `scripts/art/grumbler-motion.ts`          |

The built-in OpenAI image tool generated the original reference, pose sheet and
portrait. The first pose sheet crowded adjacent cells and clipped track ends;
it was rejected. A second pass restored complete machines and wide transparent
gutters. The importer rejects empty cells and any source touching its cell edge.
Raw candidates live in ignored `art/raw/grumbler/`; the packed art and prompts
are the durable deliverables. Output terms:
https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated
output is claimed.

## Packing

```bash
node --import tsx scripts/art/grumbler-motion.ts art/raw/grumbler/poses.png
npm run art:normalise -- --unit unit.enemy.grumbler --key alpha --width 2 --height 0.88
npm run art:pack -- --unit unit.enemy.grumbler --name grumbler
npm run art:portrait -- --key enemy.grumbler --in art/raw/grumbler/portrait.png
npm run art:validate
```

Row order in the source is idle A, idle B, walk A; walk B, wind-up, release;
recovery, hit, KO. A common scale preserves chassis proportions. The 256×192
frames retain alpha, at least eight pixels of margin and track contact at y=162.
The atlas is 2048×384. Pose motion belongs to the chassis and drill cradle;
smoke, impacts, debris, oil and sound remain in their existing runtime layers.
KO darkens the cab and lowers the drill without an explosion or detached parts.

The manifest uses the existing sheet contract, `(0.5, 0.85)` anchor and 2×1
footprint. A narrow painter-registry selection preserves `paintDriller` while
this atlas loads or if fetching it fails; otherwise the generic sheet fallback
would incorrectly show a human. Gameplay, collision, attack timing and saves
remain unchanged.

## Visual review

- `36-grumbler-portrait`: quarry-floor still plus inspector on Surface/iPad
  landscape and portrait sizes, showing the same machine in the turn strip,
  large portrait and battlefield.
- `36-grumbler-motion`: one-tile tread movement into the hydraulic strike,
  release and recovery through the production animator on Canvas and WebGL.
- `36-grumbler-shutdown`: the powered-down cab and lowered drill during the
  existing KO settling/fade on both renderers.
- `36-grumbler-fallback`: blocks the real atlas request and verifies visually
  that the original two-tile machine painter remains grounded and visible.

These are staged art captures, not a continuous route playthrough or physical
device test. The long boss inspector initially scrolls toward its focused Close
button; this was reported to the gameplay owner. Portrait review explicitly
scrolls to the header after the entrance animation, without hiding that product
issue or changing shared dialog behavior in this art pass.
