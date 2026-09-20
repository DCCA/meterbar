import palette from '../ui/workbenchPalette.json';
import type { IconBar, IconLevel } from './iconModel';

const BAR_COLOR: Record<IconLevel, string> = {
  ok: palette.dark.ok,
  warn: palette.dark.warn,
  crit: palette.dark.crit
};
const CASING_COLOR = palette.icon.casing;
const CASING_BORDER = palette.icon.border;
const TRACK_COLOR = palette.icon.track;

const STATIC_ICON = { 16: 'assets/icon16.png', 48: 'assets/icon48.png', 128: 'assets/icon128.png' };

/** Draw the bars onto a square canvas of the given size and return its pixels. */
function drawBars(bars: IconBar[], size: number): ImageData {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  ctx.clearRect(0, 0, size, size);

  const caseInset = Math.max(1, Math.round(size * 0.05));
  const caseRadius = Math.max(2, Math.round(size * 0.2));
  ctx.fillStyle = CASING_COLOR;
  roundRect(ctx, caseInset, caseInset, size - caseInset * 2, size - caseInset * 2, caseRadius);
  ctx.fill();
  ctx.strokeStyle = CASING_BORDER;
  ctx.lineWidth = Math.max(1, Math.round(size * 0.045));
  ctx.stroke();

  const pad = Math.max(3, Math.round(size * 0.2));
  const gap = bars.length > 1 ? Math.max(1, Math.round(size * 0.07)) : 0;
  const top = pad;
  const bottom = size - pad;
  const trackH = bottom - top;
  const slot = (size - 2 * pad - gap * (bars.length - 1)) / bars.length;
  const radius = Math.min(slot, trackH) * 0.12;

  bars.forEach((bar, i) => {
    const x = pad + i * (slot + gap);
    ctx.fillStyle = TRACK_COLOR;
    roundRect(ctx, x, top, slot, trackH, radius);
    ctx.fill();

    const fillH = Math.max(bar.fillRatio > 0 ? size * 0.08 : 0, trackH * bar.fillRatio);
    if (fillH > 0) {
      ctx.fillStyle = BAR_COLOR[bar.level];
      roundRect(ctx, x, bottom - fillH, slot, fillH, radius);
      ctx.fill();
    }
  });

  return ctx.getImageData(0, 0, size, size);
}

function roundRect(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * Repaint the toolbar icon. With no bars (nobody connected with data) restore the bundled
 * static logo; otherwise draw one risk-colored bar per provider at 16px and 32px.
 * This is the only module that touches the canvas / chrome.action.setIcon (the I/O boundary).
 */
export async function renderIcon(bars: IconBar[]): Promise<void> {
  if (bars.length === 0) {
    await chrome.action.setIcon({ path: STATIC_ICON });
    return;
  }
  await chrome.action.setIcon({ imageData: { 16: drawBars(bars, 16), 32: drawBars(bars, 32) } });
}
