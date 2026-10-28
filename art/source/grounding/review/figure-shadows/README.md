# Figure shadows: before and after (ADR 0093's figure amendment)

Owner, 2026-10-28, on the world-style figure test: "the sharper pixels are better. we need to fix their shadows
though. the shadows make them look off."

Before is `main` at the merge of #317 (6a48c90b); after is this change. Both captured with the review fixtures at
the scene's default zoom (N = 2), then built by `art/source/grounding/tools/figure_shadow_review.py`.

| file                                       | what                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `crop-4x-gao-door-<canvas\|webgl>.png`     | Gao at his door, 4x nearest. Rows: shipped figures, `?style=world`. Columns: before, after |
| `crop-4x-market-table-<canvas\|webgl>.png` | Kaya, Sura and Bo by Gao's market table, the same layout                                   |
| `slice-canvas.png`                         | the whole Ba Dan slice. Top: before; bottom: after. Left: shipped; right: `?style=world`   |
| `forest-bank.png`                          | the first fight on the forest bank, Canvas. Top: before; bottom: after                     |

What changed: a figure's shadow was its silhouette sheared along the key (cast 0.5) over a band cut from its soles
(contact 0.8), in the bible ink. It is now a calm pool under the feet with a short cast along the key and a small
core under the soles, in the painting's own tone (ink (0, 3, 11) at 0.335 and 0.535, fitted by
`figure_shadow_tone.py` to the painted objects' shadows). The forest keeps its levels and ink and gets the new shape.

The WebGL before column of the market table sits a few pixels off the others: that run's drag pan landed slightly
differently under the software renderer. The figures and the moment are the same.
