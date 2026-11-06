"""Object animations queue one job per direction and return at once, so pl.run logged 0 credits: poll each submission's job and
book its own usage (generations) on the ledger entry."""
import sys, json, time; sys.path.insert(0, 'tools'); import pl, fcntl
for name in sys.argv[1:]:
    r = json.load(open(pl.RAW / name / 'response.json')); subs = r['post'].get('submissions') or []
    total = 0; st = []
    for s in subs:
        j = pl.poll(s['background_job_id'], time.time(), limit=900); u = (j.get('usage') or {}).get('generations')
        if u is None: u = ((j.get('last_response') or {}).get('billing_usage') or {}).get('generations') or 0
        total += u; st.append((s['direction'], j.get('status'), u))
    with open(str(pl.LEDGER) + '.lock', 'w') as lk:
        fcntl.flock(lk, fcntl.LOCK_EX); L = pl.ledger(); e = next(x for x in L['jobs'] if x['name'] == name)
        e['credits'] = total; e['credit_source'] = 'usage (per-direction jobs, polled after)'; e['status'] = 'completed' if all(x[1] == 'completed' for x in st) else 'partial'; pl.save(L)
    print(name, total, st)
