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

Requires Node 22 or newer and FFmpeg with `libwebp_anim` and `libx264`. A render takes about
four minutes and fails if either WebP exceeds 5 MB. `npm run preview` opens the HyperFrames
studio for timing work.

HyperFrames sends anonymous usage counters by default; every script here sets
`HYPERFRAMES_NO_TELEMETRY=1`, so rendering the demo sends nothing.

## How it fits together

| File | Role |
|---|---|
| `fixture.ts` | The demo dataset. `tests/demoFixture.test.ts` pins its truthfulness rules: every reading `inferred`, Gemini status-only, no account-like strings. |
| `stub.ts` | Loaded before the product bundle in each embedded page: freezes `Date`, answers the `chrome.*` calls the pages make at load, reports when the page has painted. |
| `derive.ts` | Tooltip, alert, badge and icon values, produced by the real `src/` functions. |
| `prepare.mjs` | Copies `dist/` into `.build/`, writes demo copies of `popup.html` and `sidepanel.html`, bundles `stub.ts` and `stage.ts`. |
| `index.html`, `stage.css`, `stage.ts` | The composition: a 1200x750 stage rendered at 2x, colors from the product's tokens only, one GSAP timeline. |
| `render.sh` | Check, render both themes, encode WebP, posters and MP4, enforce the size budget. |
| `fonts/` | JetBrains Mono 2.304 (SIL OFL 1.1, see `fonts/OFL.txt`), so renders never depend on host fonts. |

The product's own CSS animations are held at their end state inside the embedded pages;
all motion comes from the composition's timeline, which HyperFrames seeks frame by frame.
Motion inside a page (the Limits meters filling) goes through setter proxies that re-apply
whenever the page paints, so renders are byte-identical run to run.

To change the story, edit the timeline in `stage.ts` (times are in seconds and follow
`docs/superpowers/specs/2026-09-27-demo-video-design.md`), then run `npm run render`.
