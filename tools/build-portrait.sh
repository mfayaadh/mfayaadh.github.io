#!/usr/bin/env bash
# Builds the cut-out portrait used in the Profile section.
#   tools/build-portrait.sh path/to/photo-with-transparent-background.png
# Outputs assets/fayaadh-{bw,color}-{1200,700}.webp: white outline + offset red outline baked in.
set -euo pipefail
SRC="${1:?usage: build-portrait.sh <transparent-png>}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/assets"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# trim, normalise height, pad so outlines have room
magick "$SRC" -trim +repage -resize x1140 -background none -gravity center -extent "%[fx:w+70]x%[fx:h+60]" "$TMP/p.png"
W=$(magick identify -format %w "$TMP/p.png"); H=$(magick identify -format %h "$TMP/p.png")

magick "$TMP/p.png" -alpha extract -morphology Dilate Disk:5  "$TMP/m-white.png"
magick "$TMP/p.png" -alpha extract -morphology Dilate Disk:12 "$TMP/m-red.png"

# outline layers
magick -size ${W}x${H} xc:'#fbf7f0' "$TMP/m-white.png" -alpha off -compose CopyOpacity -composite "$TMP/white.png"
magick -size ${W}x${H} xc:'#e3001b' "$TMP/m-red.png"   -alpha off -compose CopyOpacity -composite "$TMP/red.png"

# grayscale, punchy contrast (comic look)
magick "$TMP/p.png" \( +clone -alpha off -colorspace Gray -sigmoidal-contrast 5,45% -level 4%,96% \) \
  +swap -compose CopyOpacity -composite "$TMP/bw-raw.png" 2>/dev/null || \
magick "$TMP/p.png" -colorspace Gray -sigmoidal-contrast 5,45% -level 4%,96% "$TMP/bw-raw.png"

for v in bw color; do
  [ "$v" = bw ] && BODY="$TMP/bw-raw.png" || BODY="$TMP/p.png"
  magick -size ${W}x${H} xc:none \
    "$TMP/red.png"   -geometry +16+10 -compose Over -composite \
    "$TMP/white.png" -geometry +0+0   -compose Over -composite \
    "$BODY"          -geometry +0+0   -compose Over -composite \
    "$TMP/$v.png"
  magick "$TMP/$v.png" -quality 82 -define webp:alpha-quality=90 "$OUT/fayaadh-$v-1200.webp"
  magick "$TMP/$v.png" -resize x700 -quality 80 -define webp:alpha-quality=90 "$OUT/fayaadh-$v-700.webp"
done
magick identify -format "%f %wx%h %b\n" "$OUT"/fayaadh-*.webp
