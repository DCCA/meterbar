#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
HOME_DIR=${HOME:?HOME is required}
STAMP=$(date +%Y%m%d-%H%M%S)

HOST_SOURCE="$ROOT_DIR/companion/native-host.mjs"
HOST_TARGET="$HOME_DIR/.local/lib/meterbar/native-host.mjs"
PLUGIN_SOURCE="$ROOT_DIR/companion/omarchy/local.meterbar"
PLUGIN_TARGET="$HOME_DIR/.config/omarchy/plugins/local.meterbar"
MANIFEST_TEMPLATE="$ROOT_DIR/companion/native-host-manifest.json.in"

backup_existing() {
  local path=$1
  if [[ -e "$path" ]]; then
    mv -- "$path" "$path.bak.$STAMP"
    printf 'Backed up %s\n' "$path"
  fi
}

mkdir -p -- "$(dirname -- "$HOST_TARGET")" "$HOME_DIR/.config/omarchy/plugins"
install -m 0700 -- "$HOST_SOURCE" "$HOST_TARGET"

backup_existing "$PLUGIN_TARGET"
mkdir -p -- "$PLUGIN_TARGET"
cp -a -- "$PLUGIN_SOURCE/." "$PLUGIN_TARGET/"
find "$PLUGIN_TARGET" -type f -exec chmod 0644 {} +

browser_manifest_dirs=("$HOME_DIR/.config/chromium/NativeMessagingHosts")
for candidate in \
  "$HOME_DIR/.config/google-chrome/NativeMessagingHosts" \
  "$HOME_DIR/.config/google-chrome-beta/NativeMessagingHosts" \
  "$HOME_DIR/.config/google-chrome-unstable/NativeMessagingHosts" \
  "$HOME_DIR/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts" \
  "$HOME_DIR/.config/BraveSoftware/Brave-Browser-Beta/NativeMessagingHosts" \
  "$HOME_DIR/.config/microsoft-edge/NativeMessagingHosts" \
  "$HOME_DIR/.config/microsoft-edge-dev/NativeMessagingHosts"
do
  [[ -d "$(dirname -- "$candidate")" ]] && browser_manifest_dirs+=("$candidate")
done

for directory in "${browser_manifest_dirs[@]}"; do
  mkdir -p -- "$directory"
  python3 - "$MANIFEST_TEMPLATE" "$directory/com.meterbar.bridge.json" "$HOST_TARGET" <<'PY'
import json
import sys
from pathlib import Path

template_path, output_path, host_path = map(Path, sys.argv[1:])
manifest = json.loads(template_path.read_text())
manifest["path"] = str(host_path)
output_path.write_text(json.dumps(manifest, indent=2) + "\n")
PY
done

if [[ ${METERBAR_SKIP_ENABLE:-0} != 1 ]]; then
  command -v omarchy >/dev/null || { printf 'Omarchy is required to enable the bar widget.\n' >&2; exit 1; }
  omarchy plugin validate "$PLUGIN_TARGET"
  omarchy plugin enable local.meterbar --section right
fi

printf 'Installed MeterBar native host: %s\n' "$HOST_TARGET"
printf 'Installed Omarchy plugin: %s\n' "$PLUGIN_TARGET"
printf 'Reload the unpacked MeterBar extension so Chromium grants nativeMessaging.\n'
