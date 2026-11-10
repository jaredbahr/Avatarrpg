"""Tiny PixelLab v2 client for the top-down demo. Writes every job to ../ledger.json. Never prints the key."""
import fcntl, base64, io, json, os, time, urllib.error, urllib.request
from pathlib import Path
from PIL import Image

API = 'https://api.pixellab.ai/v2'
HERE = Path(__file__).resolve().parent.parent
LEDGER = HERE / 'ledger.json'
RAW = HERE / 'raw'
BUDGET = 6120.0   # 4,370 through T5, plus T8's 1,750 for the seven heroes (owner, 2026-11-10); t8heroes.py's CAP is the real guard


def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(API + path, data=data, method=method, headers={
        'Authorization': 'Bearer ' + os.environ['PIXELLAB_API_KEY'], 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(r, timeout=300) as f:
            return json.loads(f.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f'{e.code} {e.read()[:1500]!r}')


def balance():
    return req('GET', '/balance')['subscription']['generations']


def b64(im):
    if isinstance(im, (str, Path)): im = Image.open(im)
    buf = io.BytesIO(); im.save(buf, 'PNG')
    return {'type': 'base64', 'base64': base64.b64encode(buf.getvalue()).decode(), 'format': 'png'}


def strip(o):
    if isinstance(o, dict):
        if isinstance(o.get('base64'), str): return '<png>'
        return {k: strip(v) for k, v in o.items()}
    if isinstance(o, list): return [strip(v) for v in o[:64]]
    if isinstance(o, str) and len(o) > 300: return o[:80] + '...'
    return o


def fetch(url, tries=8):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'topdown-demo/1'}), timeout=120) as f:
                return Image.open(io.BytesIO(f.read())).convert('RGBA')
        except (urllib.error.URLError, OSError) as e:
            if i == tries - 1: raise
            time.sleep(3 + 3 * i)


def images(o, out):
    if isinstance(o, dict):
        if isinstance(o.get('base64'), str) and len(o['base64']) > 100:
            out.append(Image.open(io.BytesIO(base64.b64decode(o['base64']))).convert('RGBA')); return
        for k, v in o.items():
            if isinstance(v, str) and v.startswith('http') and k.endswith('url'): out.append(fetch(v))
            else: images(v, out)
    elif isinstance(o, list):
        for v in o: images(v, out)


def ledger():
    return json.load(open(LEDGER)) if LEDGER.exists() else {'task': 'top-down village demo', 'budget': BUDGET, 'start_balance': None, 'jobs': []}


def save(L):
    tmp = str(LEDGER) + '.tmp'; json.dump(L, open(tmp, 'w'), indent=1); os.replace(tmp, LEDGER)


def spent():
    L = ledger(); return sum((j.get('credits') or 0) for j in L['jobs'])


def cached(name):
    for e in ledger()['jobs']:
        if e['name'] == name and e['status'] == 'completed':
            return e
    return None


def poll(job, t0, limit=1800):
    while True:
        time.sleep(5)
        try: j = req('GET', f'/background-jobs/{job}')
        except (RuntimeError, OSError): continue
        s = j.get('status')
        if s in ('completed', 'failed', 'error', 'cancelled'): return j
        if time.time() - t0 > limit: return dict(j, status='timeout')


def finish(name, jobs):
    """Re-poll a ledger entry that was recorded before its jobs finished."""
    L = ledger(); e = next(x for x in L['jobs'] if x['name'] == name)
    rs = [poll(j, time.time()) for j in jobs]
    last = {'status': 'completed' if all(x.get('status') == 'completed' for x in rs) else 'failed', 'jobs': rs}
    r = json.load(open(RAW / name / 'response.json')); r['final'] = strip(last)
    json.dump(r, open(RAW / name / 'response.json', 'w'), indent=1)
    after = balance(); e['credits'] = round(e['balance_before'] - after, 2); e['balance_after'] = after; e['status'] = last['status']; e['job'] = jobs
    save(L); print(name, e['status'], e['credits']); return last


def run(endpoint, payload, name, notes='', estimate=0, method='POST'):
    """Post, poll, save raw json + images under raw/<name>/. Returns (entry, response)."""
    e = cached(name)
    if e:
        print(name, 'cached'); return e, json.load(open(RAW / name / 'response.json'))
    if spent() + estimate > BUDGET: raise SystemExit(f'budget: {spent()} spent, {estimate} more would pass {BUDGET}')
    L = ledger()
    before = balance()
    t0 = time.time()
    for _ in range(60):
        try: resp = req(method, endpoint, payload); break
        except RuntimeError as err:
            if not str(err).startswith('429'): raise
            time.sleep(10)
    job = resp.get('background_job_id'); last = resp
    jobs = resp.get('background_job_ids') or []
    if job: last = poll(job, t0)
    elif jobs:
        rs = [poll(j, t0) for j in jobs]
        st = 'completed' if all(x.get('status') == 'completed' for x in rs) else next(x.get('status') for x in rs if x.get('status') != 'completed')
        last = {'status': st, 'jobs': rs, 'usage': {'generations': sum(((x.get('usage') or {}).get('generations') or 0) for x in rs)}}
        job = jobs
    (RAW / name).mkdir(parents=True, exist_ok=True)
    json.dump({'post': strip(resp), 'final': strip(last)}, open(RAW / name / 'response.json', 'w'), indent=1)
    time.sleep(2)
    after = balance()
    def gens(x):
        for k in ('usage', 'billing_usage'):
            u = (x or {}).get(k) or {}
            if u.get('type') == 'generations' and u.get('generations') is not None: return u['generations']
        lr = (x or {}).get('last_response') or {}
        u = lr.get('billing_usage') or {}
        return u.get('generations') if u.get('type') == 'generations' else None
    g = gens(last)
    if g is None and last.get('jobs'):
        gs = [gens(x) for x in last['jobs']]; g = sum(gs) if all(v is not None for v in gs) else None
    credits = g if g is not None else round(before - after, 2)
    src = 'usage' if g is not None else 'balance_diff (another consumer shares this key; may be inflated)'
    entry = {'name': name, 'endpoint': endpoint, 'job': job, 'status': last.get('status', 'completed'),
             'settings': strip(payload), 'credits': credits, 'credit_source': src, 'balance_diff': round(before - after, 2), 'usage': strip(last.get('usage')),
             'balance_before': before, 'balance_after': after, 'secs': round(time.time() - t0), 'notes': notes,
             'ids': {k: resp.get(k) for k in resp if k.endswith('_id')}}
    with open(str(LEDGER) + '.lock', 'w') as lk:
        fcntl.flock(lk, fcntl.LOCK_EX); L = ledger(); L['jobs'].append(entry); save(L)
    print(name, entry['status'], 'credits', entry['credits'], 'total', round(spent(), 1))
    return entry, {'post': resp, 'final': last}


def save_images(name, obj, prefix=''):
    imgs = []; images(obj, imgs)
    (RAW / name).mkdir(parents=True, exist_ok=True)
    for i, im in enumerate(imgs): im.save(RAW / name / f'{prefix}{i:02d}.png')
    return imgs
