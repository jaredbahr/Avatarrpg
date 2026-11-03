"""Forest road G1, step 2: every upright on the board and the six combat props, redrawn at world px by Pro Flash.

Each piece's pre-G1 art (`pre.py`: git at main 5a41f98) is reduced to the size it is drawn at in world px (Lanczos, alpha kept), centred on the smallest
Pro Flash edit canvas that holds it (multiples of 4, at least 32), and edited with `edit-image-pro-flash` (method text,
`no_background`). So 1 generated px = 1 world px: the G1 grain of ADR 0085, with no reduction afterwards. The prompt is
#288's object prompt (art/source/ba-dan-market-g at 5f5df90) with the piece's own sentence. No figure reference is passed.

python3 art/source/forest-road-g1/tools/uprights.py [id ...]     (all pieces, two seeds each, skips ledgered jobs)
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
from pl import RA, run, b64
from pre import pre_g1

PROMPT = ('Keep every shape, size, position and the camera angle exactly as drawn; only redraw the surfaces, wood grain, bark, '
          'needles, leaves, stone, straw and metal in a careful hand-drawn pixel style. Do not add any object, cloth, sign, lettering '
          'or decoration that is not in the drawing. {what} High top-down view on a 2:1 isometric axis. Dark brown 1 pixel outline '
          '(#1b1410) on the silhouette, muted warm earth colours, 3 to 4 flat tone steps per material, warm light from the upper '
          'left, cool brown shade on the lower right, solid and heavy, matte, no white or near-white pixels, no gloss, no '
          'bevelled plank edges, no text.')

# id: (pre-G1 source under public/art, drawn size in world px (w, h), sentence)
PIECES = {
    'pine': ('maps/forest-scene/pine.webp', (100, 224), 'A tall dark green pine tree with layered drooping boughs and a brown trunk foot.'),
    'pine-b': ('maps/forest-scene/pine.webp', (100, 224), 'A tall pine tree, its boughs a little fuller and more ragged on one side, deep blue-green needles, a brown trunk foot.'),
    'alder': ('maps/ba-dan-scene/village-tree.webp', (150, 146), 'A low broad alder tree with a rounded leafy crown in clustered mid and olive greens and a twisted brown trunk.'),
    'lodge': ('maps/ba-dan-scene/dwelling.webp', (256, 165), "A small road keeper's lodge: plastered walls on a stone plinth, a tiled roof, a wooden door."),
    'deadfall': ('maps/quarry-gate-scene/cover-timber.webp', (120, 51), 'Split timber logs lying in a heap, grey-brown bark and pale cut ends.'),
    'nest-reeds': ('maps/forest-scene/old-nest-reeds.webp', (120, 58), 'A low grassy flood-bank mound with reeds and an old twig nest.'),
    'bank-reed-0': ('maps/forest-scene/bank-reed-0.webp', (39, 54), 'A clump of tall green reeds and cattails on a small mud mound.'),
    'bank-reed-1': ('maps/forest-scene/bank-reed-1.webp', (27, 27), 'A small clump of green reeds on a small mud mound.'),
    'bank-reed-2': ('maps/forest-scene/bank-reed-2.webp', (53, 40), 'A spreading clump of green reeds leaning out over the bank.'),
    'bank-reed-3': ('maps/forest-scene/bank-reed-3.webp', (43, 45), 'A clump of green reeds and two cattails on a small mud mound.'),
    'signpost': ('maps/forest-scene/roadside-signpost.webp', (50, 75), 'A weathered wooden signpost with two blank pointing boards.'),
    'split-rail-fence': ('maps/forest-scene/roadside-split-rail-fence.webp', (69, 49), 'A short split-rail wooden fence section, two posts and two rails.'),
    'woodpile-stump': ('maps/forest-scene/roadside-woodpile-stump.webp', (72, 34), 'A stacked woodpile of split logs beside a chopping stump.'),
    'broken-cart-wheel': ('maps/forest-scene/roadside-broken-cart-wheel.webp', (59, 53), 'A broken wooden cart wheel leaning on the ground, spokes and an iron rim.'),
    'milestone': ('maps/forest-scene/roadside-milestone.webp', (32, 27), 'A short weathered grey milestone with a rounded top.'),
    'lantern-post': ('maps/forest-scene/roadside-lantern-post.webp', (39, 97), 'A wooden lantern post with a hanging iron lantern.'),
    'rope-bound-quarry-blocks': ('maps/forest-scene/roadside-rope-bound-quarry-blocks.webp', (47, 42), 'Two pale cut quarry stone blocks bound with rope.'),
    'mushroom-fallen-log': ('maps/forest-scene/roadside-mushroom-fallen-log.webp', (70, 34), 'A mossy fallen log with orange bracket mushrooms.'),
    'rubble-1': ('maps/forest-scene/rubble-1.webp', (128, 43), 'A low heap of broken pale stones and grit lying flat on the ground.'),
    'rubble-2': ('maps/forest-scene/rubble-2.webp', (128, 43), 'A low heap of broken pale stones and grit lying flat on the ground.'),
    # Combat props: the 256 px frame is drawn into one 64 world px sprite box, so 4 frame px = 1 world px.
    'barrel': ('props/barrel.png', None, 'An open wooden water barrel with dark iron hoops, full of dark blue water.'),
    'flask': ('props/flask.png', None, 'A round terracotta clay oil jar with a cork stopper and a dark oil stain at the lip.'),
    'hay': ('props/hay.png', None, 'A tight golden-yellow hay bale bound with two dark cords.'),
    'brazier': ('props/brazier.png', None, 'A black iron brazier basket on three legs, heaped with glowing orange coals.'),
    'cart': ('props/cart.png', None, 'A wooden hand cart with one spoked wheel and two shafts, heaped with green cabbages.'),
    'rubble': ('props/rubble.png', None, 'A tall heap of pale broken quarry stone blocks.'),
}
SEEDS = (21, 22)


def source(pid):
    path, size, _ = PIECES[pid]
    im = Image.open(pre_g1(path)).convert('RGBA')
    im = im.crop(im.getchannel('A').getbbox())
    if size is None:  # a prop: frame px / 4
        size = (round(im.width / 4), round(im.height / 4))
    sprite = im.resize(size, Image.LANCZOS)
    cw, ch = max(32, -(-size[0] // 4) * 4), max(32, -(-size[1] // 4) * 4)
    canvas = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    canvas.paste(sprite, ((cw - size[0]) // 2, ch - size[1]))
    return canvas


def job(pid, seed):
    os.makedirs(f'{RA}/uprights-in', exist_ok=True)
    canvas = source(pid)
    canvas.save(f'{RA}/uprights-in/{pid}.png')
    img, h = b64(canvas)
    body = {'image': img, 'method': 'text', 'description': PROMPT.format(what=PIECES[pid][2]),
            'no_background': True, 'seed': seed}
    return run('/edit-image-pro-flash', body, f'u-{pid}-s{seed}', {h: f'uprights-in/{pid}.png'},
               f'G1 upright {pid} at world px {canvas.size}')


if __name__ == '__main__':
    ids = sys.argv[1:] or list(PIECES)
    with ThreadPoolExecutor(8) as ex:
        list(ex.map(lambda a: job(*a), [(p, s) for p in ids for s in SEEDS]))
