"""Probe: one 512 px tile of the composite (road, grass, pond) under two ground prompts."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from PIL import Image
from pl import RA, run, b64
from style import STYLE, KEEP, GROUND, GROUND_BADAN
BOX = (700, 300, 1212, 812)
src = Image.open(f'{RA}/composite.png').convert('RGBA')
bg = Image.new('RGBA', src.size, (70, 91, 64, 255))
crop = Image.alpha_composite(bg, src).convert('RGB').crop(BOX)
crop.save(f'{RA}/probe-in.png')
img, h = b64(crop)
for name, g in (('badan', GROUND_BADAN), ('living', GROUND)):
    prompt = 'Redraw as ' + STYLE + '. ' + g + ' ' + KEEP
    run('/edit-images-v2', {'method': 'edit_with_text', 'edit_images': [{'image': img, 'width': 512, 'height': 512}],
        'image_size': {'width': 512, 'height': 512}, 'description': prompt, 'seed': 11},
        f'probe-{name}', {h: 'probe-in.png (composite 700,300 512x512)'}, f'ground prompt probe: {name}')
