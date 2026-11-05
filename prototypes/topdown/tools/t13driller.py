"""The Driller: 8 views from the accepted south-facing pro-flash image (first_frame: only the rotations are charged), then
v3 object animations (a rumbling idle and the slam). Usage: t13driller.py rot | anim <clip> <dirs> | dl"""
import sys, json, io, zipfile, urllib.request, os; sys.path.insert(0, 'tools'); import pl
from PIL import Image
S = json.load(open('style.json')); F = 't13/driller.json'
st = json.load(open(F)) if os.path.exists(F) else {}
DESC = ('a mecha-driller boss machine: a boxy rust-orange riveted iron body on two broad dark caterpillar treads, a small open driver cabin on top with a stout scowling bald man at two levers, '
        'a thick riveted arm at the front ending in a big steel spiral drill bit, a short smoking exhaust pipe, oil stains, a split black hose')
ACT = {'idle': 'the engine idles: the whole machine shudders and rumbles slightly on its treads, the drill bit spins slowly, the driver bobs; it stays in place',
       'slam': 'the drill arm rears up high, then slams down hard onto the ground in front, the whole machine lurching forward, then the arm lifts back to rest'}
cmd = sys.argv[1]
if cmd == 'rot':
    body = {'description': DESC, 'view': 'low top-down', 'n_directions': 8, 'first_frame': pl.b64('t13/obj/driller_big_5.png'), 'seed': 5}
    e, r = pl.run('/create-object-pro-flash', body, 't13_driller_big_rot8', estimate=30)
    lr = r['final'].get('last_response') or r['final']; st['object_id'] = lr.get('object_id') or r['post'].get('object_id'); json.dump(st, open(F, 'w'), indent=1); print(st, list(lr.keys()))
if cmd == 'anim':
    clip, dirs = sys.argv[2], sys.argv[3].split(',')
    body = {'mode': 'v3', 'animation_description': ACT[clip], 'directions': dirs, 'frame_count': 8 if clip == 'idle' else 10, 'display_name': clip}
    if st.get(clip): body['animation_group_id'] = st[clip]
    e, r = pl.run(f"/objects/{st['object_id']}/animations", body, f't13_driller_{clip}_' + '_'.join(d.replace('-', '') for d in dirs), estimate=8 * len(dirs))
    st[clip] = r['post'].get('animation_group_id') or st.get(clip); json.dump(st, open(F, 'w'), indent=1); print(clip, st)
if cmd == 'dl':
    d = pl.req('GET', f"/objects/{st['object_id']}"); json.dump(pl.strip(d), open('t13/driller_obj.json', 'w'), indent=1)
    req = urllib.request.Request(pl.API.replace('/v2', '') + f"/mcp/objects/{st['object_id']}/download", headers={'Authorization': 'Bearer ' + os.environ['PIXELLAB_API_KEY']})
    data = urllib.request.urlopen(req, timeout=120).read(); os.makedirs('assets/driller', exist_ok=True)
    try:
        z = zipfile.ZipFile(io.BytesIO(data))
        for n in z.namelist():
            safe = ''.join(c if c.isalnum() or c in '._-/' else '_' for c in n)
            p = os.path.join('assets/driller', safe.replace('/', '__'))
            if not n.endswith('/'): open(p, 'wb').write(z.read(n))
        print('zip', len(z.namelist()), z.namelist()[:12])
    except zipfile.BadZipFile:
        open('assets/driller/south.png', 'wb').write(data); print('png', len(data))
