"""Curation sheet: per name, each heading's reduced shipped cel (b/) over the candidates of every root job, at 3x.
usage (repo root): python3 -I art/source/residents-g1/tools/rootsheet.py NAME [KIND] > writes review/curate/<name>-<kind>.png"""
import sys, json
from pathlib import Path
from PIL import Image, ImageDraw
HERE = Path(__file__).resolve().parent.parent
name = sys.argv[1]; kind = sys.argv[2] if len(sys.argv) > 2 else 'idle'
DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
cols = DIRS if kind == 'idle' else ['0', '1', '2']
S = 3; fw = json.load(open(HERE / 'tools/chars.json'))[name]['frame_w']
rows = []
for c in cols:
    src = HERE / (f'b/{name}/idle/{c}/00.png' if kind == 'idle' else f'b/{name}/cast/east/0{c}.png')
    tag = 'idle' if kind == 'idle' else f'cast{c}'; d = c if kind == 'idle' else 'east'
    col = [('ship', Image.open(src))]
    for job in sorted((HERE / 'raw').glob(f'root-{tag}-{name}-{d}-s*')):
        for f in sorted(job.glob('*.png')):
            if f.name == '01.png': continue   # 00 and 01 come back byte-identical
            col.append((f'{job.name.split("-s")[-1]}/{f.stem}', Image.open(f)))
    rows.append((c, col))
n = max(len(col) for _, col in rows)
sh = Image.new('RGBA', (len(rows) * (fw * S + 6), n * (96 * S + 14)), (110, 130, 110, 255)); dr = ImageDraw.Draw(sh)
for i, (c, col) in enumerate(rows):
    for j, (lab, im) in enumerate(col):
        x, y = i * (fw * S + 6), j * (96 * S + 14)
        sh.alpha_composite(im.convert('RGBA').resize((im.width * S, im.height * S), Image.NEAREST), (x, y + 12)); dr.text((x + 2, y), f'{c[:5]} {lab}', fill=(255, 255, 255))
out = HERE / f'review/curate/{name}-{kind}.png'; out.parent.mkdir(parents=True, exist_ok=True); sh.save(out); print(out)
