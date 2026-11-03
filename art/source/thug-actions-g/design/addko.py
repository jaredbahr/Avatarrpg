"""addko.py : adds the knockout candidate ko-lic to clips.json (CMU 90_18, the party's fall)."""
import json
c = json.load(open('clips.json'))
c['ko-lic'] = {
    "kind": "ko", "clip": "90_18", "ref": 64, "amp": 1.0, "frames": ["stance", 86, 100, 112, 128, 142, 170],
    "ms": [40, 80, 60, 50, 110, 90, 400], "keys": {"K1": 1, "K2": 2, "K3": 4, "K4": 6},
    "roles": {"K1": "hit: knocked off balance", "K2": "falling back, feet leaving", "K3": "ground impact",
              "K4": "lying on his back (last frame, holds)"},
    "absw": [0, 0, 0.25, 0.5, 0.8, 1, 1], "action": "knocked down, falling backwards",
    "attribution": "motion: CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu), subject 90 trial 18, frames 64-170; "
                   "retargeted onto the thug's own stance. Licence: CMU mocap is free to use for any purpose, including "
                   "commercial products and games; credit requested ('The data used in this project was obtained from "
                   "mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.')"}
json.dump(c, open('clips.json', 'w'), indent=1)
