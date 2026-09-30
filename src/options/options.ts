import { loadSettings, saveSettings, type Settings } from '../storage/usageStore';
import { readAllHistory } from '../storage/historyStore';
import { historyToCsv, historyToJson } from '../shared/exporters';
import { renderBadgeTargets, wireBadgeTargets } from '../ui/badgeTargetControl';
import type { ExtensionMessage } from '../shared/messages';
import { clearCompanion, COMPANION_PERMISSION, hasCompanionPermission } from '../background/nativeBridge';

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

const badgeGroup = document.querySelector<HTMLElement>('#badge-target');

async function render(): Promise<void> {
  const settings = await loadSettings();
  for (const [id, key] of TOGGLES) {
    const el = document.querySelector<HTMLInputElement>(`#${id}`);
    if (el) el.checked = settings[key];
  }
  if (badgeGroup) await renderBadgeTargets(badgeGroup, settings, { previews: true });
  const companion = document.querySelector<HTMLInputElement>('#companion');
  if (companion) companion.checked = await hasCompanionPermission();
}

async function wire(): Promise<void> {
  for (const [id, key] of TOGGLES) {
    document.querySelector<HTMLInputElement>(`#${id}`)?.addEventListener('change', async (event) => {
      const current = await loadSettings();
      await saveSettings({ ...current, [key]: (event.target as HTMLInputElement).checked });
      void chrome.runtime.sendMessage({ type: 'usage:refresh' } as ExtensionMessage);
    });
  }

  if (badgeGroup) wireBadgeTargets(badgeGroup, { previews: true });

  // The switch state is the granted permission itself; there is no separate setting.
  const companion = document.querySelector<HTMLInputElement>('#companion');
  companion?.addEventListener('change', async () => {
    if (companion.checked) {
      companion.checked = await chrome.permissions.request(COMPANION_PERMISSION).catch(() => false);
      if (!companion.checked) setStatus('Companion stays off - native messaging was not granted.');
      return;
    }
    const cleared = await clearCompanion();
    await chrome.permissions.remove(COMPANION_PERMISSION).catch(() => false);
    companion.checked = await hasCompanionPermission();
    setStatus(cleared ? 'Companion off. Its snapshot was removed.' : 'Companion off. Its snapshot may remain.');
  });

  const date = new Date().toISOString().slice(0, 10);
  document.querySelector('#export-json')?.addEventListener('click', async () => {
    download(`meterbar-history-${date}.json`, historyToJson(await readAllHistory()), 'application/json');
  });
  document.querySelector('#export-csv')?.addEventListener('click', async () => {
    download(`meterbar-history-${date}.csv`, historyToCsv(await readAllHistory()), 'text/csv');
  });

  document.querySelector<HTMLButtonElement>('#clear')?.addEventListener('click', async () => {
    if (!confirm('Clear all locally stored MeterBar data, including the optional companion snapshot? This cannot be undone.')) return;
    try {
      const result = await chrome.runtime.sendMessage({ type: 'data:clear' } as ExtensionMessage) as
        | { ok?: boolean; companionCleared?: boolean }
        | undefined;
      if (!result?.ok) {
        setStatus('MeterBar data could not be cleared. Try again.');
      } else {
        setStatus(result.companionCleared
          ? 'Local MeterBar data cleared.'
          : 'Browser data cleared. The optional companion snapshot may remain.');
      }
      await render();
    } catch {
      setStatus('MeterBar data could not be cleared. Try again.');
    }
  });
}

void render();
void wire();
