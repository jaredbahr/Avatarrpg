#!/bin/sh
# fetch.sh JOB NAME N : downloads the N frames of a PixelLab job into raw/NAME/NN.png (no credentials; the URLs are the tool's own download URLs)
mkdir -p "raw/$2"; i=0
while [ $i -lt $3 ]; do curl -sf --max-time 40 -o "raw/$2/$(printf %02d $i).png" "https://api.pixellab.ai/mcp/images/$1/download?index=$i" || echo "fail $i"; i=$((i+1)); done
