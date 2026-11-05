import json, sys
sys.path.insert(0, 'tools'); import pl
S = json.load(open('style.json'))
def mapobj(name, desc, w, h, extra=None, estimate=30):
    body = {'description': desc + ', ' + S['style_suffix'], 'image_size': {'width': w, 'height': h}, 'view': S['view'],
            'outline': S['outline'], 'shading': S['shading'], 'detail': S['detail'], 'color_image': pl.b64(S['palette_png']), 'seed': 5}
    body.update(extra or {})
    e, r = pl.run('/map-objects', body, name, estimate=estimate)
    out = pl.HERE / 'raw' / name
    ims = pl.save_images(name, r['final'])
    return e, r, ims
if __name__ == '__main__':
    e, r, ims = mapobj(sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]))
    print(json.dumps(pl.strip(r['final']))[:800]); print([i.size for i in ims])
