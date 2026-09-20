# MeterBar for Omarchy

This optional post-MVP companion adds a four-channel usage indicator to the Omarchy shell bar and a click-open Workbench panel. It is a display-only subset of the PRD's future local companion phase, not part of the Chrome MVP. The Chrome extension remains the only collector. The desktop plugin reads one sanitized local JSON snapshot and makes no network requests.

It does not add CLI quota tracking, a local proxy, provider routing, failover, or shell/CLI configuration changes.

## Install

Requirements: Omarchy 4, Chromium, Node.js, and a built MeterBar extension.

```bash
npm run build
./scripts/install-omarchy-companion.sh
```

Then reload MeterBar from `chrome://extensions`, open it once, and refresh usage. The extension has a stable development ID so the native host accepts only this MeterBar build.

The installer creates only user-owned files:

- `~/.local/lib/meterbar/native-host.mjs`
- `~/.config/chromium/NativeMessagingHosts/com.meterbar.bridge.json`
- `~/.config/omarchy/plugins/local.meterbar/`
- `~/.local/state/meterbar/state.json` after the first successful sync

It also enables `local.meterbar` in the right side of the Omarchy bar. Left-click the four-channel indicator to open the panel. Right-click it to open MeterBar in Chromium.

## Privacy boundary

The native bridge accepts schema version 1 snapshots only. It writes provider names, display labels, usage windows, percentages, reset and capture timestamps, confidence, stale state, and provider status. It rejects unknown shapes and drops extra keys.

Cookies, bearer tokens, account hashes, provider endpoint details, prompts, responses, chat content, and browsing history never cross the native messaging boundary. The state file is written atomically with mode `0600`.

**Settings → Clear local MeterBar data** clears browser storage and asks the installed native host to delete this state file. If the host is unavailable, the removal commands below delete it manually.

## Remove

```bash
omarchy plugin disable local.meterbar
rm -rf ~/.config/omarchy/plugins/local.meterbar
rm -rf ~/.local/lib/meterbar ~/.local/state/meterbar
rm -f ~/.config/chromium/NativeMessagingHosts/com.meterbar.bridge.json
```
