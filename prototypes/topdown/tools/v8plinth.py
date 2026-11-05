import sys, json; sys.path.insert(0, 'tools'); import pl
from PIL import Image
k = sys.argv[1]
src = Image.open(f'assets/objects2/{k}.png').convert('RGBA')
W = (src.width + 12 + 3) // 4 * 4; H = (src.height + 12 + 3) // 4 * 4
can = Image.new('RGBA', (W, H)); can.alpha_composite(src, ((W - src.width) // 2, H - src.height - 4)); can.save(f'v8/edits/{k}_in.png')
D = ('Edit this building so it stands on a cobbled village street. Remove all the grass, lawn, bushes and flowers around its base. '
     'Give it a low grey stone foundation plinth, 2 to 4 pixels wider than the walls, running along the whole bottom of the front wall, '
     'and a short stone doorstep in front of the door that sits on the street. Nothing else around it. '
     'Keep the building itself exactly the same: same roof, walls, timber, windows, door, chimney, colours, pixel size, outline and shading. Light from the upper left.')
e, r = pl.run('/edit-image-pro-flash', {'image': pl.b64(can), 'method': 'text', 'description': D, 'no_background': True, 'seed': 7}, f'v8_plinth_{k}', estimate=10)
lr = r['final'].get('last_response') or r['final']; ims = []; pl.images(lr, ims)
if not ims and lr.get('image_url'): ims = [pl.fetch(lr['image_url'])]
ims[0].save(f'v8/edits/{k}_plinth.png'); print(k, ims[0].size, e['credits'])
