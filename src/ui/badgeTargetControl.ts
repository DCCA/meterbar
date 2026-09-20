// Segmented radiogroup for the badge target (Auto / Claude / OpenAI). Shared by the
// popup header and the options page so the two never drift; BADGE_TARGETS is the source.
import { aggregateCards, flattenSnapshots } from '../background/aggregate';
import { calculateBadgeState } from '../background/badge';
import { riskLevel } from '../popup/render';
import { BADGE_TARGETS, parseBadgeTarget, type BadgeTargetId } from '../shared/badgeTarget';
import type { ExtensionMessage } from '../shared/messages';
import { getAllCards, loadSettings, saveSettings, type Settings } from '../storage/usageStore';

export interface BadgeTargetControlOptions {
  /** Show the live badge preview under each label (options page). */
  previews?: boolean;
}

export async function renderBadgeTargets(group: HTMLElement, settings: Settings, opts: BadgeTargetControlOptions = {}): Promise<void> {
  const snapshots = opts.previews ? flattenSnapshots(aggregateCards(await getAllCards(), settings)) : [];
  const current = parseBadgeTarget(settings.badgeTarget).id;
  const hadFocus = group.contains(document.activeElement);
  group.replaceChildren(...BADGE_TARGETS.map((t) => {
    const checked = t.id === current;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.role = 'radio';
    btn.dataset.target = t.id;
    btn.setAttribute('aria-checked', String(checked));
    btn.tabIndex = checked ? 0 : -1; // roving tabindex: one tab stop, arrows move within
    btn.append(t.label);
    if (opts.previews) {
      const state = calculateBadgeState(snapshots, t.id);
      const value = document.createElement('span');
      value.className = `seg-value ${state.usedPercent === undefined ? 'none' : riskLevel(state.usedPercent)}`;
      value.textContent = state.text;
      btn.append(value);
    }
    return btn;
  }));
  if (hadFocus) group.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
}

/** Wire clicks, arrow keys, and live re-render on storage writes. */
export function wireBadgeTargets(group: HTMLElement, opts: BadgeTargetControlOptions = {}): void {
  group.addEventListener('click', async (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-target]');
    if (!btn) return;
    const current = await loadSettings();
    const next = { ...current, badgeTarget: btn.dataset.target as BadgeTargetId };
    await saveSettings(next);
    await renderBadgeTargets(group, next, opts);
    void chrome.runtime.sendMessage({ type: 'usage:refresh' } as ExtensionMessage);
  });

  group.addEventListener('keydown', (event) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    const buttons = Array.from(group.querySelectorAll<HTMLButtonElement>('button[data-target]'));
    const i = buttons.findIndex((b) => b.getAttribute('aria-checked') === 'true');
    event.preventDefault();
    buttons[(i + step + buttons.length) % buttons.length].click();
  });

  chrome.storage.onChanged.addListener((_changes, area) => {
    if (area === 'local') void loadSettings().then((settings) => renderBadgeTargets(group, settings, opts));
  });
}
