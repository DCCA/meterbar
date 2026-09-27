# README demo video

Renders the looping demo at the top of the repository README from the real built extension.
The popup and side panel in the video are the actual `dist/` pages, running on a demo
dataset with a frozen clock; nothing in them is redrawn by hand.

## Render

```bash
cd demo
npm install          # HyperFrames, GSAP and esbuild, pinned
npm run render       # builds the extension, renders dark and light, writes docs/media/
```

Requires Node 22 or newer, FFmpeg with `libx264`, and `img2webp` from libwebp 1.6 or newer
(`render.sh` checks the version). Arch: `libwebp-utils`. macOS: `brew install webp`. Distros
that ship an older libwebp: use Google's signed release from
<https://storage.googleapis.com/downloads.webmproject.org/releases/webp/index.html>, check it
with `gpg --verify libwebp-<version>-<platform>.tar.gz.asc` (WebP release signing key,
fingerprint `6B0E 6B70 976D E303 EDF2  F601 F9C3 D6BD B823 2B5D`), and set `IMG2WEBP` to its
`bin/img2webp`. A render takes about five minutes and fails
if either WebP reaches 5 MB. `npm run preview` opens the HyperFrames studio for timing work.

The WebP is encoded by `img2webp` with a keyframe at least every second, in parts split right
after the two big fades and joined by `concat-webp.mjs`. libwebp's lossy animation encoder
keeps a faint ghost of a faded layer until its next keyframe, and neither `img2webp`, FFmpeg
nor libvips can place one at a chosen frame; each part starts with a full frame instead.
If you move those fades in `stage.ts`, move `KEYFRAMES_AT_MS` in `render.sh` with them.

HyperFrames phones home by default: usage counters, an npm update check, a skills check.
`render.sh` and `npm run preview` turn all of that off (`HYPERFRAMES_NO_TELEMETRY`,
`HYPERFRAMES_NO_UPDATE_CHECK`, `HYPERFRAMES_SKIP_SKILLS`, `HYPERFRAMES_NO_AUTO_INSTALL`,
`DO_NOT_TRACK`). The first render still downloads HyperFrames' pinned chrome-headless-shell.
Fonts never come from the network: the composition declares the bundled JetBrains Mono
inline, so HyperFrames has no family left to fetch.

## How it fits together

| File | Role |
|---|---|
| `fixture.ts` | The demo dataset: two states one 10-minute refresh apart with unchanged reset times, and a 24 h history whose 5-hour line resets like the real window. `tests/demoFixture.test.ts` pins the truthfulness rules: every reading `inferred`, Gemini status-only, no account-like strings, exactly one product alert between the states. |
| `stub.ts` | Loaded before the product bundle in each embedded page: freezes `Date` at its state's time, answers the `chrome.*` calls the pages make at load, reports when the page has painted. |
| `derive.ts` | Tooltip, alert, badge and icon values, produced by the real `src/` functions. |
| `prepare.mjs` | Copies `dist/` into `.build/`, writes demo copies of `popup.html` and `sidepanel.html`, bundles `stub.ts` and `stage.ts`. |
| `index.html`, `stage.css`, `stage.ts` | The composition: a 1200x750 stage rendered at 2x, colors from the product's tokens only, one GSAP timeline. |
| `render.sh` | Check, render both themes, encode WebP (img2webp, split at the fades), posters and MP4, enforce the size budget. |
| `concat-webp.mjs` | Joins the WebP parts into one animation and verifies the result. |
| `fonts/` | JetBrains Mono 2.304 (SIL OFL 1.1, see `fonts/OFL.txt`), so renders never depend on host fonts. |

The product's own CSS animations are held at their end state inside the embedded pages;
all motion comes from the composition's timeline, which HyperFrames seeks frame by frame.
Motion inside a page (the Limits meters filling) goes through setter proxies that re-apply
whenever the page paints, so renders are byte-identical run to run.

To change the story, edit the timeline in `stage.ts` (times are in seconds and follow
`docs/superpowers/specs/2026-09-27-demo-video-design.md`), then run `npm run render`.
