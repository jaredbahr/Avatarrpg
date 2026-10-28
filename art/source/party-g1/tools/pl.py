"""Minimal PixelLab v2 client that writes every job to ../ledger.json. Never prints the key.

run(endpoint, payload, name, inputs=..., notes=...) posts, polls the background job, saves the images to ../raw/<name>/NN.png
and appends {name, endpoint, job, settings (images replaced by their input names), inputs, gens, balance, secs, status,
outputs, verdict: null}. A name the ledger already holds as completed with its files on disk is returned from disk, so a
rerun never pays twice. Verdicts are filled in by hand after review (tools/verdict.py).
"""
import base64, fcntl, io, json, os, threading, time, urllib.error, urllib.request
from pathlib import Path
from PIL import Image

API = 'https://api.pixellab.ai/v2'
HERE = Path(__file__).resolve().parent.parent
LEDGER = HERE / 'ledger.json'
RAW = HERE / 'raw'
_lock = threading.Lock()


def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(API + path, data=data, method=method, headers={
        'Authorization': 'Bearer ' + os.environ['PIXELLAB_API_KEY'], 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(r, timeout=300) as f:
            return json.loads(f.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f'{e.code} {e.read()[:800]!r}')


def balance():
    return req('GET', '/balance')['subscription']['generations']


def b64(im):
    if isinstance(im, (str, Path)): im = Image.open(im)
    buf = io.BytesIO(); im.save(buf, 'PNG')
    return {'type': 'base64', 'base64': base64.b64encode(buf.getvalue()).decode(), 'format': 'png'}


def _strip(o):
    if isinstance(o, dict):
        if 'base64' in o: return '<png>'
        return {k: _strip(v) for k, v in o.items()}
    if isinstance(o, list):
        if o and isinstance(o[0], list): return f'<{len(o)} frames>'
        if o and isinstance(o[0], dict) and 'label' in o[0]: return f'<{len(o)} joints>'
        return [_strip(v) for v in o]
    return o


def _fetch(url):
    # the file host refuses Python's default user agent (403), so name one
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'party-g1/1'}), timeout=120) as f: return Image.open(io.BytesIO(f.read())).convert('RGBA')


def _images(o, out):
    if isinstance(o, dict):
        if isinstance(o.get('base64'), str) and len(o['base64']) > 100:
            out.append(Image.open(io.BytesIO(base64.b64decode(o['base64']))).convert('RGBA')); return
        for k, v in o.items():
            if k in ('image_url', 'url') and isinstance(v, str) and v.startswith('http'): out.append(_fetch(v))
            else: _images(v, out)
    elif isinstance(o, list):
        for v in o: _images(v, out)


def ledger():
    return json.load(open(LEDGER)) if LEDGER.exists() else {'task': 'party-g1 (issue #284): the party at native G1', 'jobs': []}


def append(entry):
    """Append one job under a cross-process lock and replace the file atomically, so parallel runs never lose or tear a line."""
    with _lock, open(str(LEDGER) + '.lock', 'w') as lk:
        fcntl.flock(lk, fcntl.LOCK_EX)
        L = ledger(); L['jobs'].append(entry)
        tmp = str(LEDGER) + '.tmp'; json.dump(L, open(tmp, 'w'), indent=1); os.replace(tmp, LEDGER)


def cached(name):
    for e in ledger()['jobs']:
        if e['name'] == name and e['status'] == 'completed' and e.get('outputs') and all((RAW / name / f).exists() for f in e['outputs']):
            return e
    return None


def run(endpoint, payload, name, inputs=None, notes=''):
    e = cached(name)
    if e:
        print(name, 'cached'); return [Image.open(RAW / name / f) for f in e['outputs']], e
    before = balance(); t0 = time.time()
    for _ in range(80):
        try: resp = req('POST', endpoint, payload); break
        except RuntimeError as err:
            if not str(err).startswith('429'): raise
            time.sleep(15)
    job = resp.get('background_job_id'); last = resp; status = resp.get('status', 'completed')
    while job:
        time.sleep(6)
        try: j = req('GET', f'/background-jobs/{job}')
        except RuntimeError: continue
        status = j.get('status')
        if status in ('completed', 'failed', 'error', 'cancelled'): last = j; break
        if time.time() - t0 > 3600: status = 'timeout'; last = j; break
    lr = last.get('last_response', last) if isinstance(last, dict) else {}
    char_id = (lr or {}).get('character_id') or resp.get('character_id')
    imgs = []
    if endpoint.startswith('/create-character') and char_id and status == 'completed':
        d = req('GET', f'/characters/{char_id}')
        for k in ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']:
            imgs.append(_fetch(d['rotation_urls'][k]))
    else:
        _images(lr, imgs)
    (RAW / name).mkdir(parents=True, exist_ok=True); files = []
    for i, im in enumerate(imgs):
        f = f'{i:02d}.png'; im.save(RAW / name / f); files.append(f)
    usage = (last.get('usage') or (lr or {}).get('usage') or {}) if isinstance(last, dict) else {}
    entry = {'name': name, 'endpoint': endpoint, 'job': job, 'character_id': char_id, 'status': status,
             'settings': _strip(payload), 'inputs': inputs or {}, 'outputs': files,
             'gens': usage.get('generations'), 'balance_before': before, 'balance_after': balance(),
             'secs': round(time.time() - t0), 'notes': notes, 'verdict': None,
             'error': None if status == 'completed' else json.dumps(last)[:600]}
    append(entry)
    print(name, status, 'gens', entry['gens'], 'files', len(files), entry['error'] or '')
    return [Image.open(RAW / name / f) for f in files], entry


def recover_character(name, char_id, endpoint, settings, inputs, notes):
    """Ledger a create-character job whose download failed after it was billed: fetch the rotations by character id.
    The background job id was lost with the crash, so `job` and `gens` are null and the note says so."""
    d = req('GET', f'/characters/{char_id}')
    (RAW / name).mkdir(parents=True, exist_ok=True); files = []
    for i, k in enumerate(['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']):
        f = f'{i:02d}.png'; _fetch(d['rotation_urls'][k]).save(RAW / name / f); files.append(f)
    entry = {'name': name, 'endpoint': endpoint, 'job': None, 'character_id': char_id, 'status': 'completed', 'settings': settings,
             'inputs': inputs, 'outputs': files, 'gens': None, 'balance_before': None, 'balance_after': balance(), 'secs': None,
             'notes': notes, 'verdict': None, 'error': None}
    append(entry)
    print(name, 'recovered', len(files))


def recover_job(name):
    """Collect a billed job the ledger holds as timed out (the queue ran past the poll), by its job id; never pays again."""
    L = ledger(); e = next(j for j in L['jobs'] if j['name'] == name and j['status'] == 'timeout' and j.get('job'))
    j = req('GET', f"/background-jobs/{e['job']}")
    if j.get('status') != 'completed': print(name, 'still', j.get('status')); return None
    lr = j.get('last_response', j); imgs = []; _images(lr, imgs)
    (RAW / name).mkdir(parents=True, exist_ok=True); files = []
    for i, im in enumerate(imgs):
        f = f'{i:02d}.png'; im.save(RAW / name / f); files.append(f)
    usage = j.get('usage') or (lr or {}).get('usage') or {}
    append(dict(e, status='completed', outputs=files, gens=usage.get('generations', e.get('gens')), error=None,
                notes=(e.get('notes') or '') + '; collected after the poll timed out (recover_job)'))
    print(name, 'recovered', len(files)); return files
