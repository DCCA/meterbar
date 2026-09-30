#!/usr/bin/env bash
# Renders the README demo (dark and light) and writes the committed media into docs/media/.
# Requires: Node >= 22, FFmpeg with libx264, img2webp from libwebp >= 1.6 (see demo/README.md;
# set IMG2WEBP if it is not on PATH), and `npm install` in demo/.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/.." && pwd)"
media="$root/docs/media"
out="$here/out"

# HyperFrames phones home by default (usage counters, an npm update check, a skills check,
# self-install prompts). None of that runs here. It still downloads its pinned
# chrome-headless-shell on first use; fonts come from demo/fonts, never the network.
export HYPERFRAMES_NO_TELEMETRY=1 HYPERFRAMES_NO_UPDATE_CHECK=1 HYPERFRAMES_SKIP_SKILLS=1
export HYPERFRAMES_NO_AUTO_INSTALL=1 DO_NOT_TRACK=1

FPS=24
# README WebP: 1440 px (1.8x the 800 px README column) at 20 fps, lossy q85, a keyframe at
# least every second, plus a forced keyframe right after each big fade (KEYFRAMES_AT_MS, in
# step with stage.ts): libwebp's lossy animation encoder otherwise keeps a faint ghost of a
# faded layer until its next keyframe. img2webp cannot place keyframes, so the frames are
# encoded in parts split there (each part starts with a full frame) and joined.
WEBP_WIDTH=1440
WEBP_FPS=20
WEBP_QUALITY=85
KMIN=10
KMAX=20
KEYFRAMES_AT_MS=(16000 20850) # after the panel/toolbar fade and after the privacy exit
MAX_WEBP_BYTES=5000000
POSTER_WIDTH=1600
POSTER_AT=6.0 # Home view, caption up, cursor parked off the controls

IMG2WEBP="$(command -v "${IMG2WEBP:-img2webp}" || true)"
[[ -n "$IMG2WEBP" ]] || { echo "img2webp not found; install libwebp tools or set IMG2WEBP" >&2; exit 1; }
webp_version="$("$IMG2WEBP" -version 2>/dev/null | awk '/Encoder version/ { print $NF }')"
[[ "$(printf '%s\n1.6.0\n' "$webp_version" | sort -V | head -n1)" == "1.6.0" ]] ||
  { echo "img2webp is libwebp ${webp_version:-unknown}; 1.6.0 or newer is required" >&2; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg not found" >&2; exit 1; }
encoders="$(ffmpeg -hide_banner -encoders 2>/dev/null)" || { echo "ffmpeg -encoders failed" >&2; exit 1; }
grep -q libx264 <<<"$encoders" || { echo "ffmpeg lacks libx264" >&2; exit 1; }
[[ -d "$here/node_modules" ]] || { echo "run npm install in demo/ first" >&2; exit 1; }

(cd "$root" && npm run build --silent)
(cd "$here" && ./node_modules/.bin/tsc -p . --noEmit && node prepare.mjs && npx --no-install hyperframes check)

mkdir -p "$out" "$media"
trap 'rm -rf "$out"/frames-*' EXIT # hundreds of PNGs if an encode fails
for theme in dark light; do
  (cd "$here" && npx --no-install hyperframes render -f "$FPS" -q high --variables "{\"theme\":\"$theme\"}" -o "$out/$theme.mp4")

  frames="$out/frames-$theme"
  rm -rf "$frames" && mkdir -p "$frames"
  ffmpeg -v error -i "$out/$theme.mp4" -vf "fps=$WEBP_FPS,scale=$WEBP_WIDTH:-1:flags=lanczos" "$frames/f%04d.png"
  # Split points as frame indices, then encode each part (in parallel) and join them.
  files=("$frames"/f*.png)
  bounds=(0)
  for ms in "${KEYFRAMES_AT_MS[@]}"; do bounds+=($(( ms * WEBP_FPS / 1000 ))); done
  bounds+=(${#files[@]})
  parts=() pids=()
  for ((p = 0; p < ${#bounds[@]} - 1; p++)); do
    args=()
    for ((i = bounds[p]; i < bounds[p + 1]; i++)); do
      # Whole-millisecond durations that add up to exactly WEBP_FPS frames per second.
      args+=(-d $(( ((i + 1) * 1000 + WEBP_FPS / 2) / WEBP_FPS - (i * 1000 + WEBP_FPS / 2) / WEBP_FPS )) "${files[$i]}")
    done
    parts+=("$frames/part$p.webp")
    "$IMG2WEBP" -loop 0 -lossy -q "$WEBP_QUALITY" -m 6 -kmin "$KMIN" -kmax "$KMAX" "${args[@]}" -o "${parts[$p]}" >/dev/null &
    pids+=($!)
  done
  for pid in "${pids[@]}"; do wait "$pid"; done
  node "$here/concat-webp.mjs" "$media/meterbar-demo-$theme.webp" "${parts[@]}"
  rm -rf "$frames"

  ffmpeg -v error -y -ss "$POSTER_AT" -i "$out/$theme.mp4" -frames:v 1 -vf "scale=$POSTER_WIDTH:-1:flags=lanczos" \
    "$media/meterbar-demo-poster-$theme.png"
done
ffmpeg -v error -y -i "$out/dark.mp4" -vf "scale=1920:-2:flags=lanczos" -c:v libx264 -crf 20 -preset slow \
  -pix_fmt yuv420p -movflags +faststart -an "$media/meterbar-demo.mp4"

status=0
for f in "$media"/meterbar-demo-*.webp; do
  bytes=$(wc -c <"$f" | tr -d ' ')
  printf '%s  %s bytes\n' "$(basename "$f")" "$bytes"
  if (( bytes >= MAX_WEBP_BYTES )); then echo "  over the ${MAX_WEBP_BYTES}-byte budget" >&2; status=1; fi
done
ls -l "$media"
exit "$status"
