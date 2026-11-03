# ADR 0094: Figures at 1.0 on oblique boards, the world's grain

**Status:** accepted by the owner, 2026-10-28 ("1.0x, matching the world"); **reversed the same day** (amendment below:
"1.25× now, redraw later")

Amends ADR 0089 (the party at native G1), whose figures were drawn at 1.25, and applies ADR 0088 (integer zoom) to
them; also amends ADR 0074 (the JavaScript budget). Changes a rendering contract (the size every figure is drawn at on
an oblique board) and a budget, so it is recorded here.

## Context

The party (ADR 0089), the Ba Dan residents and the forest bandits (ADR 0091) are drawn on the world's grid: one art px
a world px, about 59 px tall. On oblique boards `partyScale` drew them at 1.25, a size carried over from the 2x G sheets,
so one art px covered 1.25 world px: 2.5 device px at N = 2 and 3.75 at N = 3. `pixelSampling` correctly smooths any
ratio that is not whole, so every figure resampled soft beside the painting and the props, which sample nearest at
every N (ADR 0093 listed it as a known fault). The review of #301 saw it as the residents and the thug going soft next
to the crisp world; Kaya was just as soft.

## Decision

**`OBLIQUE_FIGURE_SCALE = 1`** (`src/app/anim/actorScale.ts`). Every figure on an 8-heading sheet (the party, the
residents, the bandits, the quarry bender) is drawn at 1 on oblique boards, so an art px is exactly N x N device px at
every integer zoom and samples nearest on both backends, the same grain as the painting. A G1 adult now stands 55-61
world px (0.86-0.95 of a tile), where it stood 69-76 at 1.25.

**Other adults stay level with them.** Art not on the G1 grid (the crossbowman, the cutting figures and the other
legacy enemy sheets; Hanru's painted placeholder) was sized to stand as tall as a G figure at 1.25, so on oblique boards
it is scaled by `OBLIQUE_LEGACY_ADULT = 1 / 1.25`: the crossbowman 1.23 x 0.8, Hanru 1.4 x 0.8. Those sheets are not
on the world's grid and still resample; that is their art's fault, not this scale's. Unchanged: the Driller (sized by its
2x2 footprint, not an adult's height), the turtle-ducks and objects shown as NPCs (sized against the world), and every
orthographic board (scale 1 already), including the riverside's living layer.

**Everything derived follows the scale, not a constant.** Sockets, choreography attachments, explore markers, the talk
pip, combat picking and hit boxes, health bars and the bend placement all multiply by the actor's scale. The veil's
probes (`src/render/scene.ts`) are in a figure's art px and multiply by its scale too, so the head probe at 56 sits at
about 95% of a G1 adult at 1 as it did at 1.25; the Ba Dan veil sweep (`baDanDepth.test.ts`) passes at the new scales
(1, 1.12 for Hanru, 1.5 for the tea station). Moving the probe lower (50, Mira's forehead) changed the veil on several
trees and was not taken.

**Test.** `src/app/anim/actorScale.test.ts` holds every G1 unit and resident sheet to nearest sampling at N = 1-4 through
the same ratio both backends compute (device px a tile over the sheet's px a tile, times the figure's scale), and the old
1.25 to smoothing; and every other adult level with the G1 adults.

## The JavaScript budget: 380 KB gzipped

**Owner decision, 2026-10-28:** the gate in `scripts/check-bundle-size.mjs` rises from 360 KB to 380 KB gzipped
(amends ADR 0074). After #301 merged, main measured 11 bytes under 360 KB (the residents' credit was folded into the
party's and a guard's message shortened to fit), so any further feature would have failed the gate. The measurement is
unchanged: the gzip size of every shipped `.js` file under `dist/`, all chunks included. This change does not spend the
headroom; the figure scale adds no bytes of note.

## Consequences

- Figures are crisp at every integer zoom on both backends, one grain with the world.
- Figures are 20% smaller on oblique boards than before: about 0.9 of a tile tall. Props, houses and the painting are
  unchanged, so a figure now reads at the world's own proportion (a door, a table; the review captures show both).
- The walk's foot slide (ADR 0067, ADR 0091) is unchanged in kind; its measured ratios move by the scale. The pace and
  stride decision ("jog animation", owner, 2026-10-28) is its own change.

## Amendment: back to 1.25 (owner, 2026-10-28)

**Jared, 2026-10-28, after watching the jog captures at 1.0:** the characters look tiny — "the doors look massive…
they're tiny compared to the items around the world." His decision: **"1.25× now, redraw later."**

The Ba Dan painting and the forest were built round adults drawn at 1.25, about 74 world px; at 1.0 a G1 adult stands
55-61 px, under a door's height. Crisp but undersized lost to soft but in proportion.

- **`OBLIQUE_FIGURE_SCALE = 1.25`** again. `OBLIQUE_LEGACY_ADULT` is still `OBLIQUE_FIGURE_SCALE / 1.25`, so it returns
  to 1 and the legacy adults (the crossbowman, the cutting figures, Hanru) draw at their own sizes, level with the G1
  adults as before this ADR. Everything derived follows the constant: sockets, attachments, markers, picking and hit
  boxes, the veil's probes (`baDanDepth.test.ts` sweeps 1.25, 1.4 and 1.5 again).
- **The figures are smoothed by choice.** 1.25 puts 1.25, 2.5, 3.75 or 5 device px on an art px, so every integer zoom
  but N = 4 resamples them soft beside the nearest-sampled painting. `actorScale.test.ts` now states that: the G1 sheets
  are smoothed at N = 1-3 and nearest at N = 4 at 1.25, and nearest at every N at 1, the redraw's target grain.
- **The jog stays planted** (ADR 0095). The jog's clip time a tile is fitted to its art at one art px a world px;
  `Animator.walkClipTime` now divides it by `partyScale(projection)`, so a figure drawn at 1.25 covers 1.25 times the
  ground a loop and its planted foot stays planted, derived from this constant rather than a second number. It also
  slows the cadence 1.25 times.
- **The JavaScript budget stays 380 KB.**

**Plan: a native redraw at about 74 px.** Redrawing the twelve G1 families at about 74 world px tall (roots, idles,
walks, jogs, hits, knockouts, bends, at one art px a world px) would make them crisp again at the world's proportion. It
is estimated at 1,500-2,000 PixelLab generations and waits on the plan upgrade.
