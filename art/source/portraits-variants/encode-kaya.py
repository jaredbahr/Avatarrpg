"""Encode on the neutral's 256-color palette; retain unchanged pixel indices."""
from pathlib import Path
from PIL import Image

neutral = Image.open('public/art/portraits/kaya.png')
assert neutral.mode == 'P' and neutral.size == (512, 512)
base_rgb = list(neutral.convert('RGB').getdata())
base_indices = list(neutral.getdata())
for mood in ('angry', 'worried', 'warm'):
    source = Image.open(f'art/raw/portraits-variants/face-only/kaya-{mood}.png').convert('RGB')
    packed = source.quantize(palette=neutral, dither=Image.Dither.NONE)
    encoded = list(packed.getdata())
    # Pillow's palette lookup may round near-identical colors. Reuse the exact
    # source index whenever the compositor left a pixel unchanged.
    for i, color in enumerate(source.getdata()):
        if color == base_rgb[i]:
            encoded[i] = base_indices[i]
    packed.putdata(encoded)
    target = Path(f'public/art/portraits/expressions/{mood}/kaya.png')
    target.parent.mkdir(parents=True, exist_ok=True)
    packed.save(target, optimize=True, compress_level=9)
    print(target, target.stat().st_size)
