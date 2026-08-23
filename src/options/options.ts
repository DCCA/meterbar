import { getAllCards, loadSettings, saveSettings, type Settings } from '../storage/usageStore';
import { aggregateCards, flattenSnapshots } from '../background/aggregate';
import { calculateBadgeState } from '../background/badge';
import { readAllHistory } from '../storage/historyStore';
import { historyToCsv, historyToJson } from '../shared/exporters';
import { BADGE_TARGETS, parseBadgeTarget, type BadgeTargetId } from '../shared/badgeTarget';
import type { ExtensionMessage } from '../shared/messages';

// Only the boolean settings drive the toggle switches.
type BoolSettingKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

const TOGGLES: Array<[id: string, key: BoolSettingKey]> = [
  ['notifications', 'notificationsEnabled'],
  ['claude', 'claudeEnabled'],
  ['chatgpt', 'chatgptEnabled'],
  ['gemini', 'geminiEnabled']
];

let statusTimer: ReturnType<typeof setTimeout> | undefined;
function setStatus(message: string): void {
  const el = document.querySelector('#status');
  if (!el) return;
  el.textContent = message;
  if (statusTimer) clearTimeout(statusTimer);
  if (message) statusTimer = setTimeout(() => { el.textContent = ''; }, 4000);
}

function download(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function riskClass(usedPercent?: number): string {
  if (usedPercent === undefined) return 'none';
  return usedPercent >= 90 ? 'crit' : usedPercent >= 70 ? 'warn' : 'ok';
}

// Segmented control: one button per target, each previewing the number the badge would
// show right now. Disabled (showing "--") when that target has no fresh data.
async function renderBadgeTargets(settings: Settings): Promise<void> {
  const group = document.querySelector<HTMLDivElement>('#badge-target');
  if (!group) return;
  const snapshots = flattenSnapshots(aggregateCards(await getAllCards(), settings));
  const current = parseBadgeTarget(settings.badgeTarget).id;
  group.replaceChildren(...BADGE_TARGETS.map((t) => {
    const state = calculateBadgeState(snapshots, t.id);
    const has = state.usedPercent !== undefined;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.role = 'radio';
    btn.dataset.target = t.id;
    btn.setAttribute('aria-checked', String(t.id === current));
    btn.disabled = !has && t.id !== current;
    const value = document.createElement('span');
    value.className = `seg-value ${riskClass(state.usedPercent)}`;
    value.textContent = has ? state.text : '--';
    btn.append(t.label, value);
    return btn;
  }));
}

async function render(): Promise<void> {
  const settings = await loadSettings();
  for (const [id, key] of TOGGLES) {
    const el = document.querySelector<HTMLInputElement>(`#${id}`);
    if (el) el.checked = settings[key];
  }

  await renderBadgeTargets(settings);
}

async function wire(): Promise<void> {
  for (const [id, key] of TOGGLES) {
    document.querySelector<HTMLInputElement>(`#${id}`)?.addEventListener('change', async (event) => {
      const current = await loadSettings();
      await saveSettings({ ...current, [key]: (event.target as HTMLInputElement).checked });
      void chrome.runtime.sendMessage({ type: 'usage:refresh' } as ExtensionMessage);
    });
  }

  document.querySelector('#badge-target')?.addEventListener('click', async (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-target]');
    if (!btn) return;
    const current = await loadSettings();
    const next = { ...current, badgeTarget: btn.dataset.target as BadgeTargetId };
    await saveSettings(next);
    await renderBadgeTargets(next);
    void chrome.runtime.sendMessage({ type: 'usage:refresh' } as ExtensionMessage);
  });

  // Keep the previews (and the checked state) live while the worker writes new data.
  chrome.storage.onChanged.addListener((_changes, area) => {
    if (area === 'local') void loadSettings().then(renderBadgeTargets);
  });

  const date = new Date().toISOString().slice(0, 10);
  document.querySelector('#export-json')?.addEventListener('click', async () => {
    download(`meterbar-history-${date}.json`, historyToJson(await readAllHistory()), 'application/json');
  });
  document.querySelector('#export-csv')?.addEventListener('click', async () => {
    download(`meterbar-history-${date}.csv`, historyToCsv(await readAllHistory()), 'text/csv');
  });

  document.querySelector<HTMLButtonElement>('#clear')?.addEventListener('click', async () => {
    if (!confirm('Clear all locally stored MeterBar data (usage history and settings)? This cannot be undone.')) return;
    await chrome.storage.local.clear();
    setStatus('Local MeterBar data cleared.');
    await render();
  });
}

void render();
void wire();
