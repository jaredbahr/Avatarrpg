"""Minimal PixelLab v2 client with a ledger (copied from ba-dan-route-a/tools). Never prints the key."""
import base64, hashlib, io, json, os, time, urllib.request, urllib.error
from PIL import Image
API = 'https://api.pixellab.ai/v2'
RA = os.environ.get('FOREST_G1_WORK', '.review/forest-g1')
# Output 0 of every job is committed here, so the tools re-run from the repository without calling PixelLab.
JOBS = 'art/source/forest-road-g1/jobs'
LEDGER = os.environ.get('FOREST_G1_LEDGER', 'art/source/forest-road-g1/ledger.json')
import threading
_lock = threading.Lock()

def _req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(API + path, data=data, method=method, headers={
        'Authorization': 'Bearer ' + os.environ['PIXELLAB_API_KEY'], 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(r, timeout=300) as f:
            return json.loads(f.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f'{e.code} {e.read()[:800]!r}')

def balance():
    return _req('GET', '/balance')['subscription']['generations']

def b64(img_or_path):
    if isinstance(img_or_path, str):
        img = Image.open(img_or_path)
    else:
        img = img_or_path
    buf = io.BytesIO(); img.save(buf, 'PNG'); raw = buf.getvalue()
    return {'type': 'base64', 'base64': base64.b64encode(raw).decode(), 'format': 'png'}, hashlib.sha256(raw).hexdigest()[:16]

def _strip(o, refs):
    if isinstance(o, dict):
        if o.get('type') == 'base64' and 'base64' in o:
            h = hashlib.sha256(base64.b64decode(o['base64'])).hexdigest()[:16]
            return {'base64': f'<{refs.get(h, "sha256:" + h)}>'}
        return {k: _strip(v, refs) for k, v in o.items()}
    if isinstance(o, list):
        return [_strip(v, refs) for v in o]
    return o

def _images(o, out):
    if isinstance(o, dict):
        if 'base64' in o and isinstance(o['base64'], str) and len(o['base64']) > 100:
            out.append(Image.open(io.BytesIO(base64.b64decode(o['base64']))))
            return
        for k, v in o.items():
            if k in ('image_url', 'url') and isinstance(v, str) and v.startswith('http'):
                with urllib.request.urlopen(v, timeout=120) as f:
                    out.append(Image.open(io.BytesIO(f.read())))
            else:
                _images(v, out)
    elif isinstance(o, list):
        for v in o:
            _images(v, out)

def run(endpoint, payload, tag, refs=None, notes=''):
    """refs: sha16 -> input filename, for the ledger."""
    if os.path.exists(LEDGER):
        for e in json.load(open(LEDGER))['jobs']:
            if e['tag'] == tag and e['status'] == 'completed' and e['outputs'] and os.path.exists(f'{JOBS}/{e["outputs"][0]}'):
                print(tag, 'cached'); return [Image.open(f'{JOBS}/{e["outputs"][0]}')]
    before = balance()
    t0 = time.time()
    for attempt in range(60):
        try:
            resp = _req('POST', endpoint, payload); break
        except RuntimeError as err:
            if not str(err).startswith('429'): raise
            time.sleep(15)
    job = resp.get('background_job_id')
    last = resp
    status = resp.get('status')
    while job:
        time.sleep(6)
        j = _req('GET', f'/background-jobs/{job}')
        status = j.get('status')
        if status in ('completed', 'failed', 'error', 'cancelled'):
            last = j
            break
        if time.time() - t0 > 900:
            status = 'timeout'; last = j; break
    imgs = []
    _images(last.get('last_response', last), imgs)
    files = []
    for i, im in enumerate(imgs):
        p = f'{RA}/jobs/{tag}-{i}.png'
        os.makedirs(os.path.dirname(p), exist_ok=True)
        im.save(p); files.append(os.path.basename(p))
        if i == 0: im.save(f'{JOBS}/{tag}-0.png')
    after = balance()
    used = (last.get('usage') or {}).get('generations') if isinstance(last, dict) else None
    entry = {'tag': tag, 'endpoint': endpoint, 'job_id': job, 'status': status,
             'request': _strip(payload, refs or {}), 'outputs': files,
             'balance_before': before, 'balance_after': after, 'gens': used, 'balance_note': 'balance is account-wide (another session spends concurrently); gens is the job usage',
             'seconds': round(time.time() - t0), 'notes': notes, 'verdict': None,
             'error': None if status == 'completed' else json.dumps(last)[:600]}
    import fcntl
    with _lock, open(LEDGER + '.lock', 'w') as lk:
        fcntl.flock(lk, fcntl.LOCK_EX)  # several tools may run at once
        led = json.load(open(LEDGER)) if os.path.exists(LEDGER) else {'jobs': []}
        led['jobs'].append(entry)
        led['total_gens'] = sum((j.get('gens') or 0) for j in led['jobs'])
        json.dump(led, open(LEDGER, 'w'), indent=1)
    print(tag, status, 'gens', entry['gens'], 'files', files, entry['error'] or '')
    return [Image.open(f'{RA}/jobs/{f}') for f in files]  # noqa
