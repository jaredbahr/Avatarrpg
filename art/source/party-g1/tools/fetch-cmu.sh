#!/bin/sh
# fetch-cmu.sh : downloads the CMU Graphics Lab takes the party G1 motion is retargeted from into ./cmu (not tracked).
# mocap.cs.cmu.edu, free for any use; credit line in NOTICE.md when a sheet ships.
cd "$(dirname "$0")" && mkdir -p cmu && cd cmu
for c in 08_01 77_02 09_01; do
  s=${c%_*}
  [ -f "$s.asf" ] || curl -sf -o "$s.asf" "http://mocap.cs.cmu.edu/subjects/$s/$s.asf"
  [ -f "$c.amc" ] || curl -sf -o "$c.amc" "http://mocap.cs.cmu.edu/subjects/$s/$c.amc"
done
