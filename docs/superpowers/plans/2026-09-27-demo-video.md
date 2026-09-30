# README Demo Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render an 18 s looping MeterBar demo (dark and light) from the real built popup and side panel, and embed it at the top of the README.

**Architecture:** A self-contained `demo/` HyperFrames project. `prepare.mjs` copies `dist/` into `demo/.build/ext/`, injects a bundled `stub.js` (frozen clock, `chrome.*` stand-in, fixture data) plus the bundled font into demo copies of the popup and side-panel pages, and writes `derived.json` (tooltip, alert, icon, and badge values produced by the real `src/` functions). `index.html` embeds those pages as same-origin iframes, and one paused GSAP timeline drives all motion.

**Tech Stack:** HyperFrames (pinned), GSAP (local npm), esbuild (bundles `demo/*.ts`), FFmpeg (`libwebp_anim`, `libx264`), Vitest (fixture test in the root suite).

**Spec:** `docs/superpowers/specs/2026-09-27-demo-video-design.md`

## Global Constraints

- Every fixture snapshot uses `confidence: 'inferred'`; Gemini has zero snapshots; provider labels are exactly `Claude`, `OpenAI`, `Gemini`.
- Colors come only from `src/ui/tokens.css` and `src/ui/workbenchPalette.css` custom properties; no hex in `demo/` CSS.
- Usage copy uses "N% used"; captions never use `--ok`, `--warn`, or `--crit`.
- No change to `src/`, `manifest.json`, or the root `package.json` dependencies. `dist/` is read, never written.
- Every HyperFrames invocation sets `HYPERFRAMES_NO_TELEMETRY=1`.
- Stage 1200x750 CSS px, rendered at 2x (2400x1500), 24 fps, 18 s.
- WebP outputs under 5 MB each; MP4 is H.264 `yuv420p` `+faststart`.
- Commits carry no co-author trailer. No em dashes in copy.

## Review Focus

1. **Light theme:** every added element (toolbar strip, tooltip, notification, privacy pane, captions, tag) must stay legible on the light field. Covered by Task 6 stills in both themes.
2. **Blank or half-rendered iframes at capture time:** a frame shows an empty popup. Covered by the Task 1 spike (two renders, frames compared) and the Task 6 stills.
3. **Font fallback inside iframes:** the product pages must use the bundled JetBrains Mono, not the host's Nerd Font or a default monospace. Covered by the Task 2 prepare check (`document.fonts.check` logged by the stub) and the Task 6 stills.
4. **Time-zone dependence:** the fixture's `NOW` is local time; every string on screen must be relative ("Resets in 46m", "-24h"). Covered by the Task 3 test, which asserts that derived strings match the same values under two `TZ` settings.
5. **Over-budget WebP:** the render must fail loudly rather than commit a 12 MB hero. Covered by the Task 5 size gate in `render.sh`.

---

### Task 1: Spike - iframe capture determinism

**Files:**
- Create: `demo/package.json`, `demo/.gitignore`, `demo/prepare.mjs` (minimal), `demo/stub.ts` (minimal), `demo/fixture.ts` (minimal), `demo/spike/index.html` (throwaway, deleted at the end of the task)

- [ ] Create `demo/package.json` pinning `hyperframes`, `gsap`, and `esbuild` at exact versions, with `prepare` and `render` scripts. `demo/.gitignore` lists `.build/`, `out/`, and `node_modules/`.
- [ ] Write `prepare.mjs`:
  - copy `../dist` to `.build/ext`;
  - for `src/popup/popup.html` and `src/sidepanel/sidepanel.html`, write `.build/ext/popup.html` and `.build/ext/sidepanel.html` with `/assets/` rewritten to `./assets/`, the product's reduced-motion rule forced on (inject `*,*::before,*::after{animation:none!important;transition:none!important}`), and `<script src="./stub.js"></script>` inserted before the module script;
  - esbuild-bundle `stub.ts` to `.build/ext/stub.js` as an IIFE.
- [ ] `npm install` in `demo/`, root `npm run build`, `node demo/prepare.mjs`.
- [ ] Spike composition: 2 s long, one popup iframe (`.build/ext/popup.html?state=glance&view=limits`), one GSAP tween widening the first `.meter b` from 0 over 1 s.
- [ ] Render twice at `-f 24 -q draft` with `HYPERFRAMES_NO_TELEMETRY=1`, extract frames 0, 12, and 36 with ffmpeg, and compare them with `cmp` (or a PSNR above 60 dB).
- [ ] **Decision:** if frames match and the popup is not blank, keep iframes. Otherwise switch to the `--dump-dom` snapshot fallback from the spec and record why in the commit message.
- [ ] Delete `demo/spike/`. Commit: `chore(demo): scaffold HyperFrames project and verify iframe capture`.

### Task 2: Fixture, stub, and fixture test (TDD)

**Files:**
- Create: `demo/fixture.ts`, `tests/demoFixture.test.ts`
- Modify: `demo/stub.ts`

**Interfaces:**
- Produces: `export const NOW: number`; `export type DemoState = 'glance' | 'alert'`; `export function demoCards(state: DemoState): ProviderCardState[]`; `export function demoHistory(state: DemoState): Record<string, [number, number][]>`.

- [ ] Write the failing test, `tests/demoFixture.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { demoCards, demoHistory, NOW, type DemoState } from '../demo/fixture';
import { mostConstrainedWindow } from '../src/popup/render';

const STATES: DemoState[] = ['glance', 'alert'];
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

describe.each(STATES)('demo fixture (%s)', (state) => {
  const cards = demoCards(state);
  it('labels providers exactly as the product does', () => {
    expect(cards.map((c) => [c.provider, c.label])).toEqual([['claude', 'Claude'], ['chatgpt', 'OpenAI'], ['gemini', 'Gemini']]);
  });
  it('marks every reading inferred and fresh', () => {
    for (const s of cards.flatMap((c) => c.snapshots)) {
      expect(s.confidence).toBe('inferred');
      expect(s.stale).toBe(false);
      expect(NOW - Date.parse(s.capturedAt)).toBeLessThan(10 * 60 * 1000);
    }
  });
  it('keeps Gemini status-only', () => {
    const gemini = cards.find((c) => c.provider === 'gemini')!;
    expect(gemini.status).toBe('connected');
    expect(gemini.snapshots).toEqual([]);
  });
  it('puts Claude 5-hour in the hero', () => {
    const top = mostConstrainedWindow(cards)!;
    expect(top.snapshot.provider).toBe('claude');
    expect(top.snapshot.window).toBe('five_hour');
    expect(top.snapshot.usedPercent).toBe(state === 'glance' ? 72 : 91);
  });
  it('has a 24 h trend ending at each tightest value', () => {
    const h = demoHistory(state);
    expect(h['history:claude:five_hour'].at(-1)).toEqual([NOW, state === 'glance' ? 72 : 91]);
    expect(h['history:chatgpt:seven_day'].at(-1)).toEqual([NOW, 38]);
    expect(h['history:claude:five_hour'].filter(([t]) => t >= NOW - 86_400_000).length).toBeGreaterThan(2);
  });
  it('contains no account-like strings', () => {
    const text = JSON.stringify(cards);
    expect(text).not.toMatch(EMAIL);
    expect(text).not.toMatch(UUID);
  });
});
```

- [ ] Run `npx vitest run tests/demoFixture.test.ts`. Expected: FAIL, the module cannot be resolved.
- [ ] Implement `demo/fixture.ts` per the spec's dataset section (typed against `src/shared/types`).
- [ ] Run the test. Expected: PASS. Then run `npm run typecheck`. Expected: clean.
- [ ] Complete `stub.ts` against the spec's stub contract:
  - frozen `Date` and `Date.now`;
  - `runtime.sendMessage` (`state:get`);
  - `storage.local.get` in its null, string, array, and object forms;
  - `onChanged` no-op;
  - `windows.getCurrent`;
  - `sidePanel.open`;
  - `localStorage` `meterbar:view` from the `view` parameter;
  - `data-theme` from the `theme` parameter;
  - posts `{type:'demo:ready'}` to the parent once `#cards` has children and `document.fonts.ready` resolves.
- [ ] Commit: `feat(demo): typed demo fixture and chrome stub with truthfulness test`.

### Task 3: Derived product copy

**Files:**
- Create: `demo/derive.ts`
- Modify: `demo/prepare.mjs`, `tests/demoFixture.test.ts`

**Interfaces:**
- Consumes: `demoCards`, `NOW` (Task 2); `buildTooltip(cards)`, `alertCopy(input, now)` (`src/shared/summary.ts`); `iconBars(cards)` (`src/background/iconModel.ts`); `calculateBadgeState(snapshots, target)` (`src/background/badge.ts`).
- Produces: `export function deriveDemo(): Derived`, where `Derived = { tooltip: string; alert: { title: string; message: string }; icon: Record<DemoState, IconBar[]>; badge: Record<DemoState, { text: string; color: string }> }`. `prepare.mjs` writes it to `.build/derived.json`.

- [ ] Add a failing test: `deriveDemo().alert.title` contains `91% used` and `(unofficial source)`; `badge.alert.text === '91'`; the tooltip contains `Claude` and `OpenAI` and has no Gemini percentage; and results are identical under `process.env.TZ = 'UTC'` and `'Pacific/Auckland'` (re-import with `vi.resetModules`).
- [ ] Implement `derive.ts`, calling the real functions only. Read `alertCopy`'s input type from `src/shared/summary.ts` before wiring it.
- [ ] Wire it into `prepare.mjs`: esbuild-bundle `derive.ts` for node and run it, writing `.build/derived.json`.
- [ ] Run the tests and typecheck. Commit: `feat(demo): derive tooltip, alert, icon and badge copy from product code`.

### Task 4: Composition

**Files:**
- Create: `demo/index.html`, `demo/stage.css`, `demo/timeline.js`, `demo/cursor.svg`, `demo/fonts/JetBrainsMono-{Regular,Medium,SemiBold,Bold,ExtraBold}.woff2`, `demo/fonts/OFL.txt`, `demo/fonts/fonts.css`
- Modify: `demo/prepare.mjs` (copy `fonts.css`, `tokens.css`, and `workbenchPalette.css` into `.build/`; inject `fonts.css` into the product pages)

- [ ] Download the JetBrains Mono woff2 files and `OFL.txt` from the official JetBrains/JetBrainsMono GitHub release. Verify the licence file is present.
- [ ] `stage.css`: ambient field, toolbar strip, badge, tooltip, notification, privacy pane, caption roles, and tag, all from tokens (values from the spec's visual design section and the Mix 1 probe).
- [ ] `index.html`: root `data-composition-id="root"`, `data-width="2400"`, `data-height="1500"`, `data-duration="18"`; a 1200x750 `.stage` scaled 2x; `theme` variable (`dark` or `light`) applied as `data-theme` on `<html>` and forwarded to the iframe URLs; iframes for popup home, popup limits, side panel glance, and side panel alert.
- [ ] `timeline.js`: wait for four `demo:ready` messages, then fill tooltip, alert, badge, and icon from `derived.json`, build one paused GSAP timeline following the spec's storyboard times exactly, and register it as `window.__timelines.root`.
- [ ] Preview with `npx hyperframes preview` and review the timing of each beat. Run `npx hyperframes lint` and `check`.
- [ ] Commit: `feat(demo): four-beat composition in the product design language`.

### Task 5: Render pipeline

**Files:**
- Create: `demo/render.sh`
- Create (generated, committed): `docs/media/meterbar-demo-{dark,light}.webp`, `docs/media/meterbar-demo-poster-{dark,light}.png`, `docs/media/meterbar-demo.mp4`

- [ ] `render.sh` (`set -euo pipefail`), in order:
  - check that `ffmpeg` is present with `libwebp_anim`;
  - root `npm run build`, then `node prepare.mjs`;
  - for each theme, run `HYPERFRAMES_NO_TELEMETRY=1 npx hyperframes render -f 24 -q high --variables '{"theme":"<t>"}' -o out/<t>.mp4`;
  - WebP: `ffmpeg -i out/<t>.mp4 -vf "scale=1600:-1:flags=lanczos" -c:v libwebp_anim -quality 78 -loop 0 -an docs/media/meterbar-demo-<t>.webp`;
  - poster: `-ss 6.0 -frames:v 1` scaled to 1600;
  - MP4: dark, scaled to 1920, `-c:v libx264 -crf 20 -pix_fmt yuv420p -movflags +faststart -an`;
  - size gate: fail if any WebP is 5,000,000 bytes or larger.
- [ ] Run it. If the size gate fails, lower the WebP quality in steps of 4 down to 66, then drop to 20 fps. Record the final values in the script.
- [ ] Commit: `feat(demo): render script and generated README media`.

### Task 6: README and visual verification

**Files:**
- Modify: `README.md` (hero `<picture>` block under the title; Gemini permission row at line 70)
- Create: `demo/README.md` (how to re-render, requirements, telemetry note)

- [ ] Add the `<picture>` block, disclosure line, MP4 link, and permissions link from the spec. Correct the Gemini row to "Detect that you are signed in to Gemini (status only, no usage number)".
- [ ] Stills: extract 1.8, 5.0, 8.0, 12.0, and 15.5 s from both theme MP4s and inspect each for legibility, cropping, the `inferred` word, token use, and loop-seam equality (compare frame 0 with the last frame).
- [ ] Fix anything found, re-render, and re-check.
- [ ] `npm run check` and `npm run build` must both pass.
- [ ] Commit: `docs: demo video in README, correct Gemini permission row`.

### Task 7: Adversarial review, verification, PR

- [ ] Five virtual-user reviewers, all read-only, looking at the rendered stills plus the README diff: README skimmer, security skeptic, heavy AI user, video craft critic, and PRD truthfulness auditor. Fix confirmed findings, then re-render and re-verify.
- [ ] Whole-branch code review (Opus).
- [ ] Final verification: fresh `npm run check`, `npm run build`, `bash demo/render.sh`, size gate, and stills in both themes.
- [ ] Push the branch and open a PR. Open a separate issue for making `nativeMessaging` optional.
