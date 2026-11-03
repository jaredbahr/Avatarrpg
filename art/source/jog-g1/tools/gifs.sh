#!/bin/sh
# gifs.sh : turns the stepped-clock frames e2e/jog.review.ts writes (40 ms apart) into review GIFs at the game's cadence.
# usage (repo root): sh art/source/jog-g1/tools/gifs.sh .shots/jog art/source/jog-g1/review/ingame
set -e
src=${1:-.shots/jog}; out=${2:-art/source/jog-g1/review/ingame}
mkdir -p "$out"
for label in before after; do
  for scene in ba-dan forest; do
    dir="$src/$label/$scene"; [ -d "$dir" ] || continue
    # The camera follows the party through Ba Dan: keep the middle half, where the party runs, at one GIF px a world px
    # (the captures draw two screen px a world px, so halving nearest loses nothing).
    crop=$([ "$scene" = ba-dan ] && echo "crop=iw/2:ih:iw/4:0,scale=iw/2:-1:flags=neighbor," || echo "scale=iw/2:-1:flags=neighbor,")
    ffmpeg -v error -y -framerate 25 -i "$dir/%03d.png" \
      -vf "${crop}split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle" \
      "$out/$scene-$label.gif"
    echo "$out/$scene-$label.gif"
  done
done
