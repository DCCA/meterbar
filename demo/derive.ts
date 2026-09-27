// Every piece of product copy the video shows outside the embedded pages (tooltip, OS
// notification, toolbar badge and icon) comes from the real src/ functions, never typed by hand.
import { alertCopy, buildTooltip } from '../src/shared/summary';
import { iconBars, type IconBar } from '../src/background/iconModel';
import { calculateBadgeState, type BadgeState } from '../src/background/badge';
import { demoCards, NOW, type DemoState } from './fixture';

export interface Derived {
  tooltip: string;
  alert: { title: string; message: string };
  badge: Record<DemoState, BadgeState>;
  icon: Record<DemoState, IconBar[]>;
}

const STATES: DemoState[] = ['glance', 'alert'];

export function deriveDemo(): Derived {
  const perState = <T>(fn: (state: DemoState) => T) =>
    Object.fromEntries(STATES.map((s) => [s, fn(s)])) as Record<DemoState, T>;

  const alertCards = demoCards('alert');
  const claude = alertCards.find((c) => c.provider === 'claude')!;
  const fiveHour = claude.snapshots.find((s) => s.window === 'five_hour')!;

  return {
    tooltip: buildTooltip(demoCards('glance')),
    alert: alertCopy(
      {
        kind: 'threshold',
        label: claude.label,
        window: fiveHour.window,
        usedPercent: fiveHour.usedPercent,
        resetsAt: fiveHour.resetsAt,
        confidence: fiveHour.confidence
      },
      new Date(NOW)
    ),
    badge: perState((s) => calculateBadgeState(demoCards(s).flatMap((c) => c.snapshots))),
    icon: perState((s) => iconBars(demoCards(s)))
  };
}
