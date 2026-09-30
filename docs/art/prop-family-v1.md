# Combat prop family v1

The six shipped combat props are one supervisor-selected PixelLab family for the approved environment direction: grouped shapes, selective brown outlines, muted natural earth tones, warm upper-left light, and the same elevated three-quarter view as the modular village and quarry art. The untouched `crate.png` and `timber.png` remain source candidates only.

## Provenance

- Generator: PixelLab
- Review object IDs: `20022670-d9a1-43b1-9ae2-61df2761742e`, `ddeae94e-9b09-4082-b9b9-8ab491dad34a`
- Review tag: `prop-family-v1`
- Selected: 2026-09-30
- Terms: https://pixellab.ai/termsofservice
- Source directory: `media/art-sources/prop-family-v1/`

Shared prompt description:

> game prop for a painted [setting name omitted: the repo never names the franchise] village and quarry, warm upper-left sunlight, soft painterly shading, brown selective outline, muted natural earth tones, viewed from a 2:1 isometric three-quarter top-down camera, grounded with a small contact shadow at its base, transparent background

Per-item prompt lines:

- `barrel.png`: open water barrel
- `cart.png`: cabbage hand cart
- `brazier.png`: brazier with coals
- `rubble.png`: tall quarry rubble heap
- `flask.png`: oil flask
- `hay.png`: hay bale
- `crate.png`: wooden crate (source only; not shipped)
- `timber.png`: stacked timber (source only; not shipped)

## Packing and registration

Run `npm run art:prop-family`. The family wrapper sends only the six shipped names through `scripts/art/prop.ts`; it does not copy the source-only crate or timber. The existing packer alpha-trims each source, enlarges it 4× with nearest-neighbour and then box-filters it down into its authored per-prop bounds (a non-integer effective scale of about 1.7–1.9×, which softens pixel-cluster edges by about a pixel), centers it in a transparent 256×256 frame, and registers its foot at the shared 85% baseline. The cart retains its wheel-contact correction because its forward shafts extend below the wheels.

At the renderer's 128-world-pixel tile scale, the packed visible heights are intended to be: barrel 87 px (0.58 of a 151 px G adult), cart 84.5 px (0.56), brazier 79.5 px (0.53), rubble 71.5 px (0.47), flask 51 px (0.34), and hay 61.5 px (0.41). Final integer alpha bounds are reported from the generated PNGs after packing.
