"""Build the near-bank occlusion layer for the Ba Dan bridge.

The original packed bridge remains the deck/back layer.  This mask copies the
near-side half into a second transparent WebP so a walker can render between
the deck and its front rail.  Pillow is only a build-time art helper; it is not
part of the shipped application.

The cut is a line in the texture's own proportions, so it holds for any pixel
size the bridge ships at (the restyle ships it nearest-upscaled, and a
lossless file keeps the pixel grain the deck has).

    python scripts/art/ba-dan-bridge-front.py
"""

from pathlib import Path

from PIL import Image


ROOT = Path("public/art/maps/ba-dan-scene")
SOURCE = ROOT / "canal-bridge.webp"
OUTPUT = ROOT / "canal-bridge-front.webp"

# The cut was measured on the 512 x 323 bridge: y - 0.5 x >= 55 there.
REFERENCE = (512, 323)
CUT = 55


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    front = Image.new("RGBA", source.size, (0, 0, 0, 0))
    source_pixels = source.load()
    front_pixels = front.load()
    sx = REFERENCE[0] / source.width
    sy = REFERENCE[1] / source.height
    for y in range(source.height):
        for x in range(source.width):
            # The near bank runs down/right from the deck's long axis. Keep
            # that bank above the walker while the original sprite supplies
            # the deck, far rail and back stones beneath it.
            if y * sy - 0.5 * x * sx >= CUT:
                front_pixels[x, y] = source_pixels[x, y]
    front.save(OUTPUT, format="WEBP", lossless=True, exact=True, method=6)


if __name__ == "__main__":
    main()
