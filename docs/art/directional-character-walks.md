# Directional character walks

The ten playable heroes have front (south) and back (north) standing and walking
poses matched to their existing character references. These are 2D sprite
atlases, used by the existing animation system.

| Asset                       | Location                                                  |
| --------------------------- | --------------------------------------------------------- |
| Hero PNG and frame metadata | `public/art/units/locomotion-{name}.{png,json}`           |
| Riverside Kaya and Sura     | `public/art/units/riverside-locomotion-{name}.{png,json}` |
| Importer                    | `scripts/art/directional-motion.ts`                       |
| Rendering contract          | `docs/adr/0018-directional-character-locomotion.md`       |

Names are `kaya`, `tenzo`, `nilak`, `sura`, `bo`, `linmei`, `nima`, `jinu`, `riko`,
and `wen`. Existing atlases are retained as source references. The new atlases
include the original poses unchanged; they are safe replacements through the
manifest without changing actor size, navigation, collision, or saved games.

Each transparent source is a 5×2 grid: south on the first row, north on the
second; standing idle followed by four walk drawings. The source prompt asks
for preserved identity, costume and proportions, counter-swinging arms,
alternating foot contacts, quiet torso motion, clear gutters, and no ground
shadows, labels, or elemental effects. Sources were generated with the built-in
OpenAI image tool, as with the existing hero art. Raw sources live in ignored
`art/raw/directional/`; processed atlases are the shipped assets.

```bash
node --import tsx scripts/art/directional-motion.ts kaya art/raw/directional/kaya.png
npm run art:validate
```

One source scale per character and the original foot anchor keep turns stable.
North/south frame sets must not be mirrored: Wen's gauntlet, hair, sashes and
belts must remain on the same anatomical side. Matching the existing stylized
art takes priority over adding costume details.

Dedicated side walk art for the other eight heroes and north/south combat casts
are not part of this delivery. Their existing fallback/action poses remain in
use. A later animation pass can replace individual drawings using the same
frame names and dimensions.
