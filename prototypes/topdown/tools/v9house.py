import sys, json; sys.path.insert(0, 'tools'); import pl
from PIL import Image
k, f = sys.argv[1], float(sys.argv[2]) if len(sys.argv) > 2 else 1.4
src = Image.open(f'assets/objects8/{k}.png').convert('RGBA')
big = src.resize((round(src.width * f), round(src.height * f)), Image.LANCZOS)
W = min(256, (big.width + 8 + 3) // 4 * 4); H = min(256, (big.height + 4 + 3) // 4 * 4)
can = Image.new('RGBA', (W, H)); can.alpha_composite(big, ((W - big.width) // 2, H - big.height)); can.save(f'v9/edits/{k}_in.png')
D = ('This village house was enlarged and is blurry. Redraw it as crisp, clean pixel art at this size: one-pixel dark outlines, '
     'sharp single-pixel detail on the roof tiles, timber, windows and door, the same flat colours, no blur and no anti-aliasing. '
     'Keep the exact same design, colours, proportions, stone plinth, doorstep and the same low top-down 3/4 front view. '
     'Light from the upper left. Nothing around it, no ground, no shadow.')
e, r = pl.run('/edit-image-pro-flash', {'image': pl.b64(can), 'method': 'text', 'description': D, 'no_background': True, 'seed': 11}, f'v9_house_{k}', estimate=10)
lr = r['final'].get('last_response') or r['final']; ims = []; pl.images(lr, ims)
if not ims and lr.get('image_url'): ims = [pl.fetch(lr['image_url'])]
ims[0].save(f'v9/edits/{k}_big.png'); print(k, ims[0].size, e['credits'])
