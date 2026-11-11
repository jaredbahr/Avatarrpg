"""ADR 0104 T5 (#452): the quarry cast's hit reaction and knockout, a new mercenary sergeant (base, idle, walk,
attack, hit, knockout) and the Driller's missing object clips (rumble in all eight headings, tread loop, hit shudder,
jammed knockout). The T2 method (`t2clips.py`): skeleton-v3 from each character's own base, 8 headings, pure body
motion, what the hands hold named, no element words. Every job is booked in ledger.json by pl.run under `t5_`.
Usage (from prototypes/topdown):
  python3 tools/t5clips.py create sergeant
  python3 tools/t5clips.py anim <who> <hit|ko|idle|walk|attack>
  python3 tools/t5clips.py retake <who> <clip> <dir,dir> <n>
  python3 tools/t5clips.py dl <who>
  python3 tools/t5clips.py driller <rumble|tread|hit|ko> <dir,dir|all> [n]
  python3 tools/t5clips.py driller-retake <clip> <dir,dir> <n>
  python3 tools/t5clips.py driller-dl
  python3 tools/t5clips.py spent"""
import io, json, os, re, sys, time, urllib.request, zipfile
sys.path.insert(0, 'tools'); import pl

CAP = 650.0   # T5's PixelLab budget (owner, 2026-11-07; ADR 0104 amendment)
D8 = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
S = json.load(open('style.json'))
FOLDER = {'deserter': 't13_deserter', 'merc': 't13_merc', 'xbow': 't13_xbow', 'qbender': 't13_qbender',
          'ruon': 't13_ruon', 'sergeant': 't5_sergeant'}
HANDS = {
    'deserter': 'his hands are plain and empty',
    'merc': 'the short curved sword stays in his right hand',
    'xbow': 'the wooden crossbow stays in her hands',
    'qbender': 'her hands are plain and empty; her olive headcloth stays tied on her head',
    'ruon': 'his hands are empty and the sabre stays sheathed at his left hip',
    'sergeant': 'the short curved sword stays in his right hand',
}
NOFX = 'nothing flies off, no particles, no dust, no blood, no glow, no light, no marks'
CLIPS = {
    # T2's prompts, word for word, so the quarry cast reacts like the forest cast
    'hit': (6, 'a hit reaction: flinches from a blow to the chest, the shoulders and head jerk back, one short step back '
               'to keep balance, then straightens back into the same ready stance. Pure body motion: {hands}; ' + NOFX),
    'ko': (8, 'knocked out: staggers back one step, the knees give way, falls backward onto the ground and ends lying '
              'flat on the back, still. Pure body motion: {hands}; ' + NOFX),
    # the crossbow's `ko` group ended sitting up in every heading (twice: a retake keeps the group's 3D motion), so
    # a new group spells out the fall to full length and lets the crossbow go
    'ko2': (8, 'knocked out: staggers back one step, the knees give way, she topples backward and falls flat onto her back, '
               'ending stretched out full length on the ground, legs straight, arms out, head on the ground, completely still; '
               'the crossbow drops from her hands and lies beside her. Pure body motion; ' + NOFX),
    # the sergeant's own clips, as t13chars.py made the rest of the quarry cast's
    'idle': (8, 'standing at rest in a ready stance: the chest rises and falls slowly, a slight weight shift, arms relaxed; no effects'),
    'attack': (10, 'a heavy overhand sword chop: raises the short curved sword above the shoulder, steps forward and chops it '
                   'down across the front, then recovers to a guard stance. Pure body motion: {hands}; ' + NOFX),
}
# Jin's crew (t13chars.py `merc`, `xbow`): the same charcoal quilted jacket and teal sash, older and ranked.
SERGEANT = ('a hired mercenary sergeant, a stocky broad-chested man in his forties, a short black beard, a dark iron '
            'helmet with a short teal crest, a charcoal-grey quilted jacket with a deep teal sash at the waist and a '
            'brass-buckled rank sash across the chest, brown leather guards on both shoulders, a short curved sword '
            'in his right hand, dark trousers, tall dark boots; stern and commanding')

# The Driller (t13driller.py): object b0cc7559, the accepted 128 px view and its eight rotations. Its rumble
# extends the prototype's idle group (three west headings) to all eight; the rest are new groups.
DRILLER = 'b0cc7559-12db-4011-aac0-82a7a3d4fb9b'
RUMBLE_GROUP = '758ed1b6-fab5-488e-9249-b00bb45b217d'
NOOBJFX = 'no flashes, no sparks, no fire, no explosions, no effects'
DACT = {
    # word for word the prototype's idle (t13driller.py ACT['idle']), so the new headings join its group
    'rumble': (8, 'the engine idles: the whole machine shudders and rumbles slightly on its treads, the drill bit spins slowly, the driver bobs; it stays in place'),
    'tread': (8, 'the machine drives forward: both broad caterpillar treads roll steadily forward, the track plates and '
                 'wheels turning in a smooth loop, the body bobbing slightly, the drill arm held still at rest, the driver '
                 'steady at the levers; the machine stays in the same place on the picture; ' + NOOBJFX),
    'hit': (8, 'struck by a heavy blow: the whole machine jolts back on its treads and shudders hard, the cabin rocks, '
               'the driver jerks in his seat, then it settles back to rest exactly as it started; ' + NOOBJFX),
    'ko': (10, 'the machine breaks down and jams: the engine coughs and the whole machine shudders hard twice, then the '
               'drill arm sags slowly down until the drill bit rests on the ground in front, the driver slumps forward '
               'over the levers, and the machine sits still and dead; it stays in place; ' + NOOBJFX),
}
STATE = 't5/state.json'


def state():
    return json.load(open(STATE)) if os.path.exists(STATE) else {}


def save_state(s):
    """Merge into the file under a lock, so parallel jobs never drop each other's group ids."""
    import fcntl
    os.makedirs('t5', exist_ok=True)
    with open(str(pl.LEDGER) + '.lock', 'w') as lk:   # pl.run's own lock file (tracked, empty)
        fcntl.flock(lk, fcntl.LOCK_EX); cur = state()
        for k, v in s.items():
            if isinstance(v, dict): cur.setdefault(k, {}).update(v)
            else: cur[k] = v
        tmp = STATE + '.tmp'; json.dump(cur, open(tmp, 'w'), indent=1, sort_keys=True); os.replace(tmp, STATE)


def t5_spent():
    return sum((j.get('credits') or 0) for j in pl.ledger()['jobs'] if j['name'].startswith('t5_'))


def t5_balance_diff():
    return sum((j.get('balance_diff') or 0) for j in pl.ledger()['jobs'] if j['name'].startswith('t5_'))


def cap(est):
    # Booked usage, as T2's cap. Per-job balance deltas overlap when jobs run in parallel and the key is shared,
    # so their sum overstates the spend; object jobs, which report no usage, are booked by their own delta below.
    got = t5_spent()
    if got + est > CAP: raise SystemExit(f'T5 cap: {got} spent, {est} more would pass {CAP}')


def cid(who):
    return json.load(open(f'assets/chars/{FOLDER[who]}/meta.json'))['id']


def create(who):
    assert who == 'sergeant'
    cap(3)
    e, r = pl.run('/create-character-v3', {'description': SERGEANT, 'image_size': {'width': 48, 'height': 48}, 'view': S['view'],
        'outline': S['character_outline'], 'detail': S['detail'], 'template_id': 'mannequin', 'seed': 11,
        'name': 'Tutorial sergeant'}, 't5_char_sergeant', estimate=3)
    c = r['final'].get('last_response', {}).get('character_id') or r['post'].get('character_id')
    out = pl.HERE / 'assets' / 'chars' / FOLDER[who]; out.mkdir(parents=True, exist_ok=True)
    mp = out / 'meta.json'
    if not mp.exists(): json.dump({'id': c, 'size': None, 'rot': {}, 'anims': {}}, open(mp, 'w'), indent=1)
    dl(who); print(who, c)


def body_for(who, clip, dirs):
    if clip == 'walk':
        return {'character_id': cid(who), 'template_animation_id': 'walking-8-frames', 'mode': 'skeleton-v3', 'directions': dirs}
    frames, act = CLIPS[clip]
    return {'character_id': cid(who), 'mode': 'skeleton-v3', 'action_description': act.format(hands=HANDS[who]),
            'frame_count': frames, 'directions': dirs}


def anim(who, clip):
    est = 3 * len(D8) + 1; cap(est)
    body = body_for(who, clip, D8); name = f't5_{who}_{clip}'
    e, r = pl.run('/characters/animations', body, name, estimate=est)
    grp = r['post']['animation_group_id']
    s = state(); s.setdefault('groups', {})[f'{who}.{clip}'] = grp; save_state(s)
    got = r['post'].get('directions') or D8; rest = [d for d in D8 if d not in got]
    if rest:
        pl.run('/characters/animations', dict(body, directions=rest, animation_group_id=grp), name + '_rest',
               estimate=3 * len(rest) + 1)
    print(who, clip, 'T5 spent', t5_spent())


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
    pl.run('/characters/animations', body, f't5_{who}_{clip}_retake{n}', estimate=est)
    dl(who); print(who, clip, 'retook', dirs, 'T5 spent', t5_spent())


SAFE = re.compile(r'[^A-Za-z0-9._-]+')


def dl(who):
    """Merge-download (as t13chars.dl): new groups and headings are added; frames already on disk are never rewritten."""
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


def frames_of(x):
    return (x.get('storage_urls') or {}).get('frames') or x.get('frames') or []


def obj_dirs(grp):
    d = pl.req('GET', f'/objects/{DRILLER}')
    for a in d.get('animations') or []:
        if a.get('animation_group_id') == grp:
            return {x['direction']: len(frames_of(x)) for x in a.get('directions') or []}
    return {}


def book_object_job(name, sub):
    """Object jobs return at once with one background job per heading (or `rate_limited`, no job). Poll each job
    and book the sum of their own usage on the ledger entry, as pl.finish does for a re-polled job."""
    import fcntl
    ids = [x['background_job_id'] for x in sub if x.get('background_job_id')]
    rs = [pl.poll(j, time.time()) for j in ids]
    used = sum(((r.get('usage') or {}).get('generations') or 0) for r in rs)
    with open(str(pl.LEDGER) + '.lock', 'w') as lk:
        fcntl.flock(lk, fcntl.LOCK_EX)
        L = pl.ledger(); ent = next(x for x in L['jobs'] if x['name'] == name)
        ent['job'] = ids; ent['credits'] = used; ent['credit_source'] = 'usage (each heading job re-polled)'
        ent['status'] = 'completed' if rs and all(r.get('status') == 'completed' for r in rs) else 'failed'
        ent['notes'] = 'headings: ' + ', '.join(f"{x['direction']} {x['status']}" for x in sub)
        pl.save(L)
    return [x['direction'] for x, r in zip([x for x in sub if x.get('background_job_id')], rs) if r.get('status') == 'completed']


def driller(clip, dirs, n=None, replace=False):
    """Object animation headings. PixelLab rate-limits object headings beyond the account's free slots (the
    response marks them `rate_limited`, with no job), so the rest are submitted again until every heading is in."""
    frames, act = DACT[clip]
    tag = f'_{n}' if n else ''
    left = list(dirs); k = 0
    while left:
        s = state(); grp = RUMBLE_GROUP if clip == 'rumble' else s.get('driller', {}).get(clip)
        est = 2 * len(left); cap(est)
        body = {'mode': 'v3', 'animation_description': act, 'directions': left, 'frame_count': frames, 'display_name': f't5 {clip}'}
        if grp: body['animation_group_id'] = grp
        if replace: body['replace_existing'] = True
        name = f't5_driller_{clip}_' + '_'.join(d.replace('-', '') for d in left) + tag + (f'_r{k}' if k else '')
        e, r = pl.run(f'/objects/{DRILLER}/animations', body, name, estimate=est)
        grp = r['post'].get('animation_group_id') or grp
        s = state(); s.setdefault('driller', {})[clip] = grp; save_state(s)
        done = book_object_job(name, r['post'].get('submissions') or [])
        left = [d for d in left if d not in done]; k += 1
        if left: print(clip, 'still to do', left); time.sleep(60)
    print(clip, dirs, 'arrived', obj_dirs(grp), 'T5 spent', t5_spent())


def driller_retake(clip, dirs, n):
    """Redraw headings in the clip's own group (PixelLab's `replace_existing`; the object API has no heading delete)."""
    for dd in dirs:
        for f in (pl.HERE / 'assets' / 'driller' / 't5' / clip).glob(f'{dd}_*.png'): f.unlink()
    driller(clip, dirs, f'retake{n}', replace=True)


def driller_dl():
    """The object's frames, per t5 group, into assets/driller/t5/<clip>/<direction>_<i>.png (never rewritten)."""
    s = state().get('driller', {}); s['rumble'] = RUMBLE_GROUP
    d = pl.req('GET', f'/objects/{DRILLER}'); out = pl.HERE / 'assets' / 'driller' / 't5'
    for a in d.get('animations') or []:
        clip = next((c for c, g in s.items() if g == a.get('animation_group_id')), None)
        if not clip: continue
        for dd in a.get('directions') or []:
            fr = frames_of(dd)
            p = out / clip; p.mkdir(parents=True, exist_ok=True)
            if not fr or (p / f'{dd["direction"]}_0.png').exists(): continue
            for i, u in enumerate(fr):
                pl.fetch(u).save(p / f'{dd["direction"]}_{i}.png')
            print(clip, dd['direction'], len(fr))


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'create': create(sys.argv[2])
    elif cmd == 'anim': anim(sys.argv[2], sys.argv[3])
    elif cmd == 'dl': dl(sys.argv[2])
    elif cmd == 'retake': retake(sys.argv[2], sys.argv[3], sys.argv[4].split(','), sys.argv[5])
    elif cmd == 'driller': driller(sys.argv[2], D8 if sys.argv[3] == 'all' else sys.argv[3].split(','), sys.argv[4] if len(sys.argv) > 4 else None)
    elif cmd == 'driller-retake': driller_retake(sys.argv[2], sys.argv[3].split(','), sys.argv[4])
    elif cmd == 'driller-dl': driller_dl()
    elif cmd == 'spent': print('T5 usage', t5_spent(), 'balance diffs', t5_balance_diff(), 'balance now', pl.balance())
