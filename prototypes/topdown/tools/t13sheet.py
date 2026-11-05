"""Contact sheet: t13sheet.py out.png scale img1 img2 ... (each on a cream/ground swatch, side by side)"""
import sys
from PIL import Image
s = int(sys.argv[2]); ims = [Image.open(p).convert('RGBA') for p in sys.argv[3:]]
W = sum(i.width for i in ims) + 4 * len(ims); H = max(i.height for i in ims) + 4
out = Image.new('RGBA', (W, H), (120, 112, 96, 255)); x = 2
for i in ims: out.alpha_composite(i, (x, 2)); x += i.width + 4
out.resize((W * s, H * s), Image.NEAREST).save(sys.argv[1])
