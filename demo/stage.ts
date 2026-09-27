// The composition's one script: fills product-derived copy, paints the toolbar icon with
// the product's own drawBars, and builds the single paused GSAP timeline HyperFrames seeks.
// The timeline is built synchronously (a HyperFrames rule); motion inside the embedded
// product pages goes through setter proxies that re-apply whenever an iframe paints.
import type { gsap as Gsap } from 'gsap';
import { drawBars } from '../src/background/icon';
import { deriveDemo } from './derive';
import type { DemoState } from './fixture';

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
    $<HTMLCanvasElement>(`#icon-${state}`).getContext('2d')?.putImageData(drawBars(derived.icon[state], 48), 0, 0);
  }

  // --- Motion inside the embedded pages (setter proxies). --------------------------------
  const limitsFrame = $<HTMLIFrameElement>('#popup-limits');
  const fill = [1, 1, 1, 1]; // fill progress per Limits-view meter; 1 = the product's own width
  function applyMeters(): void {
    const doc = limitsFrame.contentDocument;
    if (!doc) return;
    doc.querySelectorAll<HTMLElement>('.meter b').forEach((bar, i) => {
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

  // --- Timeline. ----------------------------------------------------------------------------

  const tl = gsap.timeline({ paused: true });
  const show = (sel: string, at: number, dur = 0.3, from: gsap.TweenVars = {}) =>
    tl.fromTo(sel, { opacity: 0, ...from }, { opacity: 1, x: 0, y: 0, duration: dur, ease: EASE, immediateRender: false }, at);
  const hide = (sel: string, at: number, dur = 0.2, to: gsap.TweenVars = {}) =>
    tl.fromTo(sel, { opacity: 1 }, { opacity: 0, duration: dur, ease: 'power1.in', immediateRender: false, ...to }, at);

  // Frame 0 is also the loop's last frame: toolbar in its first state and the first caption.
  tl.set(['#tooltip', '#cap2a', '#cap2b', '#cap3', '#popup', '#popup-limits', '#panel', '#panel-alert',
    '#icon-alert', '#badge-alert', '#notice', '#privacy', '#cursor'], { opacity: 0 }, 0);
  tl.set('#cursor', { x: 560, y: 560 }, 0);
  // Mix 1 scale: GSAP owns these transforms, so the scale lives in GSAP too.
  gsap.set('#popup', { scale: 1.4 });
  gsap.set('#panel', { scale: 1.2 });

  // Cursor path helper: x and y on different eases trace a gentle arc.
  const ICON = { x: 1104 - 3, y: 20 - 2 }; // upper-left of the icon, clear of the badge
  const TOGGLE = { x: 763 - 3, y: 717 - 2 };
  const REST = { x: 600, y: 470 }; // beside the popup, off its content
  const moveCursor = (to: { x: number; y: number }, at: number, dur: number) => {
    tl.to('#cursor', { x: to.x, duration: dur, ease: 'sine.inOut' }, at);
    tl.to('#cursor', { y: to.y, duration: dur, ease: 'power3.out' }, at);
  };
  const press = (at: number) =>
    tl.to('#cursor', { scale: 0.9, duration: 0.06, yoyo: true, repeat: 1, ease: 'power1.out' }, at);

  // Beat 1 (0.0-3.5): hover the toolbar icon, the real tooltip appears.
  tl.fromTo('#cursor', { opacity: 0 }, { opacity: 1, duration: 0.2, immediateRender: false }, 0.25);
  moveCursor(ICON, 0.35, 0.8);
  show('#tooltip', 1.6, 0.15);
  hide('#tooltip', 3.3, 0.12);
  hide('#cap1', 3.3, 0.2);

  // Beat 2a (3.5-6.5): click, the popup drops from the icon.
  press(3.5);
  moveCursor(REST, 3.75, 0.6);
  show('#popup', 3.62, 0.3, { y: -12 });
  show('#cap2a', 3.8, 0.35, { y: 8 });
  moveCursor(TOGGLE, 5.6, 0.75);
  hide('#cap2a', 6.35, 0.15);
  press(6.45);

  // Beat 2b (6.5-9.0): switch to Limits, meters fill the way the product fills them.
  show('#popup-limits', 6.55, 0.2);
  // Chrome sizes a popup window to its content; Limits is shorter than Home (478.5 vs 497.5 px).
  tl.fromTo('#popup', { height: 494 }, { height: 479, duration: 0.2, ease: EASE, immediateRender: false }, 6.55);
  show('#cap2b', 6.6, 0.35, { y: 8 });
  fill.forEach((_, i) => tl.fromTo(meters, { [`m${i}`]: 0 }, { [`m${i}`]: 1, duration: 0.6, ease: EASE, immediateRender: false }, 6.75 + i * 0.06));
  hide('#cap2b', 8.8, 0.15);
  hide('#popup', 8.9, 0.25, { y: -8 });
  hide('#cursor', 8.9, 0.2);

  // Beat 3 (9.0-14.0): the side panel stays docked; a refresh crosses 90%, the OS alerts.
  show('#panel', 9.1, 0.4, { x: 40 });
  show('#cap3', 9.3, 0.35, { y: 8 });
  show('#panel-alert', 10.8, 0.2);
  show('#icon-alert', 10.8, 0.2);
  show('#badge-alert', 10.8, 0.2);
  hide('#icon-glance', 10.8, 0.2);
  hide('#badge-glance', 10.8, 0.2);
  show('#notice', 11.4, 0.3, { x: 24 });
  hide('#notice', 13.6, 0.2);
  hide('#cap3', 13.75, 0.2);

  // Beat 4 (14.0-18.0): privacy in the product's own pane, then back to frame 0.
  hide('#panel', 14.0, 0.3);
  hide('#toolbar', 14.0, 0.3);
  tl.set(['#icon-alert', '#badge-alert'], { opacity: 0 }, 14.35);
  tl.set(['#icon-glance', '#badge-glance'], { opacity: 1 }, 14.35);
  show('#privacy', 14.25, 0.45, { y: 12 });
  tl.fromTo('#privacy li', { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.08, immediateRender: false }, 14.45);
  hide('#privacy', 17.3, 0.3);
  show('#toolbar', 17.45, 0.35);
  show('#cap1', 17.45, 0.35);
  tl.set({}, {}, 18);

  window.__stageTimeline = tl;
  window.__timelines = window.__timelines ?? {};
  window.__timelines.root = tl;
}

if (document.getElementById('root')) init();
else document.addEventListener('DOMContentLoaded', init);
