import json, sys
sys.path.insert(0, 'tools'); import pl
from sheet import sheet
DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
def get(name, cid):
    d = pl.req('GET', f'/characters/{cid}')
    json.dump(pl.strip(d), open(pl.RAW / name / 'character.json', 'w'), indent=1)
    ims = []
    for k in DIRS:
        u = (d.get('rotation_urls') or {}).get(k)
        if u: im = pl.fetch(u); im.save(pl.RAW / name / f'rot_{k}.png'); ims.append(im)
    return d, ims
if __name__ == '__main__':
    rows = []
    for name in sys.argv[2:]:
        e = pl.cached(name); r = json.load(open(pl.RAW / name / 'response.json'))
        cid = r['final'].get('last_response', {}).get('character_id') or r['post'].get('character_id')
        d, ims = get(name, cid); print(name, cid, ims[0].size, [im.getbbox() for im in ims][:3]); rows.append(ims)
    sheet(rows, 4).save(sys.argv[1])
