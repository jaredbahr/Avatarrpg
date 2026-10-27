# dorin G review: measured flags

- south idle: boiling, 27% of head/torso pixels change between cels (gate 20%; Kaya measures 8-17%)
- south walk: height swings 123-140 px (bob or a collapsed cel)
- south walk: a foot sinks 13 px below the standing line
- south-east idle: boiling, 21% of head/torso pixels change between cels (gate 20%; Kaya measures 8-17%)
- south-east walk: height swings 121-136 px (bob or a collapsed cel)
- east idle: boiling, 24% of head/torso pixels change between cels (gate 20%; Kaya measures 8-17%)
- north-east walk: height swings 122-139 px (bob or a collapsed cel)
- north walk: height swings 129-144 px (bob or a collapsed cel)
- north walk: a foot sinks 14 px below the standing line
- west idle: boiling, 31% of head/torso pixels change between cels (gate 20%; Kaya measures 8-17%)
- south-west idle: boiling, 23% of head/torso pixels change between cels (gate 20%; Kaya measures 8-17%)

## Eye review

Flags the gates cannot see, from the sheets at game scale and 3x.

- Idle boil 21-46% (worst south): collar clasp, key and face re-drawn each cel; the expression changes between cels.
- East walk: retaken at 0.55x arm swing (s8603, used) after s8601 swung the free arm forward to horizontal.
- South and north walks: the leading foot reaches 13-14 px below the standing line, past art:validate's 10 px stride bound; packing would need a 3-4 px walkDy, as the thug's south-west did.
- Spear hand ambiguous in the west rotation.
