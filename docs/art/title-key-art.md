# Title screen key art

Three paintings, generated with the built-in OpenAI image-generation tool on
3 October 2026. The title screen rotates through them. Output terms checked at
https://openai.com/policies/terms-of-use/ (Content: ownership of output); no
exclusive copyright is claimed. Original noncommercial project art, no baked
lettering, no emblems, no third-party names or symbols.

All three were generated from the same five strict identity and costume
references (the approved dialogue portraits) and share these constraints:
original fantasy tactical-RPG title art, 16:9; all five people and the heavy
mechanical gauntlet preserved; the essential scene kept inside a centred 4:3
crop; a quiet zone reserved for the plate; hard-edged painted clusters with
selective deep brown-black contour; one warm upper-left key light; contact
darkening only; no text, logos, emblems, watermark or interface.

The owner reviewed all three candidates and asked for the title to rotate
between them.

## The paintings

### A: the Forest Road at golden hour

The party stands on the Forest Road at golden hour, seen from behind and in
three-quarter profile, looking along a winding woodland causeway toward a
distant pale limestone quarry and a small timber crane. The party fills the
right third and lower right; the sun, sky and dark pines hold the left. Warm
ochre road, muted olive and pine, pale limestone, restrained sunset amber. The
plate sits on the left, over the sky and forest.

### B: the Ba Dan market at dusk

The party arrives at the Ba Dan market at dusk: a stone-paved square with a
pond edge, timber-and-stone shops, a striped awning, fruit baskets, tea tables,
warm windows, plain cloth banners, villagers finishing work, and the quarry
ridge beyond the roofs. The party enters from lower left; a dark building fills
the right. Deep pine and teal roofs, warm limestone and ochre paving, muted
market reds, amber windows, indigo dusk. The plate sits on the right, over the
building.

### C: the bridge to the quarry at dawn

At dawn the party crosses a weathered stone-and-timber bridge above a narrow
turquoise stream, with pines opening onto a pale quarry gate and terraced stone
face. The group is compact in the lower-right middle distance, in a slightly
elevated oblique view that echoes the game camera; the left is calm sky and
distant trees. Crisp pixel-painted look; limestone cream, moss and pine, muted
turquoise, worn ochre timber, restrained coral dawn light. The plate sits on
the left. The gate and cranes are thematic, not a literal map view.

## Mechanical steps

`scripts/art/title-art.ts <a|b|c> <source.png>` (box-filter downscale and lossy
WebP encode only; nothing is repainted). For each painting:

1. `title-<id>-wide.webp`: the 1920x1080 painting scaled to 1600x900, quality 82.
2. `title-<id>-portrait.webp`: a full-height crop of the same painting, scaled
   to its output size at quality 82, for phones held upright. The cut keeps the
   party:
   - A: x 948 to 1920 (972x1080) scaled to 810x900: the right-hand four of the
     party and the road. The fifth is cut by the crop; the landscape file shows
     all five.
   - B: x 60 to 1032 (972x1080) scaled to 810x900: all five of the party, the
     market and the pond.
   - C: x 1080 to 1920 (840x1080) scaled to 700x900: the party and the gate.

The lossless source PNGs are not in this repository. The shipped outputs are
hash-pinned: `scripts/art/title-art.test.ts` pins each file's size and SHA-256,
and holds the packer's declared sizes and file names to the scene's. The
downscale and encode were done from the generator masters, which are kept
outside the repository (the supervisor's art store). The packer is therefore
documentation of the method, not something that can be re-run from the
repository to reproduce the files.

| File                    | Pixels   | Bytes   |
| ----------------------- | -------- | ------- |
| `title-a-wide.webp`     | 1600x900 | 271,146 |
| `title-a-portrait.webp` | 810x900  | 143,618 |
| `title-b-wide.webp`     | 1600x900 | 230,738 |
| `title-b-portrait.webp` | 810x900  | 156,496 |
| `title-c-wide.webp`     | 1600x900 | 304,832 |
| `title-c-portrait.webp` | 700x900  | 145,634 |

The `art/title` family is 1,252,464 bytes in total (budget: 4 MiB per family);
each wide file is under the 350 KB precache limit the test enforces.

## Use

`src/app/titleArt.ts` holds each painting's framing: the side the plate sits on
(A left, B right, C left), the cover-fit focal point of the landscape file
(A 100% 50%, B 12% 50%, C 85% 50%, so the party stays in frame at 16:9 and 4:3)
and the focal point of the portrait crop. Below a 9:10 aspect ratio the plate
is centred at the top whichever side the painting prefers, and the portrait
crop sits under it.

The scene (`TitleArtRotator`) is decoration: hidden from assistive tech, no alt
text. The title is live text from `src/app/gameTitle.ts`, never part of the
image.

- **Per visit.** Each visit to the title picks a painting at random, never the
  one shown last. The last one is remembered per device under the
  `fnt.titleArt` key in localStorage, read and written inside try/catch (a
  blocked or full store only means the next pick may repeat).
- **Idle rotation.** While the title sits idle it cross-fades to a different
  painting every 12 seconds; the fade is `--dur-title-fade` (1.5 s). When the
  next painting sits on the other side, the plate fades out as the cross-fade
  starts and back in on the new side halfway through, so it never slides. A
  hidden tab skips the tick.
- **Preloading.** First paint loads one painting. Once it has landed, only the
  next one is fetched into the layer behind it; after each fade the layer that
  went out takes the painting after that.
- **Reduce motion** (the setting or the OS preference): the per-visit pick
  stays, nothing cross-fades, and the next painting is never fetched.
- **Test hooks.** `?titleArt=a|b|c` forces the first painting and
  `?titleArtHold=<ms>` sets the idle time (`0` stops the rotation; values under
  3000 are ignored and the 12 s default applies). The gallery's
  `01-title` beat uses both so its captures are deterministic.

## Plate contrast

The plate is `--c-ink` at 82% over the painting. Against pure white behind it
(the worst case any painting could present) the blend is about #51463f, which
holds the title and fine print (`--c-paper-light`) at 9.0:1 and the tagline
and muted lines (`--c-air`) at 6.7:1, both over 4.5:1; against the brightest
sky in the paintings (a pale gold) it is better. High contrast makes the plate
opaque. The buttons keep their own fills. The gallery captures under
`.review/ship/after2/` show it over all three paintings.
