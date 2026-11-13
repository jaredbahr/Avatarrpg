"""T10: top-down sprites of their own for the road keeper Dema (the Forest Road) and Sen, the tea keeper at the
Cutting's rest stop, who borrowed Mira's and Gao's. Made as the T3 guard and the Ba Dan residents were: create-character-v3
at 48 px, 8 rotations, the mannequin template and seed 11, then skeleton-v3 idle (the residents' 12-frame prompt) and
the walking-8-frames template, eight headings. Described from `docs/writing-guide.md` (Dema: the bank, the runoff,
her washing; Sen: keeps the crews' rest stop and its kettle) in colours and silhouettes apart from Mira and Gao.
Every job is booked in ledger.json by pl.run under `t10_`.
Usage (from prototypes/topdown):
  python3 tools/t10residents.py create <who>
  python3 tools/t10residents.py anim <who> <idle|walk>
  python3 tools/t10residents.py retake <who> <clip> <dir,dir> <n>
  python3 tools/t10residents.py dl <who>
  python3 tools/t10residents.py spent"""
import json, os, re, sys
sys.path.insert(0, 'tools'); import pl

CAP = 200.0   # T10's PixelLab budget for Dema and Sen
D8 = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
S = json.load(open('style.json'))
FOLDER = {w: f't10_{w}' for w in ('dema', 'sen')}
DESC = {
    'dema': 'Dema, a road keeper, a sturdy weathered woman in her forties, sun-browned skin, a wide flat conical woven '
            'straw hat, black hair in a low braid, an undyed oatmeal-beige wrap tunic with the sleeves rolled up to '
            'the elbows, a rust-orange cloth sash, dark brown trousers rolled up to mid-calf, straw sandals, bare '
            'forearms, a no-nonsense frown',
    'sen': 'Sen, a tea keeper, a tall lanky man in his thirties, light tan skin, a long face, clean-shaven, short messy '
           'black hair under a knotted grey headband, a slate-grey quilted sleeveless vest over a faded brick-red '
           'long-sleeved shirt, a white cloth towel hung over his left shoulder, a tan sash, loose charcoal trousers, '
           'dark cloth shoes, a kind tired smile',
}
CLIPS = {
    # the residents' idle (T3 guard, the v7 villagers), word for word
    'idle': (12, 'standing at rest: the chest and shoulders rise and fall slowly and clearly, a gentle weight shift '
                 'from one hip to the other, arms relaxed at the sides; no vapour, no effects'),
}
STATE = 't10/state.json'


def state():
    return json.load(open(STATE)) if os.path.exists(STATE) else {}


def save_state(s):
    """Merge into the file under a lock, so parallel jobs never drop each other's ids."""
    import fcntl
    os.makedirs('t10', exist_ok=True)
    with open(str(pl.LEDGER) + '.lock', 'w') as lk:
        fcntl.flock(lk, fcntl.LOCK_EX); cur = state()
        for k, v in s.items():
            if isinstance(v, dict): cur.setdefault(k, {}).update(v)
            else: cur[k] = v
        tmp = STATE + '.tmp'; json.dump(cur, open(tmp, 'w'), indent=1, sort_keys=True); os.replace(tmp, STATE)


def t10_spent():
    return sum((j.get('credits') or 0) for j in pl.ledger()['jobs'] if j['name'].startswith('t10_'))


def cap(est):
    got = t10_spent()
    if got + est > CAP: raise SystemExit(f'T10 cap: {got} spent, {est} more would pass {CAP}')


def cid(who):
    return json.load(open(f'assets/chars/{FOLDER[who]}/meta.json'))['id']


def create(who, take=''):
    cap(3)
    e, r = pl.run('/create-character-v3', {'description': DESC[who], 'image_size': {'width': 48, 'height': 48}, 'view': S['view'],
        'outline': S['character_outline'], 'detail': S['detail'], 'template_id': 'mannequin', 'seed': 11,
        'name': f'T10 resident {who}'}, f't10_{who}_char{take}', estimate=3)
    c = (r['final'].get('last_response') or {}).get('character_id') or r['post'].get('character_id')
    out = pl.HERE / 'assets' / 'chars' / FOLDER[who]; out.mkdir(parents=True, exist_ok=True)
    mp = out / 'meta.json'
    if not mp.exists(): json.dump({'id': c, 'size': None, 'rot': {}, 'anims': {}}, open(mp, 'w'), indent=1)
    dl(who); print(who, c)


def body_for(who, clip, dirs):
    if clip == 'walk':
        return {'character_id': cid(who), 'template_animation_id': 'walking-8-frames', 'mode': 'skeleton-v3', 'directions': dirs}
    frames, act = CLIPS[clip]
    return {'character_id': cid(who), 'mode': 'skeleton-v3', 'action_description': act,
            'frame_count': frames, 'directions': dirs}


def anim(who, clip):
    est = 3 * len(D8) + 1; cap(est)
    body = body_for(who, clip, D8); name = f't10_{who}_{clip}'
    e, r = pl.run('/characters/animations', body, name, estimate=est)
    grp = r['post']['animation_group_id']
    save_state({'groups': {f'{who}.{clip}': grp}})
    got = r['post'].get('directions') or D8; rest = [d for d in D8 if d not in got]
    if rest:
        pl.run('/characters/animations', dict(body, directions=rest, animation_group_id=grp), name + '_rest',
               estimate=3 * len(rest) + 1)
    print(who, clip, 'T10 spent', t10_spent())


def retake(who, clip, dirs, n):
    """Redraw some headings of a clip in its own animation group (the same 3D motion): the old headings are deleted
    on PixelLab and on disk first, then generated again and merge-downloaded."""
    mp = pl.HERE / 'assets' / 'chars' / FOLDER[who] / 'meta.json'; meta = json.load(open(mp))
    grp = state()['groups'][f'{who}.{clip}']
    key = next(k for k in meta['anims'] if k.endswith('@' + grp[:6]))
    est = 3 * len(dirs) + 1; cap(est)
    for dd in dirs:
        try: pl.req('DELETE', f'/characters/{meta["id"]}/animations/{grp}/directions/{dd}')
        except (json.JSONDecodeError, RuntimeError): pass   # 204: no body; 404: the heading never arrived
        for f in meta['anims'][key].pop(dd, []): (mp.parent / f).unlink(missing_ok=True)
    json.dump(meta, open(mp, 'w'), indent=1)
    body = dict(body_for(who, clip, dirs), animation_group_id=grp)
    e, r = pl.run('/characters/animations', body, f't10_{who}_{clip}_retake{n}', estimate=est)
    got = r['post'].get('directions') or dirs; rest = [d for d in dirs if d not in got]
    if rest:   # the queue took only some headings: the rest go in the same group
        pl.run('/characters/animations', dict(body, directions=rest), f't10_{who}_{clip}_retake{n}_rest',
               estimate=3 * len(rest) + 1)
    dl(who); print(who, clip, 'retook', dirs, 'T10 spent', t10_spent())


SAFE = re.compile(r'[^A-Za-z0-9._-]+')


def dl(who):
    """Merge-download (as t5clips.dl): new groups and headings are added; frames already on disk are never rewritten."""
    out = pl.HERE / 'assets' / 'chars' / FOLDER[who]
    mp = out / 'meta.json'; meta = json.load(open(mp))
    d = pl.req('GET', f'/characters/{meta["id"]}'); meta['size'] = d['size']; added = 0
    for kk, u in (d.get('rotation_urls') or {}).items():
        if kk not in meta['rot']: pl.fetch(u).save(out / f'rot_{kk}.png'); meta['rot'][kk] = f'rot_{kk}.png'
    for a in d.get('animations') or []:
        t = a['animation_type'] + '@' + a['animation_group_id'][:6]
        for dd in a['directions']:
            if dd['direction'] in meta['anims'].get(t, {}): continue
            if len(dd.get('frames') or []) == 0: continue
            fs = []
            for i, u in enumerate(dd['frames']):
                f = SAFE.sub('_', f'{t}_{dd["direction"]}_{i}.png'); pl.fetch(u).save(out / f); fs.append(f)
            meta['anims'].setdefault(t, {})[dd['direction']] = fs; added += 1
    json.dump(meta, open(mp, 'w'), indent=1); print(who, 'added', added, 'headings')


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'create': create(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else '')
    elif cmd == 'anim': anim(sys.argv[2], sys.argv[3])
    elif cmd == 'dl': dl(sys.argv[2])
    elif cmd == 'retake': retake(sys.argv[2], sys.argv[3], sys.argv[4].split(','), sys.argv[5])
    elif cmd == 'spent': print('T10 usage', t10_spent(), 'balance now', pl.balance())
