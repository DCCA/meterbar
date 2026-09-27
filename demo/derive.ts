// Every piece of product copy the video shows outside the embedded pages (tooltip, OS
// notification, toolbar badge and icon) comes from the real src/ functions, never typed by hand.
import { alertCopy, buildTooltip } from '../src/shared/summary';
import { iconBars, type IconBar } from '../src/background/iconModel';
import { calculateBadgeState, type BadgeState } from '../src/background/badge';
import { evaluateAlerts } from '../src/background/alerts';
import { demoCards, demoNow, type DemoState } from './fixture';

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

  // The notification is whatever the product fires between the two refreshes (exactly one:
  // tests/demoFixture.test.ts), worded by the product's own alertCopy.
  const snaps = (state: DemoState) => demoCards(state).flatMap((c) => c.snapshots);
  const { state: seen } = evaluateAlerts(snaps('glance'), { seen: [], lastReset: {} });
  const [fired] = evaluateAlerts(snaps('alert'), seen).fired;
  if (!fired) throw new Error('demo: the alert refresh fires no product alert');
  const label = demoCards('alert').find((c) => c.provider === fired.provider)?.label ?? fired.provider;

  return {
    tooltip: buildTooltip(demoCards('glance')),
    alert: alertCopy({ ...fired, label }, new Date(demoNow('alert'))),
    badge: perState((s) => calculateBadgeState(demoCards(s).flatMap((c) => c.snapshots))),
    icon: perState((s) => iconBars(demoCards(s)))
  };
}
