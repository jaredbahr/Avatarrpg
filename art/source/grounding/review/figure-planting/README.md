# Figure planting: before and after (ADR 0093's planting amendment)

Owner, relayed, 2026-10-28, on #319 and the world-style figures: "Better. They're still floating."

Before is `main` at the merge of #319 (450b13bb); after is this change. Captured with the review fixtures at N = 2
and built by `BEFORE_ROOT=<main checkout> REVIEW_NAME=figure-planting python3 -I
art/source/grounding/tools/figure_shadow_review.py`.

| file                                       | what                                                                                           |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `walk-strip.png`                           | mid-walk: the leader's feet every half cel of one walk east (Canvas). Top before, bottom after |
| `feet-<who>.png`                           | 4x under each Ba Dan figure's feet (Canvas). Left before, right after                          |
| `crop-4x-gao-door-<canvas\|webgl>.png`     | Gao at his door. Rows: shipped figures, `?style=world`. Columns: before, after                 |
| `crop-4x-market-table-<canvas\|webgl>.png` | Kaya, Sura and Bo by Gao's market table, the same layout                                       |
| `slice-canvas.png`                         | the whole Ba Dan slice. Top before, bottom after. Left shipped, right `?style=world`           |
| `forest-bank.png`                          | the first fight on the forest bank, Canvas. Top before, bottom after                           |

What changed: every idle and walk cel now stands on its own lowest sole (the walks' soles were up to 9.5 world px
off the foot line), the pool is centred between the resting feet instead of on the near foot, and a 1–2 px contact
line in the painting's contact tone sits under each sole that touches the ground.
