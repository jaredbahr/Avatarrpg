import sys, glob
from PIL import Image
fs = sys.argv[2:]; ims = [Image.open(f).convert('RGBA') for f in fs]
W = sum(i.width for i in ims) + 10 * (len(ims) + 1); H = max(i.height for i in ims) + 20
s = Image.new('RGBA', (W, H), (110, 150, 90, 255)); x = 10
for i in ims: s.alpha_composite(i, (x, H - 10 - i.height)); x += i.width + 10
k = int(__import__('os').environ.get('Z', 2)); s.resize((s.width * k, s.height * k), Image.NEAREST).save(sys.argv[1])
