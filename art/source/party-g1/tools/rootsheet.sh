#!/bin/sh
# rootsheet.sh KIND CHAR SEED OUT : B over the root candidates, the eight headings across (review only)
k=$1; c=$2; s=$3; out=$4; rows=""
for i in B 00 01 02; do r=""; for d in south south-east east north-east north north-west west south-west; do
  if [ $i = B ]; then f=b/$c/$k/$d/00.png; else f=raw/root-$k-$c-$d-s$s/$i.png; fi
  [ -f "$f" ] && r="$r,$f"; done; rows="$rows ${r#,}"; done
python3 tools/sheet.py "$out" $rows
