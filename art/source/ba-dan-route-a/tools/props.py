"""Polish step: the courtyard's small props at a believable size and mass (owner, 2026-10-27: lantern posts, banners, the
notice board, the handcart and the trough "read thin and tiny beside the houses").

Each #288 G1 image (`objects-288/families/g1`) is enlarged nearest-neighbour by SCALE on the smallest Pro Flash canvas that
holds it (multiples of 4, at least 32) and redrawn by `edit-image-pro-flash` (method text, `no_background`, seeds 21 and 22),
so 1 generated px = 1 world px (G1). PICK names the output taken. The anchor scales with the image, so each prop keeps its
foot on the same ground point."""
from polishlib import *

M = 'art/source/ba-dan-route-a/objects-288'
OBJ = ('Keep the object, its shape, its pose and the camera angle exactly as drawn; redraw it at this size as a solid, heavy, '
       'well-built object in careful fine-grain pixel art. {what} High top-down view on a 2:1 isometric axis. Dark brown 1 pixel '
       'outline (#1b1410) on the silhouette, muted warm earth colours, 3 to 4 flat tone steps per material, warm light from the '
       'upper left, cool brown shade on the lower right, matte, no white or near-white pixels, no gloss, no text, no letters, '
       'no ground, no shadow, transparent background.')
PROPS = {  # family key: (scale, sentence)
    'lantern-post': (1.6, 'A sturdy square timber lantern post, the post 4 to 5 px thick with a broad stone foot, an iron arm '
                          'and a hanging iron lantern with a warm amber glass.'),
    'banner-pole': (1.4, 'A sturdy timber banner pole, the pole 4 px thick on a broad stone foot, a cloth banner hanging from a '
                         'cross-arm, plain cloth with no symbol.'),
    'notice-board': (1.4, 'A village notice board: two thick timber posts, a plank board under a small shingled roof, a few '
                          'blank pinned papers with no writing.'),
    'handcart': (1.6, 'A wooden two-wheeled handcart with plank sides, spoked wheels and two long handles resting on the ground.'),
    'trough-hay': (1.3, 'A heavy wooden water trough and a timber hay rack with golden hay.'),
}
SEEDS = (21, 22)
PICK = {}

def source(key):
    im = Image.open(f'{M}/families/g1/{key}.png').convert('RGBA')
    s = PROPS[key][0]
    big = im.resize((round(im.width * s), round(im.height * s)), Image.NEAREST)
    cw, ch = max(32, -(-big.width // 4) * 4), max(32, -(-big.height // 4) * 4)
    canvas = Image.new('RGBA', (cw, ch)); ox, oy = (cw - big.width) // 2, ch - big.height
    canvas.paste(big, (ox, oy))
    return canvas, (ox, oy)

def redraw(key, seed):
    canvas, _ = source(key)
    img, h = b64(canvas)
    return run('/edit-image-pro-flash', {'image': img, 'method': 'text', 'description': OBJ.format(what=PROPS[key][1]),
               'no_background': True, 'seed': seed}, f'p1-prop-{key}-s{seed}', {h: f'{key} x{PROPS[key][0]} nearest'},
               f'larger {key} at world px {canvas.size}')

def image(key):
    """The chosen redraw, alpha made binary, edges toward #1b1410, and its offset on the canvas of `source`."""
    seed = PICK.get(key, SEEDS[0])
    im = redraw(key, seed)[0].convert('RGBA')
    canvas, off = source(key)
    im = im.resize(canvas.size, Image.NEAREST)
    a = np.asarray(im).astype(np.float32); al = a[..., 3] > 127
    a[..., 3] = al * 255
    edge = al & ~erode(al, 1)
    a[edge, :3] = a[edge, :3] * 0.2 + INK * 0.8
    return Image.fromarray(a.astype(np.uint8), 'RGBA'), off

if __name__ == '__main__':
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(10) as ex:
        list(ex.map(lambda a: redraw(*a), [(k, s) for k in PROPS for s in SEEDS]))
