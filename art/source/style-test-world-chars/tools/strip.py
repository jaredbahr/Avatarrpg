"""Review helper: root + cels of a raw take on a ground colour, Nx nearest. usage: strip.py RAWDIR ROOT OUT [k]"""
import sys
from pathlib import Path
from PIL import Image
raw, root, out = Path(sys.argv[1]), sys.argv[2], sys.argv[3]; k = int(sys.argv[4]) if len(sys.argv) > 4 else 3
ims = [Image.open(root).convert('RGBA')] + [Image.open(p).convert('RGBA') for p in sorted(raw.glob('*.png'))]
sh = Image.new('RGBA', (96 * len(ims), 100), (150, 135, 110, 255))
for i, im in enumerate(ims):
    sh.alpha_composite(im.crop((16, 24, 112, 124)), (i * 96, 0))
sh.resize((sh.width * k, sh.height * k), Image.NEAREST).save(out)
