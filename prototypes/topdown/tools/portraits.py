"""Dialogue portraits: the shipped game's painted busts (read-only originals in Avatarrpg/public/art/portraits/), smooth-downscaled once
to 160 px (shown at 5.25 rem, so 2x dpr is crisp) and written as webp to assets/portraits/. Grumbler's bust is an RGBA machine and is
laid on the busts' cream. Run from the topdown folder."""
from pathlib import Path
from PIL import Image
SRC = Path('/home/user/Avatarrpg/public/art/portraits'); OUT = Path(__file__).resolve().parent.parent / 'assets' / 'portraits'
OUT.mkdir(parents=True, exist_ok=True)
for f in sorted(SRC.iterdir()):
    im = Image.open(f).convert('RGBA')
    bg = Image.new('RGBA', im.size, (240, 228, 206, 255)); bg.alpha_composite(im)
    bg.convert('RGB').resize((160, 160), Image.LANCZOS).save(OUT / (f.name.rsplit('.', 1)[0] + '.webp'), 'WEBP', quality=84, method=6)
print(sorted(p.name for p in OUT.iterdir()), sum(p.stat().st_size for p in OUT.iterdir()) // 1024, 'KiB')
