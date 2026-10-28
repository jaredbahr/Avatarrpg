#!/bin/sh
# Turns a Playwright review recording (webm) into an mp4 a phone or a PR can play.
# Usage: sh scripts/review/flow-mp4.sh <video.webm> <out.mp4>
set -eu
in=$1
out=$2
mkdir -p "$(dirname "$out")"
ffmpeg -loglevel error -y -i "$in" -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p \
  -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -movflags +faststart "$out"
echo "$out"
