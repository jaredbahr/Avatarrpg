"""v12b: install the PixelLab bridge (seed 33, cropped to its bbox, v12/bridge_pl.png) as assets/objects12/bridge.png and fix its manifest size."""
import json, shutil
from pathlib import Path
from PIL import Image
H = Path(__file__).resolve().parent.parent
shutil.copy(H / 'v12' / 'bridge_pl.png', H / 'assets' / 'objects12' / 'bridge.png')
m = json.load(open(H / 'assets' / 'objects12' / 'manifest.json')); w, h = Image.open(H / 'v12' / 'bridge_pl.png').size
m['bridge'] = {'w': w, 'h': h, 'src': 'v12/bridge_seed33.png (v12b: PixelLab create-object-pro-flash, low top-down, oven as reference)'}
json.dump(m, open(H / 'assets' / 'objects12' / 'manifest.json', 'w'), indent=1)
