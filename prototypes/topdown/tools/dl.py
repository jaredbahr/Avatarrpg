"""Download a character's rotations and every animation's frames into assets/chars/<label>/."""
import json, re, sys
from pathlib import Path
sys.path.insert(0, 'tools'); import pl
from sheet import sheet
def download(label, cid):
    d = pl.req('GET', f'/characters/{cid}')
    out = pl.HERE / 'assets' / 'chars' / label; out.mkdir(parents=True, exist_ok=True)
    meta = {'id': cid, 'size': d['size'], 'rot': {}, 'anims': {}}
    for k, u in d['rotation_urls'].items():
        pl.fetch(u).save(out / f'rot_{k}.png'); meta['rot'][k] = f'rot_{k}.png'
    for a in d.get('animations') or []:
        t = a['animation_type'] + '@' + a['animation_group_id'][:6]
        for dd in a['directions']:
            fs = []
            for i, u in enumerate(dd['frames']):
                f = re.sub(r'[^A-Za-z0-9._-]+', '_', f'{t}_{dd["direction"]}_{i}.png')   # filename-safe (safenames.py); pl.fetch(u).save(out / f); fs.append(f)
            meta['anims'].setdefault(t, {})[dd['direction']] = fs
    json.dump(meta, open(out / 'meta.json', 'w'), indent=1)
    return out, meta
if __name__ == '__main__':
    from PIL import Image
    out, meta = download(sys.argv[1], sys.argv[2])
    rows = []
    for t, dirs in meta['anims'].items():
        for k, fs in dirs.items(): rows.append([Image.open(out / f) for f in fs]); print(t, k, len(fs), rows[-1][0].size)
    if rows: sheet(rows, 4).save(f'work/{sys.argv[1]}_anims.png')
