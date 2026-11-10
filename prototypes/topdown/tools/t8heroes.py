"""ADR 0104 T8: top-down sprites for the seven heroes the tutorial does not cast (Tenzo, Nilak, Lin Mei, Nima, Jinu,
Riko, Wen). Each is made like Sura and Bo (`fcchars.py`): create-character-v3 at 48 px, 8 rotations, the mannequin
template and seed 11, described from the game's content (`src/content/characters.ts`) and the old sheet's outfit
colours. The clips are the T2/T5 method (`t2clips.py`, `t5clips.py`): skeleton-v3 from each hero's own base, 8 headings,
pure body motion, what the hands hold named, no element words. Every job is booked in ledger.json by pl.run under `t8_`.
Usage (from prototypes/topdown):
  python3 tools/t8heroes.py create <who>
  python3 tools/t8heroes.py anim <who> <idle|walk|hit|ko|attack|<action>>
  python3 tools/t8heroes.py retake <who> <clip> <dir,dir> <n>
  python3 tools/t8heroes.py dl <who>
  python3 tools/t8heroes.py spent"""
import json, os, re, sys
sys.path.insert(0, 'tools'); import pl

CAP = 1750.0   # T8's PixelLab budget (owner, 2026-11-10)
D8 = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
S = json.load(open('style.json'))
FOLDER = {w: f't8_{w}' for w in ('tenzo', 'nilak', 'linmei', 'nima', 'jinu', 'riko', 'wen')}
DESC = {
    'tenzo': 'Tenzo, a young man, lean and athletic, warm tan skin, short spiky black hair, a friendly grin, a crimson-red '
             'high-collared sleeveless tunic with thin gold trim and frog buttons, a wide red sash tied at the waist with '
             'long hanging tails, black forearm wraps, loose black trousers, dark red boots',
    'nilak': 'Nilak, a young man, slim, medium brown skin, black hair tied up in a short topknot, a deep blue knee-length '
             'parka with white fur trim at the collar and cuffs and pale blue wave patterns at the hem, a light blue sash, '
             'a small brown medicine bag at his hip, dark brown forearm wraps, navy trousers, dark boots with white fur tops',
    'linmei': 'Lin Mei, a young woman, tan skin, chin-length black hair with a small top knot, a dark green short-sleeved '
              'wrap jacket with olive-gold trim over a pale sage undershirt, a wide brown sash, dark leather wrist guards, '
              'loose olive-green trousers, brown wrapped shoes',
    # The first takes (`t8_nima-v1`, `t8_jinu-v1`) came back with knee-length capes, and Nima bald: the old sheet's
    # cape stops at the shoulders and his portrait has hair, so the second takes spell both out.
    'nima': 'Nima, a young man, light brown skin, short tousled dark brown hair on top of the head, a saffron-orange '
            'sleeveless tunic over cream sleeves, a small rust-red capelet that covers only the shoulders and ends above '
            'the elbows, fastened with a round bronze clasp, a dark red sash with hanging tails, brown forearm wraps, '
            'loose cream trousers, brown wrapped shoes',
    'jinu': 'Jinu, a sturdy young woman, deep brown skin, curly black hair in two puff buns, a cheerful face, a pale '
            'yellow-orange wrap tunic over cream sleeves, a small rust-red capelet that covers only the shoulders and ends '
            'above the elbows, fastened with a round bronze clasp, a cream sash, brown forearm wraps, loose cream trousers, brown wrapped shoes, a small leather mail '
            'satchel at her hip',
    'riko': 'Riko, a young woman, fair skin, chin-length dark brown hair, sharp focused eyes, a fitted plum-purple '
            'high-collared jacket with light lilac trim, a dark red sash with hanging tails, grey cloth arm wraps, dark '
            'grey trousers with grey knee wraps, black soft boots',
    'wen': 'Wen, a young woman machinist, light skin, short messy blond hair, brass goggles on a headband over her '
           'forehead, a dark blue work vest over a cream shirt with rolled sleeves, brown leather straps across the chest '
           'and a tool belt, a large heavy brass-and-iron mechanical gauntlet on her right hand, a fingerless brown glove '
           'on the left, dark brown work trousers, brown boots',
}
HANDS = {
    'tenzo': 'his hands are plain and empty',
    'nilak': 'his hands are plain and empty; the medicine bag stays at his hip',
    'linmei': 'her hands are plain and empty',
    'nima': 'his hands are plain and empty',
    'jinu': 'her hands are plain and empty; the satchel stays at her hip',
    'riko': 'her hands are plain and empty',
    'wen': 'the big metal gauntlet stays on her right hand',
}
NOFX = 'nothing flies off, no particles, no dust, no blood, no glow, no light, no marks'
CLIPS = {
    # T5's prompts, word for word, so the heroes stand, flinch and fall like the rest of the cast
    'idle': (8, 'standing at rest in a ready stance: the chest rises and falls slowly, a slight weight shift, arms relaxed; no effects'),
    'hit': (6, 'a hit reaction: flinches from a blow to the chest, the shoulders and head jerk back, one short step back '
               'to keep balance, then straightens back into the same ready stance. Pure body motion: {hands}; ' + NOFX),
    'ko': (8, 'knocked out: staggers back one step, the knees give way, falls backward onto the ground and ends lying '
              'flat on the back, still. Pure body motion: {hands}; ' + NOFX),
}
# The poses, one per ability the game plays (the cast is the level-1 ability): body motion only, no element words.
PUNCH = ('a martial-arts punch: draws the right fist back to the hip, steps forward and drives a fast straight punch '
         'forward, then recovers to a ready stance. Pure body motion: {hands}; ' + NOFX)
PALM = ('a martial-arts open palm push: steps forward and pushes the right open palm straight out fast at chest height, '
        'the left hand pulled back to the hip, then recovers to a ready stance. Pure body motion: {hands}; ' + NOFX)
SWEEP = ('a wide sweeping two-arm swing: turns the waist and swings both straight arms in a big horizontal arc across the '
         'front from one side to the other, then returns to a ready stance. Pure body motion: {hands}; ' + NOFX)
ACTIONS = {
    'tenzo': {'attack': PUNCH,
              'blast': 'a martial-arts double palm strike: draws both hands back to the hips, then steps forward and '
                       'thrusts both open palms forward together, arms fully extended, then recovers to a ready stance. '
                       'Pure body motion: {hands}; ' + NOFX},
    'nilak': {'attack': 'a whip-like arm sweep: swings the right arm in a long flowing arc from low behind him up and '
                        'across the front, the arm snapping straight at the end, the left hand held at the chest, then '
                        'returns to a ready stance. Pure body motion: {hands}; ' + NOFX,
              'heal': 'a calm healing gesture: brings both open hands together in front of the chest, then slowly '
                      'extends both palms forward and down as if laying them on someone, holds, then returns to a ready '
                      'stance. Pure body motion: {hands}; ' + NOFX},
    'linmei': {'attack': 'a martial-arts stomp and punch: lifts the left knee high, stamps the foot down hard, then '
                         'punches forward with the left fist, then returns to a ready stance. Pure body motion: {hands}; ' + NOFX,
               'throw': 'a heavy two-handed throw: crouches and scoops both hands low near the ground, then rises and '
                        'heaves both arms up and forward over the head, then recovers to a ready stance. Pure body '
                        'motion: {hands}; ' + NOFX},
    'nima': {'attack': PALM, 'gust': SWEEP},
    'jinu': {'attack': PALM, 'gust': SWEEP},
    'riko': {'attack': 'a quick boxing combination: steps in and throws two fast punches, left then right, then springs '
                       'back to a light guard with both fists up. Pure body motion: {hands}; ' + NOFX,
             'block': 'a precise finger strike: darts forward and jabs the stiff extended fingers of the right hand at '
                      'chest height in three quick pokes, the left hand guarding the chest, then springs back to a light '
                      'guard. Pure body motion: {hands}; ' + NOFX},
    'wen': {'attack': 'a heavy hook punch: winds the right arm with the big metal gauntlet back, then swings it round in a '
                      'wide hook across the front, stepping into the blow, then recovers to a ready stance. Pure body '
                      'motion: {hands}; ' + NOFX,
            # the hook (`attack`) turned the gauntlet into a hook and a rope in the north-west and west, twice: a
            # straight punch keeps the gauntlet's shape, as `spark` does
            'attack2': 'a heavy straight punch: draws the right arm with the big metal gauntlet back to the hip, steps '
                       'forward and drives the gauntlet straight forward at chest height, then recovers to a ready '
                       'stance. Pure body motion: {hands}; ' + NOFX,
            'spark': 'thrusts the right arm with the big metal gauntlet straight forward, arm fully extended at chest '
                     'height, the left hand bracing the right forearm, holds it there, then recovers to a ready stance. '
                     'Pure body motion: {hands}; ' + NOFX},
}
STATE = 't8/state.json'


def state():
    return json.load(open(STATE)) if os.path.exists(STATE) else {}


def save_state(s):
    """Merge into the file under a lock, so parallel jobs never drop each other's ids."""
    import fcntl
    os.makedirs('t8', exist_ok=True)
    with open(str(pl.LEDGER) + '.lock', 'w') as lk:
        fcntl.flock(lk, fcntl.LOCK_EX); cur = state()
        for k, v in s.items():
            if isinstance(v, dict): cur.setdefault(k, {}).update(v)
            else: cur[k] = v
        tmp = STATE + '.tmp'; json.dump(cur, open(tmp, 'w'), indent=1, sort_keys=True); os.replace(tmp, STATE)


def t8_spent():
    return sum((j.get('credits') or 0) for j in pl.ledger()['jobs'] if j['name'].startswith('t8_'))


def cap(est):
    got = t8_spent()
    if got + est > CAP: raise SystemExit(f'T8 cap: {got} spent, {est} more would pass {CAP}')


def cid(who):
    return json.load(open(f'assets/chars/{FOLDER[who]}/meta.json'))['id']


def create(who, take=''):
    cap(3)
    e, r = pl.run('/create-character-v3', {'description': DESC[who], 'image_size': {'width': 48, 'height': 48}, 'view': S['view'],
        'outline': S['character_outline'], 'detail': S['detail'], 'template_id': 'mannequin', 'seed': 11,
        'name': f'T8 hero {who}'}, f't8_char_{who}{take}', estimate=3)
    c = (r['final'].get('last_response') or {}).get('character_id') or r['post'].get('character_id')
    out = pl.HERE / 'assets' / 'chars' / FOLDER[who]; out.mkdir(parents=True, exist_ok=True)
    mp = out / 'meta.json'
    if not mp.exists(): json.dump({'id': c, 'size': None, 'rot': {}, 'anims': {}}, open(mp, 'w'), indent=1)
    dl(who); print(who, c)


def body_for(who, clip, dirs):
    if clip == 'walk':
        return {'character_id': cid(who), 'template_animation_id': 'walking-8-frames', 'mode': 'skeleton-v3', 'directions': dirs}
    frames, act = CLIPS[clip] if clip in CLIPS else (10, ACTIONS[who][clip])
    return {'character_id': cid(who), 'mode': 'skeleton-v3', 'action_description': act.format(hands=HANDS[who]),
            'frame_count': frames, 'directions': dirs}


def anim(who, clip):
    est = 3 * len(D8) + 1; cap(est)
    body = body_for(who, clip, D8); name = f't8_{who}_{clip}'
    e, r = pl.run('/characters/animations', body, name, estimate=est)
    grp = r['post']['animation_group_id']
    save_state({'groups': {f'{who}.{clip}': grp}})
    got = r['post'].get('directions') or D8; rest = [d for d in D8 if d not in got]
    if rest:
        pl.run('/characters/animations', dict(body, directions=rest, animation_group_id=grp), name + '_rest',
               estimate=3 * len(rest) + 1)
    print(who, clip, 'T8 spent', t8_spent())


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
    e, r = pl.run('/characters/animations', body, f't8_{who}_{clip}_retake{n}', estimate=est)
    got = r['post'].get('directions') or dirs; rest = [d for d in dirs if d not in got]
    if rest:   # the queue took only some headings: the rest go in the same group
        pl.run('/characters/animations', dict(body, directions=rest), f't8_{who}_{clip}_retake{n}_rest',
               estimate=3 * len(rest) + 1)
    dl(who); print(who, clip, 'retook', dirs, 'T8 spent', t8_spent())


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
    elif cmd == 'spent': print('T8 usage', t8_spent(), 'balance now', pl.balance())
