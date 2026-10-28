"""Paste each chosen inpaint crop back into its shipped portrait: compose.py  ->  out/<char>.<mood>.png (512, RGB).
Only the masked pixels change (the crop's own pixels elsewhere are the shipped ones, so pasting the crop is exact)."""
import json
from pathlib import Path
from PIL import Image
HERE = Path(__file__).resolve().parent.parent; ROOT = HERE.parents[2]
cast = json.load(open(HERE / 'tools' / 'cast.json')); picks = json.load(open(HERE / 'picks.json'))
(HERE / 'out').mkdir(exist_ok=True)
for key, job in picks.items():
    char, mood = key.split('.')
    c = cast[char]; x0, y0, n = c['moods'][mood]['crop']
    full = Image.open(ROOT / 'public/art/portraits' / c['file']).convert('RGB')
    crop = Image.open(HERE / 'raw' / job / '00.png').convert('RGB')
    assert crop.size == (n, n), (key, crop.size)
    full.paste(crop, (x0, y0)); full.save(HERE / 'out' / f'{char}.{mood}.png'); print(key, '<-', job)
