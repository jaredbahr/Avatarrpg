"""ADR 0104 T3: the town guard (npc.guard; create-character-v3 at 48 px, idle and walk by skeleton-v3 like the other Ba Dan
residents) and the two Ba Dan objects (route sign, school notice; create-object-pro-flash, low top-down, the oven as the one
angle reference). Every job is booked in ledger.json by pl.run under a t3_ prefix.
Usage (from prototypes/topdown): python3 tools/t3art.py char | anim <idle|walk> | retake <idle|walk> <dir,dir> <n>
       | dl | obj <route_sign|school_notice> [seed] | spent"""
import json, re, sys
sys.path.insert(0, 'tools'); import pl
from PIL import Image
CAP = 190.0
D8 = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
S = json.load(open('style.json'))
FOLDER = 't3_guard'
GUARD = ('a stocky village watchman in his thirties, square clean-shaven jaw, short black hair under a plain tan wrapped headcloth, '
         'calm watchful expression, sleeveless moss-green padded jerkin over a cream linen shirt with rolled sleeves, wide brown leather belt, '
         'earth-brown trousers, brown wrapped boots, holding a plain wooden watch-staff upright in one hand')
IDLE = 'standing at rest: the chest and shoulders rise and fall slowly and clearly, a gentle weight shift from one hip to the other, arms relaxed at the sides; no vapour, no effects'
WALK_T = 'walking-8-frames'


def t3_spent():
    return sum((j.get('credits') or 0) for j in pl.ledger()['jobs'] if j['name'].startswith('t3_'))


def t3_balance_diff():
    return sum((j.get('balance_diff') or 0) for j in pl.ledger()['jobs'] if j['name'].startswith('t3_'))


def char(seed=11):
    name = 't3_char_guard' if seed == 11 else f't3_char_guard_s{seed}'
    e, r = pl.run('/create-character-v3', {'description': GUARD, 'image_size': {'width': 48, 'height': 48}, 'view': S['view'],
        'outline': S['character_outline'], 'detail': S['detail'], 'template_id': 'mannequin', 'seed': seed, 'name': 'BaDan t3 guard'},
        name, estimate=3)
    cid = r['final']['last_response']['character_id']; print('guard', cid)
    out = pl.HERE / 'assets' / 'chars' / (FOLDER if seed == 11 else f'{FOLDER}_s{seed}'); out.mkdir(parents=True, exist_ok=True)
    d = pl.req('GET', f'/characters/{cid}'); meta = {'id': cid, 'size': d['size'], 'rot': {}, 'anims': {}}
    for k, u in d['rotation_urls'].items():
        pl.fetch(u).save(out / f'rot_{k}.png'); meta['rot'][k] = f'rot_{k}.png'
    json.dump(meta, open(out / 'meta.json', 'w'), indent=1)


def anim(which):
    cid = json.load(open(f'assets/chars/{FOLDER}/meta.json'))['id']
    if which == 'idle':
        body = {'character_id': cid, 'mode': 'skeleton-v3', 'action_description': IDLE, 'frame_count': 12, 'directions': D8}
    else:
        body = {'character_id': cid, 'template_animation_id': WALK_T, 'mode': 'skeleton-v3', 'directions': D8}
    est = 36
    if t3_spent() + est > CAP: raise SystemExit(f'T3 cap: {t3_spent()} spent')
    e, r = pl.run('/characters/animations', body, f't3_guard_{which}', estimate=est)
    got = r['post'].get('directions') or D8; rest = [d for d in D8 if d not in got]
    if rest:
        pl.run('/characters/animations', dict(body, directions=rest, animation_group_id=r['post']['animation_group_id']),
               f't3_guard_{which}_rest', estimate=4 * len(rest))
    print(which, 'T3 spent', t3_spent())


SAFE = re.compile(r'[^A-Za-z0-9._-]+')


def dl():
    out = pl.HERE / 'assets' / 'chars' / FOLDER; mp = out / 'meta.json'; meta = json.load(open(mp))
    d = pl.req('GET', f'/characters/{meta["id"]}'); added = 0
    for a in d.get('animations') or []:
        t = a['animation_type'] + '@' + a['animation_group_id'][:6]
        for dd in a['directions']:
            if dd['direction'] in meta['anims'].get(t, {}): continue
            fs = []
            for i, u in enumerate(dd['frames']):
                f = SAFE.sub('_', f'{t}_{dd["direction"]}_{i}.png'); pl.fetch(u).save(out / f); fs.append(f)
            meta['anims'].setdefault(t, {})[dd['direction']] = fs; added += 1
    json.dump(meta, open(mp, 'w'), indent=1); print('added', added, 'headings')


def retake(which, dirs, n):
    mp = pl.HERE / 'assets' / 'chars' / FOLDER / 'meta.json'; meta = json.load(open(mp))
    pre = 'custom-standing at rest' if which == 'idle' else 'walking-8-frames'
    key = next(k for k in meta['anims'] if k.startswith(pre))
    d = pl.req('GET', f'/characters/{meta["id"]}')
    grp = next(a['animation_group_id'] for a in d['animations'] if a['animation_type'] + '@' + a['animation_group_id'][:6] == key)
    for dd in dirs:
        try: pl.req('DELETE', f'/characters/{meta["id"]}/animations/{grp}/directions/{dd}')
        except (json.JSONDecodeError, RuntimeError): pass
        for f in meta['anims'][key].pop(dd, []): (mp.parent / f).unlink(missing_ok=True)
    json.dump(meta, open(mp, 'w'), indent=1)
    if which == 'idle': body = {'character_id': meta['id'], 'mode': 'skeleton-v3', 'action_description': IDLE, 'frame_count': 12, 'directions': dirs, 'animation_group_id': grp}
    else: body = {'character_id': meta['id'], 'template_animation_id': WALK_T, 'mode': 'skeleton-v3', 'directions': dirs, 'animation_group_id': grp}
    pl.run('/characters/animations', body, f't3_guard_{which}_retake{n}', estimate=4 * len(dirs) + 1)
    dl(); print('retook', dirs, 'T3 spent', t3_spent())


ref = Image.open('assets/objects8/oven.png').convert('RGBA')
REF = {'image': pl.b64(ref), 'size': {'width': ref.width, 'height': ref.height},
       'usage_description': ("the camera and style reference: a front-on low top-down view. The object's front face is square to the camera and parallel to "
                             "the bottom of the picture, its top is seen as a shallow slanted band above the front face, never seen from a corner, never from straight above. "
                             "Match its pixel size, one-pixel outline in a darker tone of the material, flat shading with light from the upper left, and palette.")}
# key: (description, w, h, canvas w, canvas h). The forest signpost is 29x51 and the notice board 38x47 against a 44 px person.
IT = {
 'route_sign': ('a wooden signpost on a single stout post with two weathered plank arrows nailed near the top, one long arrow board pointing to the left and a shorter one pointing to the right, plain blank boards, '
                'the post ends in a clean flat cut at the bottom with no earth, no grass and no stones at its foot; it marks the footpath to a river', 30, 52, 48, 64),
 'school_notice': ('a small wooden notice board on two short posts with a narrow shingle cap, one large sheet of cream paper pinned flat in the middle with a few dark ink lines and a red seal, '
                   'two tiny scraps pinned at its edge', 38, 46, 48, 56),
}


def obj(k, seed=3):
    d, w, h, W, H = IT[k]
    desc = (f"{d}, seen front-on from a low top-down camera: the front face square to the viewer, the top a shallow band above it, not turned to a corner. "
            f"About {w} px wide and {h} px tall (a person is 44 px tall), fills the canvas, no empty margin, standing at the bottom centre of an otherwise empty transparent canvas. "
            "No ground, no shadow, no background. " + S['style_suffix'])
    body = {'description': desc, 'view': 'low top-down', 'n_directions': 1, 'image_size': {'width': W, 'height': H}, 'style_image': REF,
            'target_palette': {'colors': S['palette'], 'name': 'village'}, 'seed': seed}
    if t3_spent() + 8 > CAP: raise SystemExit('T3 cap')
    e, r = pl.run('/create-object-pro-flash', body, f't3_obj_{k}_{seed}', estimate=8)
    fin = r['final']; lr = fin.get('last_response') or fin; ims = [pl.fetch(u) for u in (lr.get('storage_urls') or {}).values()]
    if not ims: print(k, 'no image', list(lr.keys())[:10]); return
    out = pl.HERE / 'assets' / 'objects_t3' / 'raw'; out.mkdir(parents=True, exist_ok=True)
    ims[0].save(out / f'{k}_{seed}.png'); print(k, seed, ims[0].size, e['credits'])


if __name__ == '__main__':
    c = sys.argv[1]
    if c == 'char': char(int(sys.argv[2]) if len(sys.argv) > 2 else 11)
    elif c == 'anim': anim(sys.argv[2])
    elif c == 'dl': dl()
    elif c == 'retake': retake(sys.argv[2], sys.argv[3].split(','), sys.argv[4])
    elif c == 'obj': obj(sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 3)
    elif c == 'spent': print('T3 usage', t3_spent(), 'balance diffs', t3_balance_diff(), 'balance now', pl.balance())
