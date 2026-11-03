"""Writes the bend flash test fixtures (`src/render/fx/bendFlash.*.png`): Pillow's own
`ImageEnhance.Brightness(1.75)` on two shipped cels of the G1 page, alpha kept.

Run from the repo root:  python3 -I art/source/fx-g1/tools/flash_fixture.py   (Pillow 12.3.0)
"""
import json
from PIL import Image, ImageEnhance

page = json.load(open('public/art/fx/bend-fx.json'))
atlas = Image.open('public/art/fx/bend-fx.webp').convert('RGBA')
for name, out in [('fx.fire.fireball/jab-launch/0', 'bendFlash.jab-launch.png'),
                  ('fx.water.bolt/splash/0', 'bendFlash.splash.png')]:
    f = page['frames'][name]['frame']
    cel = atlas.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h']))
    r, g, b, a = cel.split()
    rgb = ImageEnhance.Brightness(Image.merge('RGB', (r, g, b))).enhance(1.75)
    Image.merge('RGBA', (*rgb.split(), a)).save('src/render/fx/' + out)
