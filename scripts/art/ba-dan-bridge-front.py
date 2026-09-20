"""Build the near-bank occlusion layer for the Ba Dan bridge.

The original packed bridge remains the deck/back layer.  This mask copies the
near-side half into a second transparent WebP so a walker can render between
the deck and its front rail.  Pillow is only a build-time art helper; it is not
part of the shipped application.

    python scripts/art/ba-dan-bridge-front.py
"""

from pathlib import Path

from PIL import Image


ROOT = Path("public/art/maps/ba-dan-scene")
SOURCE = ROOT / "canal-bridge.webp"
OUTPUT = ROOT / "canal-bridge-front.webp"


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    front = Image.new("RGBA", source.size, (0, 0, 0, 0))
    source_pixels = source.load()
    front_pixels = front.load()
    for y in range(source.height):
        for x in range(source.width):
            # The near bank runs down/right from the deck's long axis. Keep
            # that bank above the walker while the original sprite supplies
            # the deck, far rail and back stones beneath it.
            if y - 0.5 * x >= 55:
                front_pixels[x, y] = source_pixels[x, y]
    front.save(OUTPUT, format="WEBP", quality=82, method=6)


if __name__ == "__main__":
    main()
