"""review.py ATLAS_DIR OUT_DIR : evidence for the thug's hit and knockout clips, drawn from the BUILT atlas pages and clip data
(public/art/units/thug-g-{2,3}.webp + thug-g-clips.json), so what is reviewed is what ships.

Each clip is composed the way the sheet draws it: the clip's trimmed frame placed so its anchor (a fraction of the frame)
lands on the unit's foot point (0.5, 0.85 of the 128x192 cel). Outputs, per OUT_DIR:
  gifs/<clip>-game.gif / -4x.gif   timed by the clip's frameMs
  sheets/<clip>-game.png / -4x.png every frame of the clip beside the heading's idle cel 0, on the lineup grey
  contact-hits-game.png / -4x.png, contact-ko-game.png / -4x.png   every heading, one row each
  facing-pitch.md                  per-frame facing and pitch table (see the header it writes)
Run with `py -I`; reads only the repo and the built atlas."""
import json, os, sys
import numpy as np
from PIL import Image
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
GREY = (60, 60, 70, 255)
KEY = 'unit.enemy.thug'
FW, FH = 128, 192
FOOT = (0.5 * FW, 0.85 * FH)
DIRS = {'hitEast': 'east', 'hitNorthEast': 'north-east', 'hitNorth': 'north', 'hitNorthWest': 'north-west', 'hitWest': 'west',
        'hitSouthWest': 'south-west', 'hitSouth': 'south', 'hitSouthEast': 'south-east',
        'koNorthEast': 'north-east', 'koNorthWest': 'north-west', 'koSouthWest': 'south-west', 'koSouthEast': 'south-east'}
HEADING = {'east': 'idle', 'north-east': 'idleNorthEast', 'north': 'idleNorth', 'north-west': 'idleNorthWest', 'west': 'idleWest',
           'south-west': 'idleSouthWest', 'south': 'idleSouth', 'south-east': 'idleSouthEast'}


def load_pages(atlas):
    frames = {}
    for stem in ('thug-g', 'thug-g-2', 'thug-g-3'):
        j = json.load(open(os.path.join(atlas, stem + '.json')))
        im = Image.open(os.path.join(atlas, stem + '.webp')).convert('RGBA')
        for name, f in j['frames'].items():
            r = f.get('frame', f)
            frames[name] = im.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h']))
    return frames


def place(frames, clip, name, pad=24):
    """The clip's frame `name` on a canvas FW+2pad wide, FH+pad tall, anchored on the foot point; the canvas is the same for every
    frame of every clip so a clip's feet never move between frames."""
    c = clip
    im = frames[name]; w, h = c['frameSize']['w'], c['frameSize']['h']
    x0 = int(round(FOOT[0] - c['anchor']['x'] * w)) + pad; y0 = int(round(FOOT[1] - c['anchor']['y'] * h)) + pad
    canvas = Image.new('RGBA', (FW + 2 * pad, FH + pad), (0, 0, 0, 0)); canvas.alpha_composite(im, (x0, y0)); return canvas


def on_grey(im, scale=1):
    bg = Image.new('RGBA', im.size, GREY); bg.alpha_composite(im)
    return bg.convert('RGB').resize((im.width * scale, im.height * scale), Image.NEAREST)


def main(atlas, out):
    frames = load_pages(atlas); clips = json.load(open(os.path.join(atlas, 'thug-g-clips.json')))
    for sub in ('gifs', 'sheets'): os.makedirs(os.path.join(out, sub), exist_ok=True)
    contact = {'hit': [], 'ko': []}
    for clip, c in clips.items():
        kind = 'hit' if clip.startswith('hit') else 'ko'
        cels = [place(frames, c, n) for n in c['frames']]
        idle = Image.new('RGBA', cels[0].size, (0, 0, 0, 0)); idle.alpha_composite(frames[f"{KEY}/{HEADING[DIRS[clip]]}/0"], (24, 24))
        for scale, tag in ((1, 'game'), (4, '4x')):
            seq = [on_grey(x, scale) for x in cels]
            seq[0].save(os.path.join(out, 'gifs', f'{clip}-{tag}.gif'), save_all=True, append_images=seq[1:], duration=[int(m) for m in c['frameMs']], loop=0)
            row = [on_grey(idle, scale)] + seq
            sh = Image.new('RGB', (row[0].width * len(row), row[0].height))
            for i, r in enumerate(row): sh.paste(r, (i * r.width, 0))
            sh.save(os.path.join(out, 'sheets', f'{clip}-{tag}.png'))
        contact[kind].append((clip, [on_grey(idle)] + [on_grey(x) for x in cels]))
    for kind, rows in contact.items():
        for scale, tag in ((1, 'game'), (4, '4x')):
            n = max(len(r[1]) for r in rows); w, h = rows[0][1][0].size
            sh = Image.new('RGB', (w * scale * n, h * scale * len(rows)), GREY[:3])
            for y, (clip, ims) in enumerate(rows):
                for x, im in enumerate(ims):
                    sh.paste(im.resize((w * scale, h * scale), Image.NEAREST) if scale > 1 else im, (x * w * scale, y * h * scale))
            sh.save(os.path.join(out, f'contact-{kind}s-{tag}.png' if kind == 'hit' else f'contact-ko-{tag}.png'))
    print('wrote evidence for', len(clips), 'clips to', out)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
