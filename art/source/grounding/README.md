# Grounding pass review (ADR 0093)

Before (left) and after (right), from two runs of `e2e/grounding.review.ts` at the same seed and framing: before on
`de7d933` (main, with ADR 0090's 1 px art), after on `claude/grounding-pass` merged with it. 1368x912 viewport, dpr 1. `review/canvas/` and `review/webgl/` are
the two backends (WebGL on the container's software rasteriser, forced with `?renderer=webgl`).

| Sheet              | What it shows                                                                                                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wide-badan.png`   | The Ba Dan market corner at N = 3, half size: the party and the residents                                                                                                                                            |
| `wide-forest.png`  | The forest road at N = 2, half size: bandits on the bank, the props                                                                                                                                                  |
| `feet-badan.png`   | 4x nearest under Kaya, Gao and Mira at N = 3: stepped cast along the painting's objects key                                                                                                                          |
| `feet-forest.png`  | 4x under a thug on the tier-1 bank, Bo on the road and a slinger: the radial pool replaced by the sole band                                                                                                          |
| `props-forest.png` | 4x under the oil flask, the hay bale and a barrel: a contact line where there was none                                                                                                                               |
| `walk-strip.png`   | The leader's feet every 57 ms (half a cel) of one walk east at N = 3, before above after. The camera follows the leader, so the paving moves under the feet; the slide in it is ADR 0067's, unchanged (see ADR 0093) |

Re-capture: `FNT_GROUNDING_LABEL=after FNT_GROUNDING_DIR=<dir> npx playwright test -c playwright.grounding.config.ts`,
the same with `before` on the base commit (a separate worktree: the dev server serves live source), then
`python3 -I art/source/grounding/tools/sheets.py <dir> before after art/source/grounding/review`.

`tools/walk_stride.py` measures the walk's planted-foot travel against the game's (ADR 0093, known faults).
