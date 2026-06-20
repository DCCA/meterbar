import { loadSettings, saveSettings, type Settings } from '../storage/usageStore';
import { readAllHistory } from '../storage/historyStore';
import { historyToCsv, historyToJson } from '../shared/exporters';
import type { ExtensionMessage } from '../shared/messages';

const TOGGLES: Array<[id: string, key: keyof Settings]> = [
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

async function render(): Promise<void> {
  const settings = await loadSettings();
  for (const [id, key] of TOGGLES) {
    const el = document.querySelector<HTMLInputElement>(`#${id}`);
    if (el) el.checked = settings[key];
  }
}

async function wire(): Promise<void> {
  for (const [id, key] of TOGGLES) {
    document.querySelector<HTMLInputElement>(`#${id}`)?.addEventListener('change', async (event) => {
      const current = await loadSettings();
      await saveSettings({ ...current, [key]: (event.target as HTMLInputElement).checked });
      void chrome.runtime.sendMessage({ type: 'usage:refresh' } as ExtensionMessage);
    });
  }

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
