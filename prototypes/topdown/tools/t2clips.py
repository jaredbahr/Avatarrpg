"""ADR 0104 T2: a hit reaction and a knockout for each combat character, posed by skeleton-v3 from the character's
own base (8 headings, short, no painted effects). Every job is booked in ledger.json by pl.run.
Per art-lessons.md: pure body motion, no element words, and say what the hands hold.
Usage (from prototypes/topdown): python3 tools/t2clips.py anim <who> <hit|ko> | retake <who> <hit|ko> <dir,dir> <n>
       | dl <who> | spent"""
import json, os, re, sys
sys.path.insert(0, 'tools'); import pl

CAP = 400.0   # T2's PixelLab budget (orchestrator, 2026-11-06)
D8 = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
FOLDER = {'kaya': 'kaya2', 'sura': 'fc_sura', 'bo': 'fc_bo', 'thug': 'fc_thug', 'slinger': 'fc_slinger', 'bruiser': 'fc_bruiser'}
HANDS = {
    'kaya': 'her hands are plain and empty',
    'sura': 'her hands are plain and empty',
    'bo': 'his hands are plain and empty',
    'thug': 'the wooden club stays in his hand',
    'slinger': 'the leather sling stays in his hand',
    'bruiser': 'the heavy cudgel stays in his hands',
}
NOFX = 'nothing flies off, no particles, no dust, no blood, no glow, no light, no marks'
CLIPS = {
    # short: a flinch and back to the guard it started from
    'hit': (6, 'a hit reaction: flinches from a blow to the chest, the shoulders and head jerk back, one short step back '
               'to keep balance, then straightens back into the same ready stance. Pure body motion: {hands}; ' + NOFX),
    'ko': (8, 'knocked out: staggers back one step, the knees give way, falls backward onto the ground and ends lying '
              'flat on the back, still. Pure body motion: {hands}; ' + NOFX),
}


def t2_spent():
    return sum((j.get('credits') or 0) for j in pl.ledger()['jobs'] if j['name'].startswith('t2_'))


def t2_balance_diff():
    return sum((j.get('balance_diff') or 0) for j in pl.ledger()['jobs'] if j['name'].startswith('t2_'))


def anim(who, clip):
    base = re.sub(r'\d+$', '', clip)
    frames, act = CLIPS[base]
    cid = json.load(open(f'assets/chars/{FOLDER[who]}/meta.json'))['id']
    est = 3 * len(D8) + 1
    if t2_spent() + est > CAP: raise SystemExit(f'T2 cap: {t2_spent()} spent, {est} more would pass {CAP}')
    body = {'character_id': cid, 'mode': 'skeleton-v3', 'action_description': act.format(hands=HANDS[who]),
            'frame_count': frames, 'directions': D8}
    name = f't2_{who}_{clip}'
    e, r = pl.run('/characters/animations', body, name, estimate=est)
    got = r['post'].get('directions') or D8; rest = [d for d in D8 if d not in got]
    if rest:
        pl.run('/characters/animations', dict(body, directions=rest, animation_group_id=r['post']['animation_group_id']),
               name + '_rest', estimate=3 * len(rest) + 1)
    print(who, clip, 'T2 spent', t2_spent())


def retake(who, clip, dirs, n):
    """Redraw some headings of a clip in its own animation group (the same 3D motion): the old headings are deleted
    on PixelLab and on disk first, then generated again and merge-downloaded. `n` numbers the retake in the ledger."""
    mp = pl.HERE / 'assets' / 'chars' / FOLDER[who] / 'meta.json'; meta = json.load(open(mp))
    pre = {'hit': 'custom-a hit reaction', 'ko': 'custom-knocked out'}[clip]
    key = next(k for k in meta['anims'] if k.startswith(pre))
    d = pl.req('GET', f'/characters/{meta["id"]}')
    grp = next(a['animation_group_id'] for a in d['animations'] if a['animation_type'] + '@' + a['animation_group_id'][:6] == key)
    est = 3 * len(dirs) + 1
    if t2_spent() + est > CAP: raise SystemExit(f'T2 cap: {t2_spent()} spent, {est} more would pass {CAP}')
    for dd in dirs:
        try: pl.req('DELETE', f'/characters/{meta["id"]}/animations/{grp}/directions/{dd}')
        except (json.JSONDecodeError, RuntimeError): pass   # 204: no body; 404: the heading never arrived
        for f in meta['anims'][key].pop(dd, []): (mp.parent / f).unlink(missing_ok=True)
    json.dump(meta, open(mp, 'w'), indent=1)
    frames, act = CLIPS[clip]
    body = {'character_id': meta['id'], 'mode': 'skeleton-v3', 'action_description': act.format(hands=HANDS[who]),
            'frame_count': frames, 'directions': dirs, 'animation_group_id': grp}
    pl.run('/characters/animations', body, f't2_{who}_{clip}_retake{n}', estimate=est)
    dl(who); print(who, clip, 'retook', dirs, 'T2 spent', t2_spent())


SAFE = re.compile(r'[^A-Za-z0-9._-]+')


def dl(who):
    """Merge-download (as t13chars.dl): new groups and headings are added; frames already on disk are never rewritten."""
    out = pl.HERE / 'assets' / 'chars' / FOLDER[who]
    mp = out / 'meta.json'; meta = json.load(open(mp))
    d = pl.req('GET', f'/characters/{meta["id"]}'); added = 0
    for a in d.get('animations') or []:
        t = a['animation_type'] + '@' + a['animation_group_id'][:6]
        for dd in a['directions']:
            if dd['direction'] in meta['anims'].get(t, {}): continue
            fs = []
            for i, u in enumerate(dd['frames']):
                f = SAFE.sub('_', f'{t}_{dd["direction"]}_{i}.png'); pl.fetch(u).save(out / f); fs.append(f)
            meta['anims'].setdefault(t, {})[dd['direction']] = fs; added += 1
    json.dump(meta, open(mp, 'w'), indent=1); print(who, 'added', added, 'headings')


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'anim': anim(sys.argv[2], sys.argv[3])
    elif cmd == 'dl': dl(sys.argv[2])
    elif cmd == 'retake': retake(sys.argv[2], sys.argv[3], sys.argv[4].split(','), sys.argv[5])
    elif cmd == 'spent': print('T2 usage', t2_spent(), 'balance diffs', t2_balance_diff(), 'balance now', pl.balance())
