"""Filename hygiene: rename every file whose name has characters outside [A-Za-z0-9._-] (spaces, ':', ',', '@'...)
so the folder checks out on Windows. Runs of bad characters become one '_'. Every meta.json under assets/chars is
rewritten to the new names; its animation KEYS (PixelLab's descriptions) are left alone, since the builds look clips
up by key prefix. Writes hyg/rename-map.json. Idempotent. Usage: python3 tools/safenames.py [--dry]"""
import json, re, sys
from pathlib import Path
H = Path(__file__).resolve().parent.parent
BAD = re.compile(r'[^A-Za-z0-9._-]+')
def safe(n): return BAD.sub('_', n)
dry = '--dry' in sys.argv
ren = {}
for p in sorted(H.rglob('*')):
    if p.is_file() and BAD.search(p.name):
        ren.setdefault(p.parent, {})[p.name] = safe(p.name)
# collisions inside one folder?
for d, m in ren.items():
    have = {x.name for x in d.iterdir()} - set(m)
    new = list(m.values())
    assert len(set(new)) == len(new) and not (set(new) & have), d
n = sum(len(m) for m in ren.values())
if not dry:
    for d, m in ren.items():
        for a, b in m.items(): (d / a).rename(d / b)
    for meta in (H / 'assets' / 'chars').glob('*/meta.json'):
        M = json.load(open(meta)); ch = 0
        for k, dirs in M.get('anims', {}).items():
            for dd, fs in dirs.items():
                nf = [safe(f) for f in fs]; ch += nf != fs; dirs[dd] = nf
        M['rot'] = {k: safe(v) for k, v in M.get('rot', {}).items()}
        json.dump(M, open(meta, 'w'), indent=1)
    (H / 'hyg').mkdir(exist_ok=True)
    json.dump({str(d.relative_to(H)): m for d, m in ren.items()}, open(H / 'hyg' / 'rename-map.json', 'w'), indent=0)
print('renamed' if not dry else 'would rename', n, 'files in', len(ren), 'folders')
left = [p for p in H.rglob('*') if BAD.search(p.name)]
print('names still unsafe:', len(left), [str(p.relative_to(H)) for p in left[:5]])
