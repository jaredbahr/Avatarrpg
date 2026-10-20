# Thug action skeleton design

`design.py CAND DIR...` retargets CMU mocap (local copies under the hand-off's `work/mocap*`, read only) onto the thug's own
approved rotation skeleton (`src_joints.json` of the hand-off) and writes `kp/<cand>-<dir>.json` plus a preview sheet under
`prev/` (not kept). `ko.py` is the knockout twin: it lifts the stance into the facing's character space and rotates every bone
as the party's `design_hk` does, with an absolute-direction blend (`absw`), a per-frame heading turn and a root travel scale.
`sweep.py` is how the per-diagonal turns in `clips.json` were chosen (the turn that lays the body along a screen diagonal and
fits the 192 canvas with the first frame unshifted). Candidates are in `clips.json`: `hit-lic` (CMU 79_73) and `ko-lic`
(CMU 90_18); `atk`, `atk2`, `hit`, `ko` are the round-1 candidates, kept for the record and not used.

The one change from round 1 that matters: the head and face keypoints ride the neck unchanged (`design.py`), where round 1
re-derived them from the shoulders and the model turned the face with every torso twist. `req.py` prints the
`animate_with_skeleton_v3` keypoints for a candidate.

The generated cels are in `../raw/`, `../assembly.json` says which frames of which job each take uses, `../assemble.py` tones
them (frozen `tone/params-v3.json`) and writes `../cels/`, and `../ledger.json` records every generation.
