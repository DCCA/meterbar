#!/usr/bin/env bash
# Renders the README demo (dark and light) and writes the committed media into docs/media/.
# Requires: Node >= 22, FFmpeg with libwebp_anim and libx264, `npm install` in demo/.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/.." && pwd)"
media="$root/docs/media"
out="$here/out"

# HyperFrames sends anonymous usage counters by default; this project sends nothing.
export HYPERFRAMES_NO_TELEMETRY=1

WEBP_QUALITY=78
WEBP_WIDTH=1600
MAX_WEBP_BYTES=5000000
POSTER_AT=6.0

command -v ffmpeg >/dev/null || { echo "ffmpeg not found" >&2; exit 1; }
encoders="$(ffmpeg -hide_banner -encoders 2>/dev/null)"
for enc in libwebp_anim libx264; do
  grep -q "$enc" <<<"$encoders" || { echo "ffmpeg lacks $enc" >&2; exit 1; }
done

(cd "$root" && npm run build --silent)
(cd "$here" && npx tsc -p . --noEmit && node prepare.mjs && npx hyperframes check)

mkdir -p "$out" "$media"
for theme in dark light; do
  (cd "$here" && npx hyperframes render -f 24 -q high --variables "{\"theme\":\"$theme\"}" -o "$out/$theme.mp4")
  ffmpeg -v error -y -i "$out/$theme.mp4" -vf "scale=$WEBP_WIDTH:-1:flags=lanczos" \
    -c:v libwebp_anim -quality "$WEBP_QUALITY" -compression_level 6 -loop 0 -an "$media/meterbar-demo-$theme.webp"
  ffmpeg -v error -y -ss "$POSTER_AT" -i "$out/$theme.mp4" -frames:v 1 -vf "scale=$WEBP_WIDTH:-1:flags=lanczos" \
    "$media/meterbar-demo-poster-$theme.png"
done
ffmpeg -v error -y -i "$out/dark.mp4" -vf "scale=1920:-2:flags=lanczos" -c:v libx264 -crf 20 -preset slow \
  -pix_fmt yuv420p -movflags +faststart -an "$media/meterbar-demo.mp4"

status=0
for f in "$media"/meterbar-demo-*.webp; do
  bytes=$(stat -c %s "$f")
  printf '%s  %s bytes\n' "$(basename "$f")" "$bytes"
  if (( bytes >= MAX_WEBP_BYTES )); then echo "  over the ${MAX_WEBP_BYTES}-byte budget" >&2; status=1; fi
done
ls -l "$media"
exit "$status"
