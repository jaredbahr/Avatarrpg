import json,sys
cand,d=sys.argv[1:3]
r=json.load(open(f'kp/{cand}-{d}.json'))
cf=json.load(open(r'D:/AvatarRPG-tools/models-p0p1/thug/work/call-walk-east.json'))
def c(L): return [dict(label=j['label'],x=j['x'],y=j['y'],z_index=j['z_index']) for j in L]
print(json.dumps(c(r['frames'][0]),separators=(',',':')))
print(json.dumps([c(f) for f in r['frames'][1:]],separators=(',',':')))
