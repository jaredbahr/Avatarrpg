# Combat readability #336 — matched browser captures

These four unaltered system Chromium screenshots compare the exact #322 parent
`3c30515511e2cd5aea811e919f8cbbc12c855003` with the #336 source built
from `a732f986efc9d0000f0b646421181672ff2ba780`. Both revisions use the
same `combat-readability` seed, Kaya/Sura/Bo party, `battle_forest_road` map,
forced Canvas renderer, and review driver at `b76ab235012951d5f418e5ab24f99963be12e9a1`
[`scripts/review/combat-readability-evidence.mjs`](../../../../scripts/review/combat-readability-evidence.mjs).
The driver stages the first living enemy as the **displayed** active unit at
7/13 HP, with motion reduced, to show the cue and damaged bar. It changes only
the render view; the actual battle turn and enemy HP remain untouched. This is
visual review evidence, not a legal enemy turn or a gameplay balance claim.

| View                                                                         | Before: #322 parent                                  | After: #336 source                                 |
| ---------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------- |
| Desktop, 1280×800 CSS px, DPR 1, Normal text                                 | [before-desktop.png](before-desktop.png)             | [after-desktop.png](after-desktop.png)             |
| iPad portrait emulation, 834×1194 CSS px, DPR 2, Huge text and High Contrast | [before-portrait-ipad.png](before-portrait-ipad.png) | [after-portrait-ipad.png](after-portrait-ipad.png) |

The iPad-sized captures use Chromium touch emulation. The #322 parent and #336
source were built separately with `npm run build` under activated Node 22.23.4.
The two preview servers served their respective `dist` directories at fresh
localhost ports; the capture commands were:

```sh
source /workspace/avatarrpg-env/activate.sh
# In the detached #322 worktree: npm run preview -- --port 4390 --host 127.0.0.1 --strictPort
node --experimental-strip-types scripts/review/combat-readability-evidence.mjs http://127.0.0.1:4390 .shots/combat-readability/evidence-before 3c30515511e2cd5aea811e919f8cbbc12c855003
# In the #336 worktree: npm run preview -- --port 4391 --host 127.0.0.1 --strictPort
node --experimental-strip-types scripts/review/combat-readability-evidence.mjs http://127.0.0.1:4391 .shots/combat-readability/evidence-after a732f986efc9d0000f0b646421181672ff2ba780 .shots/combat-readability/evidence-before
```

The driver recorded the same six combatants, target enemy `e5`, actual enemy
HP 22/22, actual turn `p0`, displayed HP 7/13, six initiative chips, and a
64-CSS-pixel tile on both builds. Desktop camera offsets were `(768, 483)`
before and `(768, 467)` after because the initiative strip shrank from
88.6875 to 57 CSS px and the map grew by 31.6875 CSS px. Portrait offsets
were `(1119, 473)` in both builds; the strip remained 131.5625 CSS px with
Huge text and High Contrast, with no clipped chip names in either capture.

The browser spec separately checks Canvas and forced WebGL at both viewport
sizes, 48-CSS-pixel tap targets, the desktop one-row strip, unclipped Huge
names, reduced motion, High Contrast, and painted 7/13 HP pixels. Its
fractional DPR-2 camera probe checks exact painted frame and active cue
device-pixel edges across backends. Physical iPad Safari review remains
outside this capture.

Raw screenshots and JSON metadata live under ignored `.shots/`; only these
four review frames are committed.
