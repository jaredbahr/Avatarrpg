#!/bin/sh
# Cut the load off a review recording and encode it as H.264 mp4 (the recordings are not committed).
# usage (repo root): sh art/source/style-test-world-chars/tools/video.sh STYLE OUT.mp4
# Reads .shots/style-test/STYLE/run.webm and provenance.json's videoCrossingMs.
set -e
S=$1; OUT=$2
read A B <<EOT
$(python3 -c "import json;p=json.load(open('.shots/style-test/$S/provenance.json'));a,b=p['videoCrossingMs'];print(max(0,a/1000-0.3),(b-a)/1000+0.3)")
EOT
ffmpeg -y -loglevel error -ss "$A" -i ".shots/style-test/$S/run.webm" -t "$B" -c:v libx264 -pix_fmt yuv420p -crf 18 -movflags +faststart "$OUT"
