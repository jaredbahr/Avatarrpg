"""Review helper: each figure before and after a restyle, side by side at Nx nearest (rows: characters, columns: headings)."""
import json, sys
from pathlib import Path
from PIL import Image
HERE = Path(__file__).resolve().parent.parent

def main(after, out, k=3, before='inputs/composite.png'):
    L = json.load(open(HERE / 'inputs/layout.json'))
    a = Image.open(HERE / before).convert('RGB'); b = Image.open(HERE / after).convert('RGB')
    W, H = 56, 86
    sheet = Image.new('RGB', (4 * (2 * W + 6), 4 * (H + 4)), (30, 30, 30))
    for i, f in enumerate(L['figures']):
        r, c = divmod(i, 4)
        cx = f['x'] + f['w'] // 2; foot = f['y'] + f['h']
        box = (cx - W // 2, foot - H + 2, cx + W // 2, foot + 2)
        sheet.paste(a.crop(box), (c * (2 * W + 6), r * (H + 4)))
        sheet.paste(b.crop(box), (c * (2 * W + 6) + W, r * (H + 4)))
    sheet.resize((sheet.width * k, sheet.height * k), Image.NEAREST).save(out)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 3)
