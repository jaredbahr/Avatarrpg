import json, sys
sys.path.insert(0, 'tools'); import pl
S = json.load(open('style.json'))
TS = 16
def tileset(name, lower, upper, trans='', transition_size=0.0, mode='standard', extra=None, ts=None):
    global TS
    if ts: TS = ts
    body = {'lower_description': lower, 'upper_description': upper, 'transition_description': trans,
            'tile_size': {'width': TS, 'height': TS}, 'mode': mode, 'view': S['view'], 'shading': S['shading'],
            'detail': S['detail'], 'transition_size': transition_size, 'seed': 7}
    if mode == 'standard': body['shape_style'] = 'round'
    body.update(extra or {})
    e, r = pl.run('/create-tileset', body, name, estimate=10)
    return e, r
if __name__ == '__main__':
    e, r = tileset(*sys.argv[1:4])
    print(json.dumps(pl.strip(r['final']))[:1200])
