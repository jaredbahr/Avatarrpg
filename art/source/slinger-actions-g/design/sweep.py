import sys, numpy as np
sys.dont_write_bytecode = True
sys.path.insert(0, '.')
import ko, design
cap = {}
ko.finish = lambda cand, d, spec, pxs, dps, s: cap.update(p=pxs)
import io, contextlib
base = design.CLIPS['ko-lic']
for d in ('south-east', 'south-west', 'north-east', 'north-west'):
    out = []
    for t in range(-90, 91, 15):
        for rt in (1.0, 0.7):
            design.CLIPS['ko-lic'] = dict(base, turn_per_frame=[0, 0, t*0.2, t*0.5, t*0.8, t, t], root_travel=rt)
            with contextlib.redirect_stdout(io.StringIO()): ko.build('ko-lic', d)
            a = np.array([v for P in cap['p'] for v in P.values()]); lo, hi = a.min(0), a.max(0)
            ok = lo.min() >= 10 and hi.max() <= 182
            last = np.array(list(cap['p'][-1].values())); ext = last.max(0) - last.min(0)
            out.append((t, rt, ok, tuple(np.round(lo)), tuple(np.round(hi)), tuple(np.round(ext))))
    print(d)
    for o in out:
        if o[2]: print('  ', o)
