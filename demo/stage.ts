// The composition's one script: fills product-derived copy, paints the toolbar icon with
// the product's own drawBars, and builds the single paused GSAP timeline HyperFrames seeks.
// The timeline is built synchronously (a HyperFrames rule); motion inside the embedded
// product pages goes through setter proxies that re-apply whenever an iframe paints.
import type { gsap as Gsap } from 'gsap';
import { drawBars } from '../src/background/icon';
import { deriveDemo } from './derive';
import { demoCards, type DemoState } from './fixture';

declare const gsap: typeof Gsap;
declare global {
  interface Window {
    __stageTimeline?: gsap.core.Timeline;
    __timelines?: Record<string, gsap.core.Timeline>;
    __hyperframes?: { getVariables?: () => Record<string, unknown> };
  }
}

const $ = <T extends Element = HTMLElement>(sel: string) => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`stage: missing ${sel}`);
  return el;
};

/** The product's motion curve, cubic-bezier(0.22, 1, 0.36, 1), as a GSAP ease. */
function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const bez = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x: number) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (bez(x1, x2, mid) < x) lo = mid;
      else hi = mid;
    }
    return bez(y1, y2, (lo + hi) / 2);
  };
}
const EASE = cubicBezier(0.22, 1, 0.36, 1);

/** Builds the stage and its timeline. Runs as soon as the DOM exists (the checker loads
 * this bundle before <body>; the renderer after it), always before the load event. */
function init(): void {
  // --- Theme: CLI variable wins; ?theme= is for local stills. ---------------------------
  const vars = window.__hyperframes?.getVariables?.() ?? {};
  const requested = typeof vars.theme === 'string' ? vars.theme : new URLSearchParams(location.search).get('theme');
  const theme = requested === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;

  for (const frame of document.querySelectorAll<HTMLIFrameElement>('iframe[data-page]')) {
    const { page, state, view } = frame.dataset;
    frame.src = `.build/ext/${page}.html?state=${state}&view=${view}&theme=${theme}`;
  }

  // --- Product-derived copy and icon. ----------------------------------------------------
  const derived = deriveDemo();
  $('#tooltip').textContent = derived.tooltip;
  $('#notice-title').textContent = derived.alert.title;
  $('#notice-msg').textContent = derived.alert.message;
  for (const state of ['glance', 'alert'] as DemoState[]) {
    const badge = $(`#badge-${state}`);
    badge.textContent = derived.badge[state].text;
    badge.style.background = derived.badge[state].color;
    badge.style.color = derived.badge[state].textColor;
    $<HTMLCanvasElement>(`#icon-${state}`).getContext('2d')?.putImageData(drawBars(derived.icon[state], 48), 0, 0);
  }

  // --- Motion inside the embedded pages (setter proxies). --------------------------------
  // One fill-progress slot per Limits-view meter (one per snapshot, in card order); 1 is the
  // product's own width. The timeline starts every slot at 0 so no bar flashes full first.
  const limitsFrame = $<HTMLIFrameElement>('#popup-limits');
  const fill = demoCards('glance').flatMap((c) => c.snapshots).map(() => 0);
  function applyMeters(): void {
    const bars = limitsFrame.contentDocument?.querySelectorAll<HTMLElement>('.meter b') ?? [];
    bars.forEach((bar, i) => {
      bar.dataset.w ??= String(parseFloat(bar.style.width) || 0);
      bar.style.width = `${Number(bar.dataset.w) * (fill[i] ?? 1)}%`;
    });
  }
  const meters = Object.fromEntries(fill.map((_, i) => [
    `m${i}`,
    (v?: number) => {
      if (v === undefined) return fill[i];
      fill[i] = v;
      applyMeters();
      return v;
    }
  ]));
  addEventListener('message', (e: MessageEvent) => {
    if (e.data?.type === 'demo:ready') applyMeters();
  });

  // --- Timeline (seconds). ------------------------------------------------------------------
  const tl = gsap.timeline({ paused: true });
  const show = (sel: string, at: number, dur = 0.3, from: gsap.TweenVars = {}) =>
    tl.fromTo(sel, { opacity: 0, ...from }, { opacity: 1, x: 0, y: 0, duration: dur, ease: EASE, immediateRender: false }, at);
  const hide = (sel: string, at: number, dur = 0.2, to: gsap.TweenVars = {}) =>
    tl.fromTo(sel, { opacity: 1 }, { opacity: 0, duration: dur, ease: 'power1.in', immediateRender: false, ...to }, at);

  // Scales and popup geometry. GSAP owns these transforms, so the scale lives in GSAP too.
  // Chrome sizes a popup window to its content: Home is 497.5 px tall, Limits 478.5 px.
  const POPUP = { scale: 1.3, homeHeight: 498, limitsHeight: 479 };
  gsap.set('#popup', { scale: POPUP.scale, height: POPUP.homeHeight });
  gsap.set('#panel', { scale: 1.2 });
  gsap.set('#tooltip', { scale: 1.4, transformOrigin: '100% 0' }); // legible at README width

  // Frame 0 is also the loop's last frame: the toolbar in its first state and the first caption.
  tl.set(['#tooltip', '#cap2a', '#cap2b', '#cap3', '#popup', '#popup-limits', '#panel', '#panel-alert',
    '#icon-alert', '#badge-alert', '#notice', '#privacy', '#privacy li', '#privacy .fine', '#cursor', '#tag-later'], { opacity: 0 }, 0);
  tl.set('#cursor', { x: 560, y: 560 }, 0);
  tl.set(meters, Object.fromEntries(fill.map((_, i) => [`m${i}`, 0])), 0);

  // Cursor targets in stage px (hotspot at 3,2 of the arrow). Popup controls are page px
  // measured from the product layout, mapped through the popup's position and scale.
  const inPopup = (x: number, y: number) => ({ x: 640 + x * POPUP.scale - 3, y: 60 + y * POPUP.scale - 2 });
  const ICON = { x: 1128 - 3, y: 14 - 2 }; // the button's top-right: the arrow falls outside the icon and badge
  const REST = { x: 580, y: 620 }; // below the caption, clear of the popup
  const VIEW_TOGGLE = inPopup(88, 469); // Home view footer: the view switcher's chevron
  const SIDE_PANEL_BUTTON = inPopup(261, 450); // Limits view footer: "Open side panel"
  const moveCursor = (to: { x: number; y: number }, at: number, dur: number) => {
    tl.to('#cursor', { x: to.x, duration: dur, ease: 'sine.inOut' }, at);
    tl.to('#cursor', { y: to.y, duration: dur, ease: 'power3.out' }, at);
  };
  const press = (at: number) =>
    tl.to('#cursor', { scale: 0.9, duration: 0.06, yoyo: true, repeat: 1, ease: 'power1.out' }, at);

  // Beat 1 (0-4.1): hover the toolbar icon; the product's own tooltip text appears.
  tl.fromTo('#cursor', { opacity: 0 }, { opacity: 1, duration: 0.2, immediateRender: false }, 0.25);
  moveCursor(ICON, 0.35, 0.8);
  show('#tooltip', 1.6, 0.15);
  hide('#tooltip', 3.9, 0.12);
  hide('#cap1', 3.9, 0.2);

  // Beat 2a (4.1-7.7): click; the popup drops from the icon, then the caption lands.
  press(4.1);
  show('#popup', 4.22, 0.3, { y: -12 });
  moveCursor(REST, 4.6, 0.6);
  show('#cap2a', 4.6, 0.35, { y: 8 });
  moveCursor(VIEW_TOGGLE, 6.9, 0.7);
  hide('#cap2a', 7.55, 0.15);
  press(7.7);

  // Beat 2b (7.7-10.8): the Limits view; once it has landed, meters fill as the product fills them.
  show('#popup-limits', 7.8, 0.2);
  tl.set('#popup-home', { opacity: 0 }, 8.0); // fully covered by now; the window is Limits-sized
  tl.fromTo('#popup', { height: POPUP.homeHeight }, { height: POPUP.limitsHeight, duration: 0.2, ease: EASE, immediateRender: false }, 7.8);
  show('#cap2b', 7.85, 0.35, { y: 8 });
  fill.forEach((_, i) => tl.fromTo(meters, { [`m${i}`]: 0 }, { [`m${i}`]: 1, duration: 0.6, ease: EASE, immediateRender: false }, 8.35 + i * 0.06));
  moveCursor(SIDE_PANEL_BUTTON, 10.0, 0.6);
  press(10.7);
  hide('#cap2b', 10.75, 0.15);

  // Beat 3 (10.8-15.8): the button docks the side panel and closes the popup, as in the
  // product. Ten minutes later the next refresh crosses 90%; the product's one alert appears.
  hide('#popup', 10.85, 0.25, { y: -8 });
  hide('#cursor', 11.0, 0.2);
  show('#panel', 10.95, 0.4, { x: 40 });
  show('#cap3', 11.15, 0.35, { y: 8 });
  hide('#tag', 12.2, 0.15);
  show('#tag-later', 12.25, 0.15);
  show('#panel-alert', 12.5, 0.2);
  show('#icon-alert', 12.5, 0.2);
  show('#badge-alert', 12.5, 0.2);
  hide('#icon-glance', 12.5, 0.2);
  hide('#badge-glance', 12.5, 0.2);
  show('#notice', 13.0, 0.3, { x: 24 });
  hide('#notice', 15.3, 0.2);
  hide('#cap3', 15.6, 0.2);

  // Beat 4 (15.8-21.6): the privacy summary (stage HTML in the product's pane style), then
  // back to frame 0 for a seamless loop. render.sh forces a WebP keyframe at 16.0 s and
  // 20.85 s (KEYFRAMES_AT_MS), right after the two fades below, so no ghost of a faded
  // layer survives in the README image. Keep those in step when moving these fades.
  hide('#panel', 15.8, 0.15);
  hide('#toolbar', 15.8, 0.15);
  hide('#tag-later', 15.8, 0.15);
  show('#tag', 15.8, 0.15);
  tl.set(['#icon-alert', '#badge-alert'], { opacity: 0 }, 16.0);
  tl.set(['#icon-glance', '#badge-glance'], { opacity: 1 }, 16.0);
  show('#privacy', 16.05, 0.3, { y: 12 });
  tl.fromTo(['#privacy li', '#privacy .fine'], { opacity: 0 }, { opacity: 1, duration: 0.2, stagger: 0.08, immediateRender: false }, 16.2);
  hide('#privacy', 20.5, 0.3);
  show('#toolbar', 20.85, 0.35);
  show('#cap1', 20.85, 0.35);

  const duration = Number($('#root').dataset.duration); // loop length lives in index.html
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('stage: #root needs a numeric data-duration');
  tl.set({}, {}, duration);

  window.__stageTimeline = tl;
  window.__timelines = window.__timelines ?? {};
  window.__timelines.root = tl;
}

if (document.getElementById('root')) init();
else document.addEventListener('DOMContentLoaded', init);
