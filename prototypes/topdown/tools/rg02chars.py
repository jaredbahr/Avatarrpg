"""RG-02 (Saltstep and Emberwatch): the region's figures. Veyra (the guest ally), the freight handler and the line
rigger (Sabi shares the rigger), and the six NPCs. Made as T5's sergeant and T8's heroes were (`t5clips.py`,
`t8heroes.py`): create-character-v3 at 48 px, 8 rotations, the mannequin template and seed 11; the clips are
skeleton-v3 from each figure's own base, 8 headings, pure body motion, what the hands hold named, no element words.
The NPCs get the residents' idle (`t10residents.py`) and the walking-8-frames template.
Every job is booked in ledger.json by pl.run under `rg02_`, tagged with the region (`saltstep_emberwatch`), so
ledger_audit.py totals the region's cost.
Usage (from prototypes/topdown):
  python3 tools/rg02chars.py create <who> [take]
  python3 tools/rg02chars.py anim <who> <clip>
  python3 tools/rg02chars.py retake <who> <clip> <dir,dir> <n>
  python3 tools/rg02chars.py dl <who>
  python3 tools/rg02chars.py spent"""
import json, os, re, sys
sys.path.insert(0, 'tools'); import pl

os.environ.setdefault('PIXELLAB_REGION', 'saltstep_emberwatch')
# The owner approved about 1,040 credits (+-50%) for the region's art on 2026-11-15: stop before 1,560.
CAP = 1560.0
D8 = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
S = json.load(open('style.json'))
WHO = ('veyra', 'handler', 'rigger', 'tavi', 'clerk', 'luli', 'bowlseller', 'freightclerk', 'cook')
FOLDER = {w: f'rg02_{w}' for w in WHO}
DESC = {
    # AN-01 (the bible): 46, a non-bender engineer; a practical dark-blue work coat with repaired cuffs, a
    # silver-threaded black braid, a carved wooden measuring rule from her mother. The script's pressure lance is a
    # long brass tube with a valve; she carries it upright like a staff.
    'veyra': 'Veyra, a woman engineer in her mid-forties, light brown skin, a calm direct face, a long black braid '
             'threaded with silver-grey strands hanging over her left shoulder, a practical dark-blue knee-length work '
             'coat with mended lighter-blue cuffs and the sleeves pushed up, a brown leather tool belt with a small '
             'carved wooden measuring rule tucked in it, dark grey trousers, sturdy brown work boots, holding a long '
             'brass pressure lance upright in her right hand like a staff, a thin metal tube as tall as her shoulder '
             'with a round valve wheel near the grip',
    # Jin's freight handlers at the Saltstep pontoon (the script: paid by the crate). Jin's crew colours (the sergeant):
    # charcoal and teal. A cargo hook, not the bandits' club; a square dock-worker build, not the ragged bandits.
    'handler': 'a dockside freight handler, a big broad-shouldered man in his thirties, tan skin, a shaved head, a '
               'short brown beard, a teal cloth band tied round his upper left arm, a sleeveless charcoal-grey canvas '
               'work vest over a cream undershirt, a wide brown leather back-brace belt, heavy canvas trousers rolled '
               'to the shin, rope-soled dark shoes, an iron cargo hook with a wooden handle in his right hand',
    # SF-2.1: laid-off line riggers, led by Sabi (one sheet for all of them). Lean climbers, cutters in hand.
    'rigger': 'a laid-off line rigger, a lean wiry woman in her thirties, light tan skin, black hair tied back under a '
              'faded red cloth cap, a padded mustard-yellow canvas work jacket with the sleeves rolled, a coil of rope '
              'slung across her chest, a brown leather climbing belt with iron rings, thick brown leather gloves, '
              'olive work trousers tucked into tall brown boots, a pair of long-handled wire cutters held in both hands',
    # NPC-09 Tavi Ren, they/them, 34, a non-bender ferry pilot.
    'tavi': 'Tavi Ren, a ferry pilot in their thirties, androgynous, sun-browned skin, short tousled black hair under '
            'a wide flat straw hat pushed back, a weathered sea-green sleeveless jacket over a white shirt with rolled '
            'sleeves, a coil of rope over one shoulder, a dark blue sash, loose grey trousers rolled to the calf, bare '
            'feet in rope sandals, a long wooden ferry pole held upright in the right hand',
    # The customs clerk (he carries most of MQ-02): a floating stall, a stool, a brass seal on a chain.
    'clerk': 'a harbour customs clerk, a fussy thin man in his fifties, light skin, round wire spectacles, a neat grey '
             'moustache, a flat dark blue official cap, a buttoned slate-blue clerk jacket with brass buttons, a big '
             'brass seal hanging on a chain round his neck, a sheaf of papers held in his left hand, dark trousers, '
             'black shoes',
    # NPC-12 Luli, she/her, 41, a lightningbender who keeps the public power lines.
    # The owner, 2026-11-15: the first take (`rg02_char_luli`) was too slim and too serious beside her portrait; this one
    # follows the portrait's build (`portrait.luli`). The owner again, the same day: its head came out about 40% bigger
    # than the party's (head:height 1/2.6 against their median 1/3.6, on the south idle cel), so this asks for adult
    # proportions with a small head and keeps the curls close to it. Not yet run: waiting for the owner's word.
    'luli': 'Luli, a line keeper, a broad, sturdy, heavy-set woman in her early forties, realistic adult proportions with '
            'a small head, the head about one sixth of her full height, wide shoulders and a thick waist, '
            'warm tan skin, a round cheerful face with a big open grin, short wild curly black hair kept close to the '
            'head, a dark soot smudge on one cheek, a red sleeveless work vest over a dark grey long-sleeved shirt, a thick '
            'brown leather apron over the vest, big heavy black work gloves on both hands, a ring of brass keys at the hip, '
            'dark brown trousers, heavy black boots',
    # The bowl-seller (Scene 2.2): two bowls of pepper broth, the custom of the second bowl. The first take
    # (`rg02_char_bowlseller`) drew steam off the bowl in every rotation: no steam, and an empty bowl.
    'bowlseller': 'a market broth seller, a small round elderly woman, brown skin, grey hair in a tight bun with a '
                  'wooden pin, a plum-purple wrap tunic with the sleeves tied back, a white cloth apron, loose dark '
                  'trousers, wooden clogs, holding an empty brown earthenware bowl in both hands in front of her, no steam',
    # Jin's office (Scenes 2.2, 2.8): a clean brass plate, Jin's crew colours.
    'freightclerk': 'a freight office clerk, a young woman in her twenties, pale skin, a neat black bob haircut, a '
                    'tidy charcoal-grey buttoned office coat with a teal collar and teal cuffs, a pencil behind one '
                    'ear, a ledger book held under her left arm, dark grey trousers, polished black shoes',
    # Emberwatch's retired cook (Scene 3.1): beans on the parade ground, the spear-rack trellis.
    'cook': 'a retired outpost cook, a stout old man in his sixties, ruddy brown skin, a bald head with white side '
            'hair, a bushy white moustache, a faded red short-sleeved cook\'s shirt with the old buttons, a stained '
            'cream apron, a wide straw sun hat hanging on his back, brown trousers, brown sandals, a small woven '
            'basket of dried beans in his left hand',
}
HANDS = {
    'veyra': 'the long brass lance stays in her right hand',
    'handler': 'the iron cargo hook stays in his right hand',
    'rigger': 'the long-handled wire cutters stay in her hands',
}
DROP = {
    'veyra': 'the long brass lance drops from her hands and lies beside her',
    'rigger': 'the wire cutters drop from her hands and lie beside her',
}
NOFX = 'nothing flies off, no particles, no dust, no blood, no glow, no light, no marks'
CLIPS = {
    # T5's prompts, word for word, so the region's fighters stand, flinch and fall like the rest of the cast
    'idle': (8, 'standing at rest in a ready stance: the chest rises and falls slowly, a slight weight shift, arms relaxed; no effects'),
    'hit': (6, 'a hit reaction: flinches from a blow to the chest, the shoulders and head jerk back, one short step back '
               'to keep balance, then straightens back into the same ready stance. Pure body motion: {hands}; ' + NOFX),
    'ko': (8, 'knocked out: staggers back one step, the knees give way, falls backward onto the ground and ends lying '
              'flat on the back, still. Pure body motion: {hands}; ' + NOFX),
    # T5's second knockout (`t5clips.py` `ko2`): the first group sat Veyra and the rigger up in the south heading, and a
    # retake keeps a group's motion, so a new group spells out the fall to full length and lets the tool go
    'ko2': (8, 'knocked out: staggers back one step, the knees give way, topples backward and falls flat onto the back, '
               'ending stretched out full length on the ground, legs straight, arms out, head on the ground, completely '
               'still; {drop}. Pure body motion; ' + NOFX),
    # the residents' idle (T3 guard, the v7 villagers, T10), word for word
    'npcidle': (12, 'standing at rest: the chest and shoulders rise and fall slowly and clearly, a gentle weight shift '
                    'from one hip to the other, arms relaxed at the sides; no vapour, no effects'),
}
# One pose per ability the game plays: body motion only, no element words, what the hands hold named.
ACTIONS = {
    'veyra': {
        'lance': 'a long spear-like thrust: grips the long brass lance in both hands, braces it level at the hip, steps '
                 'forward and drives it straight forward at chest height, arms extended, holds a moment, then pulls it '
                 'back and returns to a ready stance. Pure body motion: {hands}; ' + NOFX,
        'flare': 'a signal: raises the left arm straight up high above the head, the fist closed and pointing at the '
                 'sky, holds it there, then lowers the arm and returns to a ready stance. Pure body motion: {hands}; '
                 + NOFX,
    },
    'handler': {
        'attack': 'a heavy overhand swing: raises the iron cargo hook above the right shoulder, steps forward and '
                  'swings it down hard across the front, then recovers to a ready stance. Pure body motion: {hands}; '
                  + NOFX,
    },
    'rigger': {
        'attack': 'a quick two-handed lunge: steps forward and jabs the long-handled wire cutters straight forward at '
                  'chest height with both hands, then springs back to a ready stance. Pure body motion: {hands}; '
                  + NOFX,
    },
}
STATE = 'rg02/state.json'


def state():
    return json.load(open(STATE)) if os.path.exists(STATE) else {}


def save_state(s):
    """Merge into the file under a lock, so parallel jobs never drop each other's ids."""
    import fcntl
    os.makedirs('rg02', exist_ok=True)
    with open(str(pl.LEDGER) + '.lock', 'w') as lk:
        fcntl.flock(lk, fcntl.LOCK_EX); cur = state()
        for k, v in s.items():
            if isinstance(v, dict): cur.setdefault(k, {}).update(v)
            else: cur[k] = v
        tmp = STATE + '.tmp'; json.dump(cur, open(tmp, 'w'), indent=1, sort_keys=True); os.replace(tmp, STATE)


def rg02_spent():
    """Booked usage of every RG-02 job, whichever tool made it."""
    return sum((j.get('credits') or 0) for j in pl.ledger()['jobs'] if j['name'].startswith('rg02_'))


def cap(est):
    got = rg02_spent()
    if got + est > CAP: raise SystemExit(f'RG-02 cap: {got} spent, {est} more would pass {CAP}')


def cid(who):
    return json.load(open(f'assets/chars/{FOLDER[who]}/meta.json'))['id']


def create(who, take=''):
    cap(3)
    e, r = pl.run('/create-character-v3', {'description': DESC[who], 'image_size': {'width': 48, 'height': 48}, 'view': S['view'],
        'outline': S['character_outline'], 'detail': S['detail'], 'template_id': 'mannequin', 'seed': 11,
        'name': f'RG-02 {who}'}, f'rg02_char_{who}{take}', estimate=3)
    c = (r['final'].get('last_response') or {}).get('character_id') or r['post'].get('character_id')
    out = pl.HERE / 'assets' / 'chars' / FOLDER[who]; out.mkdir(parents=True, exist_ok=True)
    mp = out / 'meta.json'
    if take or not mp.exists():
        for f in out.glob('*.png'): f.unlink()
        json.dump({'id': c, 'size': None, 'rot': {}, 'anims': {}}, open(mp, 'w'), indent=1)
    dl(who); print(who, c)


def body_for(who, clip, dirs):
    if clip == 'walk':
        return {'character_id': cid(who), 'template_animation_id': 'walking-8-frames', 'mode': 'skeleton-v3', 'directions': dirs}
    frames, act = CLIPS[clip] if clip in CLIPS else (10, ACTIONS[who][clip])
    return {'character_id': cid(who), 'mode': 'skeleton-v3', 'action_description': act.format(hands=HANDS.get(who, ''), drop=DROP.get(who, '')),
            'frame_count': frames, 'directions': dirs}


def anim(who, clip, take=''):
    est = 3 * len(D8) + 1; cap(est)
    body = body_for(who, clip, D8); name = f'rg02_{who}{take}_{clip}'
    e, r = pl.run('/characters/animations', body, name, estimate=est)
    grp = r['post']['animation_group_id']
    save_state({'groups': {f'{who}.{clip}': grp}})
    got = r['post'].get('directions') or D8; rest = [d for d in D8 if d not in got]
    if rest:
        pl.run('/characters/animations', dict(body, directions=rest, animation_group_id=grp), name + '_rest',
               estimate=3 * len(rest) + 1)
    print(who, clip, 'RG-02 spent', rg02_spent())


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
    e, r = pl.run('/characters/animations', body, f'rg02_{who}_{clip}_retake{n}', estimate=est)
    got = r['post'].get('directions') or dirs; rest = [d for d in dirs if d not in got]
    if rest:
        pl.run('/characters/animations', dict(body, directions=rest), f'rg02_{who}_{clip}_retake{n}_rest',
               estimate=3 * len(rest) + 1)
    dl(who); print(who, clip, 'retook', dirs, 'RG-02 spent', rg02_spent())


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
    elif cmd == 'anim': anim(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else '')
    elif cmd == 'dl': dl(sys.argv[2])
    elif cmd == 'retake': retake(sys.argv[2], sys.argv[3], sys.argv[4].split(','), sys.argv[5])
    elif cmd == 'spent': print('RG-02 usage', rg02_spent(), 'balance now', pl.balance())
