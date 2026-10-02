# Grumbler quarry driller

The quarry-floor boss retains this machine portrait alongside the live 2x2
Driller sheet. The portrait follows the approved quarry target's industrial language:
tracked mass, riveted rust armor, dark iron, restrained brass, an amber cab slit
and a chunky steel drill. No operator likeness, weapon, ability or destination is added.

| Deliverable              | Path                                      |
| ------------------------ | ----------------------------------------- |
| UI portrait              | `public/art/portraits/enemy.grumbler.png` |
| Exact generation prompts | `docs/art/grumbler-prompts.json`          |

The built-in OpenAI image tool generated the original reference and portrait.
The former nine-pose runtime sheet was retired by A-6 when `unit.enemy.driller`
became live; its separate PixelLab provenance is in `docs/art/driller-2x2.md`.
The portrait and prompts remain durable deliverables. Output terms:
https://openai.com/policies/row-terms-of-use/. No exclusive copyright in generated
output is claimed.

The portrait can be reproduced with `npm run art:portrait -- --key enemy.grumbler
--in art/raw/grumbler/portrait.png`, followed by `npm run art:validate`.

## Visual review

- `36-grumbler-portrait`: quarry-floor still plus inspector on Surface/iPad
  landscape and portrait sizes, showing the same machine in the turn strip,
  large portrait and battlefield.
- `36-grumbler-motion`: 2x2 Driller movement into the hydraulic strike,
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
