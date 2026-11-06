import json, sys
sys.path.insert(0, 'tools'); import pl
S = json.load(open('style.json'))
KAYA = ('teenage girl fire-bender, brown hair in a high ponytail tied with a red ribbon, long dark red coat to the knees with a red cloth '
        'sash at the waist, dark brown trousers, brown leather boots, tan skin, determined face')
which = sys.argv[1]
if which == 'std':
    e, r = pl.run('/create-character-with-8-directions', {
        'description': KAYA, 'image_size': {'width': 48, 'height': 48}, 'mode': 'standard',
        'outline': S['character_outline'], 'shading': S['shading'], 'detail': S['detail'], 'view': S['view'],
        'color_image': pl.b64('assets/palette.png'), 'force_colors': False, 'template_id': 'mannequin', 'seed': 11},
        'kaya_std48', estimate=2)
else:
    e, r = pl.run('/create-character-v3', {
        'description': KAYA, 'image_size': {'width': int(which), 'height': int(which)}, 'view': S['view'],
        'outline': S['character_outline'], 'detail': S['detail'], 'template_id': 'mannequin', 'seed': 11},
        f'kaya_v3_{which}', estimate=4)
print(json.dumps(pl.strip(r['final']))[:1500])
