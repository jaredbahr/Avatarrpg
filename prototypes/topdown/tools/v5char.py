import sys, json; sys.path.insert(0, 'tools'); import pl
from PIL import Image
D = {'A': 'teenage girl fire-bender, brown high ponytail with a red ribbon, fitted dark red coat cinched at the waist by a red sash with two short back tails, slim dark trousers, brown boots',
     'B': 'teenage girl fire-bender, brown high ponytail with a red ribbon, slim knee-length dark red coat cinched by a red sash with long front slits, slim dark trousers, brown boots',
     'C': 'teenage girl fire-bender, brown high ponytail with a red ribbon, cropped dark red jacket over a slim crimson tunic, red sash, slim dark trousers, brown boots'}
k = sys.argv[1]
ref = Image.open(f'work/v5/edit_{k}.png').convert('RGBA').crop((8, 8, 56, 56)); ref.save(f'work/v5/ref_{k}.png')
e, r = pl.run('/create-character-v3', {'description': D[k], 'reference_image': pl.b64(ref), 'image_size': {'width': 48, 'height': 48},
              'view': 'low top-down', 'template_id': 'mannequin', 'seed': 11, 'name': f'Kaya v5 {k}'}, f'v5_char_{k}', estimate=3)
print(k, r['final']['last_response']['character_id'], e['credits'])
