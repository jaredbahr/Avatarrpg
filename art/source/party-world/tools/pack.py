"""Step 10: pack Kaya's, Sura's and Bo's world sheets and write their timing (no generation).

Per character, under public/art/units/world/:
- <name>.json + .webp: 128x128 cels, every heading's idle (2), rest (1), walk (6), stance (2) and hit (4: the stance
  cel, then the take's three), frames named <key>/<clip>/<i>;
- <name>-2.json + .webp: 192x192 cels, the four diagonal knockouts (7: the stance cel, then the take's six);
- <name>-bend.json (the bend set: party-g1's shipped frames, timing, keys and attacks, this folder's cels, sockets and
  foot point, assemble.py's bends) and its page <name>-bend-page.json + .webp, 192x192 cels, when its cels are made;
- <name>-clips.json: the hit and knockout clips, at the shipped G sheets' own frame times (public/art/units/<name>-g-
  clips.json), the knockouts with their own cel size and foot anchor.
src/content/assets/worldParty.ts holds what the manifest needs: the walk's cel time, start cel and clip ms a tile per
heading (from stride.json, times the oblique figure scale the animator divides by), and the anchors.

usage (repo root): python3 -I art/source/party-world/tools/pack.py && npx prettier --write src/content/assets/worldParty.ts public/art/units/world"""
import json
from pathlib import Path
from PIL import Image
HERE = Path(__file__).resolve().parent.parent
REPO = HERE.parents[2]
KEYS = {'kaya': 'unit.fire.kaya', 'sura': 'unit.water.sura', 'bo': 'unit.earth.bo'}
DIRS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east']   # HEADINGS order
CAMEL = {'east': '', 'south-east': 'SouthEast', 'south': 'South', 'south-west': 'SouthWest', 'west': 'West',
         'north-west': 'NorthWest', 'north': 'North', 'north-east': 'NorthEast'}
KO_DIRS = ['south-east', 'south-west', 'north-east', 'north-west']
CEL_MS, START_CEL, IDLE_MS = 120, 2, [1300, 1100]
FIGURE_SCALE = 1.25
GROUND = {128: 113, 192: 151}   # the row under the root's sole on each canvas


def clip_name(base, d):
    if base == 'hit': return 'hit' + (CAMEL[d] or 'East')
    if base == 'ko': return 'ko' + CAMEL[d]
    return base + CAMEL[d]


def page(cels, size, cols, out, name):
    rows = (len(cels) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * size, rows * size), (0, 0, 0, 0)); frames = {}
    for i, (fname, p) in enumerate(cels):
        x, y = (i % cols) * size, (i // cols) * size
        sheet.alpha_composite(Image.open(p).convert('RGBA'), (x, y))
        frames[fname] = {'frame': {'x': x, 'y': y, 'w': size, 'h': size}, 'rotated': False, 'trimmed': False,
                         'spriteSourceSize': {'x': 0, 'y': 0, 'w': size, 'h': size}, 'sourceSize': {'w': size, 'h': size}}
    sheet.save(out / f'{name}.webp', lossless=True, quality=100, method=6)
    json.dump({'frames': frames, 'meta': {'app': 'four-nations-tactics', 'version': '1', 'image': f'{name}.webp',
                                          'format': 'RGBA8888', 'size': {'w': sheet.width, 'h': sheet.height}, 'scale': '1'}},
              open(out / f'{name}.json', 'w'))


def main():
    stride = json.load(open(HERE / 'stride.json'))
    out = REPO / 'public/art/units/world'; out.mkdir(parents=True, exist_ok=True)
    data = {}
    for name, key in KEYS.items():
        c = HERE / f'cels/{name}'
        loco, kos, clips = [], [], {}
        shipped = json.load(open(REPO / f'public/art/units/{name}-g-clips.json'))
        for d in DIRS:
            for base, n in (('idle', 2), ('rest', 1), ('walk', 6), ('stance', 2), ('hit', 4)):
                cn = clip_name(base, d)
                for i in range(n): loco.append((f'{key}/{cn}/{i}', c / f'{base}/{d}/{i:02d}.png'))
            hit = clip_name('hit', d); ref = shipped[hit]
            clips[hit] = {'frames': list(ref['frames']), 'fps': ref['fps'], 'loop': False,
                          'frameMs': ref['frameMs']}
        for d in KO_DIRS:
            ko = clip_name('ko', d); ref = shipped[ko]
            for i in range(7): kos.append((f'{key}/{ko}/{i}', c / f'ko/{d}/{i:02d}.png'))
            # The shipped frame list exactly (a fall may hold a cel twice); its cels are this take's.
            clips[ko] = {'frames': list(ref['frames']), 'fps': ref['fps'], 'loop': False,
                         'frameMs': ref['frameMs'], 'frameSize': {'w': 192, 'h': 192},
                         'anchor': {'x': 0.5, 'y': round(GROUND[192] / 192, 6)}}
        if name == 'kaya':
            # Kaya's riverside wave and tea are drawn in the world rendering (kp_riverside.py, kp_assemble.py).
            for clip in ('wave', 'tea'):
                for i in range(2): loco.append((f'{key}/{clip}/{i}', c / f'riverside/{clip}-{i}.png'))
        elif name == 'sura':
            # Sura's riverside wave and seated tea (ADR 0054) are not redrawn: the G1 sheet's cels, 1.25x nearest onto
            # this grid (one G1 art px is 1.25 world px, as it was drawn), their foot line on this sheet's.
            g1 = json.load(open(REPO / f'public/art/units/{name}-g.json'))
            img = Image.open(REPO / f'public/art/units/{g1["meta"]["image"]}').convert('RGBA')
            (c / 'riverside').mkdir(exist_ok=True)
            for clip in ('wave', 'tea'):
                for i in range(2):
                    f = g1['frames'][f'{key}/{clip}/{i}']['frame']
                    cel = img.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h']))
                    cel = cel.resize((round(cel.width * 1.25), round(cel.height * 1.25)), Image.NEAREST)
                    cv = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
                    cv.alpha_composite(cel, (64 - cel.width // 2, round(GROUND[128] - 0.85 * cel.height)))
                    cv.save(c / f'riverside/{clip}-{i}.png'); loco.append((f'{key}/{clip}/{i}', c / f'riverside/{clip}-{i}.png'))
        # The legacy clips non-bend abilities and a non-diagonal fall play (as party-g1 packs them): cast, the east
        # bend's stance, last wind-up before its first strike, and that strike; ko, the south-east knockout's last cel.
        kos.append((f'{key}/ko/0', c / 'ko/south-east/06.png'))
        bend_set = json.load(open(c / 'bend.json')) if (c / 'bend.json').exists() else None
        if bend_set:
            east = bend_set['facings']['east']; keys = sorted(east['keyFrames'].values(), key=lambda v: v['frame'])
            contact = next(k['frame'] for k in keys if k['role'] == 'contact')
            ant = [k['frame'] for k in keys if k['role'] == 'anticipation' and k['frame'] < contact]
            for i, pos in enumerate([0, ant[-1] if ant else 1, contact]):
                n = int(east['frames'][pos].split('/')[-1])
                kos.append((f'{key}/cast/{i}', c / f'bend/east/{n:02d}.png'))
        page(loco, 128, 16, out, name)
        page(kos, 192, 7, out, f'{name}-2')
        if (c / 'bend.json').exists():
            bend = json.load(open(c / 'bend.json')); cels = []
            for d in DIRS:
                cn = 'bend' + (CAMEL[d] or 'East')
                for p in sorted((c / f'bend/{d}').glob('*.png')): cels.append((f'{key}/{cn}/{int(p.stem)}', p))
            page(cels, 192, 10, out, f'{name}-bend-page')
            json.dump(bend, open(out / f'{name}-bend.json', 'w'), indent=1)
        json.dump(clips, open(out / f'{name}-clips.json', 'w'), indent=1)
        data[name] = ([round(6 * CEL_MS / stride[f'{name}/{d}']['loop_tiles'] * FIGURE_SCALE, 1) for d in DIRS],
                      (c / 'bend.json').exists())
    ts = ['/**', ' * Generated by `art/source/party-world/tools/pack.py`; do not edit by hand.', ' *',
          " * Kaya's, Sura's and Bo's world sheets (`?style=world`, phase 2a): the walk's authored cel time and start cel,",
          ' * the idle breath, the foot anchor of the 128 px cels, and the clip ms a tile per heading (`HEADINGS` order)',
          ' * that holds the planted foot, from the measured stride times the oblique figure scale the animator divides by.',
          ' */', "export type WorldPartyName = 'kaya' | 'sura' | 'bo';", '',
          'export const WORLD_PARTY: Readonly<', '  Record<', '    WorldPartyName,', '    {',
          '      readonly walkCels: number;', '      readonly walkCelMs: number;', '      readonly walkStartCel: number;',
          '      readonly idleMs: readonly number[];', '      readonly anchorY: number;',
          '      readonly walkMsPerTile: readonly number[];',
          '      /** Whether its bend set and page are packed (the bends are drawn figure by figure). */',
          '      readonly bend: boolean;', '    }', '  >', '> = {']
    for name, (ms, bend) in data.items():
        ts += [f'  {name}: {{', '    walkCels: 6,', f'    walkCelMs: {CEL_MS},', f'    walkStartCel: {START_CEL},',
               f'    idleMs: [{IDLE_MS[0]}, {IDLE_MS[1]}],', f'    anchorY: {round(GROUND[128] / 128, 6)},',
               f'    walkMsPerTile: [{", ".join(str(v) for v in ms)}],', f'    bend: {"true" if bend else "false"},', '  },']
    ts += ['};', '']
    (REPO / 'src/content/assets/worldParty.ts').write_text('\n'.join(ts))
    print(json.dumps(data))


if __name__ == '__main__':
    main()
