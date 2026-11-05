import sys, json; sys.path.insert(0, 'tools'); import pl
from PIL import Image
src = Image.open('assets/chars/kaya2/rot_south.png').convert('RGBA')   # v2 Kaya, 48x48
canvas = Image.new('RGBA', (64, 64)); canvas.alpha_composite(src, (8, 8)); canvas.save('work/v5/south64.png')
BASE = ('Redraw this exact character at this exact size, position and facing, as clean pixel art in the identical style, palette, outline weight and shading. '
        'Same teenage girl, same face and skin, same brown high ponytail tied with a red ribbon, same dark red and crimson colours. '
        'Give her a slimmer, more feminine teen silhouette: a narrower waist and hips, softer sloping shoulders, slimmer legs, a slightly narrower stance with the feet closer together. '
        'She must be no wider than the original anywhere, and noticeably narrower at the hips. ')
V = {
 'A': 'Outfit: a fitted dark red coat cinched tightly at the waist by a red cloth sash, ending just below the hips with two short tails at the back, so no skirt flare; slim dark trousers; brown boots.',
 'B': 'Outfit: a slim knee-length dark red coat fitted to the body and cinched at the waist by a red sash, split by long front slits so the slim dark trousers show between the panels, the panels hang straight and narrow, never flaring; brown boots.',
 'C': 'Outfit: a short cropped dark red jacket ending at the waist, over a slim fitted crimson tunic that reaches mid-thigh, a red sash at the waist, slim dark trousers and brown boots.',
}
k = sys.argv[1]
e, r = pl.run('/edit-image-pro-flash', {'image': pl.b64(canvas), 'method': 'text', 'description': BASE + V[k], 'no_background': True, 'seed': 7}, f'v5_edit_{k}', estimate=8)
lr = r['final'].get('last_response') or r['final']; ims = []; pl.images(lr, ims)
if not ims:
    for kk in ('image_url', 'url'):
        if lr.get(kk): ims.append(pl.fetch(lr[kk]))
ims[0].save(f'work/v5/edit_{k}.png'); print(k, ims[0].size, e['credits'])
