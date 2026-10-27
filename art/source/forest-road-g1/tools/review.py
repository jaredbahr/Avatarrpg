"""Before/after review sheets from e2e/forest-g1.review.ts captures -> art/source/forest-road-g1/review/.

python3 art/source/forest-road-g1/tools/review.py [.shots/forest-g1]
Each sheet stacks the `before` frame over the `after` frame (Canvas), labelled; lossy WebP q80 to keep the folder small.
"""
import os, sys
from PIL import Image, ImageDraw

SHOTS = sys.argv[1] if len(sys.argv) > 1 else '.shots/forest-g1'
OUT = 'art/source/forest-road-g1/review'
SHEETS = {
    'fit': 'fit.png',
    'props-96': 'zoom96-props.png',
    'bank-96': 'zoom96-bank.png',
    'pond-96': 'zoom96-pond.png',
    'lodge-96': 'zoom96-lodge.png',
    'creek-96': 'zoom96-creek.png',
    'move-96': 'move-96.png',
    'aim-flask-96': 'aim-flask-96.png',
    'fire-96': 'fire-settled.png',
}


def sheet(name, file, renderer='canvas'):
    ims = [Image.open(f'{SHOTS}/{label}/{renderer}/{file}').convert('RGB') for label in ('before', 'after')]
    w, h = ims[0].size
    out = Image.new('RGB', (w, h * 2 + 8), (27, 20, 16))
    for i, (label, im) in enumerate(zip(('before (main 5a41f98)', 'after (G1)'), ims)):
        out.paste(im, (0, i * (h + 8)))
        d = ImageDraw.Draw(out)
        d.rectangle((0, i * (h + 8), 190, i * (h + 8) + 18), fill=(27, 20, 16))
        d.text((6, i * (h + 8) + 4), label, fill=(240, 230, 210))
    out.save(f'{OUT}/{name}-{renderer}.webp', quality=80, method=6)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, file in SHEETS.items():
        sheet(name, file)
    sheet('fit', 'fit.png', 'webgl')
    sheet('fire-96', 'fire-settled.png', 'webgl')
    print(sorted(os.listdir(OUT)))
