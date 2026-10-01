import { loadSettings, saveSettings, type Settings } from '../storage/usageStore';
import { readAllHistory } from '../storage/historyStore';
import { historyToCsv, historyToJson } from '../shared/exporters';
import { renderBadgeTargets, wireBadgeTargets } from '../ui/badgeTargetControl';
import type { ExtensionMessage } from '../shared/messages';
import type { FetchProviderId } from '../shared/types';
import { clearCompanion, COMPANION_PERMISSION, hasCompanionPermission } from '../background/nativeBridge';

// Only the boolean settings drive the toggle switches.
type BoolSettingKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

const TOGGLES: Array<[id: string, key: BoolSettingKey]> = [
  ['notifications', 'notificationsEnabled'],
  ['backgroundRefresh', 'backgroundRefresh'],
  ['claude', 'claudeEnabled'],
  ['chatgpt', 'chatgptEnabled'],
  ['gemini', 'geminiEnabled']
];

const NOTICE: Record<FetchProviderId, { name: string; origin: string }> = {
  claude: { name: 'Claude', origin: 'claude.ai' },
  chatgpt: { name: 'OpenAI', origin: 'chatgpt.com' }
};

function noticeText({ name, origin }: { name: string; origin: string }): string {
  return `MeterBar reads your ${name} usage from an undocumented endpoint on ${origin}, using your existing login. `
    + 'It reads only percentages and reset times - never chats, cookies, or tokens. '
    + `${name} has not approved this, and automated access may conflict with its terms. Any account risk is yours.`;
}

/** Notice + Allow while unacknowledged, "Allowed <date> · Revoke" after; nothing for a disabled provider. */
function renderAcknowledgement(el: HTMLElement, provider: FetchProviderId, settings: Settings): void {
  const enabled = provider === 'claude' ? settings.claudeEnabled : settings.chatgptEnabled;
  const at = settings.acknowledged[provider];
  // Allow and Revoke replace each other; keep keyboard focus on whichever is shown next.
  const hadFocus = el.contains(document.activeElement);
  el.replaceChildren();
  if (!enabled) return;
  if (at) {
    const meta = document.createElement('p');
    meta.className = 'ack-meta';
    const when = new Date(at).toLocaleDateString([], { day: 'numeric', month: 'short' });
    meta.innerHTML = `<b>Allowed</b> ${when} · `;
    const revoke = document.createElement('button');
    revoke.type = 'button';
    revoke.className = 'linkish';
    revoke.dataset.action = 'revoke';
    revoke.textContent = 'Revoke';
    meta.append(revoke);
    el.append(meta);
    if (hadFocus) revoke.focus();
    return;
  }
  const box = document.createElement('div');
  box.className = 'consent';
  const text = document.createElement('p');
  text.textContent = noticeText(NOTICE[provider]);
  const allow = document.createElement('button');
  allow.type = 'button';
  allow.className = 'btn btn-primary';
  allow.dataset.action = 'allow';
  allow.textContent = `Allow reading ${NOTICE[provider].name} usage`;
  box.append(text, allow);
  el.append(box);
  if (hadFocus) allow.focus();
}

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
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('.ack[data-provider]'))) {
    renderAcknowledgement(el, el.dataset.provider as FetchProviderId, settings);
  }
  if (badgeGroup) await renderBadgeTargets(badgeGroup, settings, { previews: true });
  const companion = document.querySelector<HTMLInputElement>('#companion');
  if (companion) companion.checked = await hasCompanionPermission();
}

async function wire(): Promise<void> {
  for (const [id, key] of TOGGLES) {
    document.querySelector<HTMLInputElement>(`#${id}`)?.addEventListener('change', async (event) => {
      const current = await loadSettings();
      // The worker reacts to the storage write (refresh, alarm, repaint).
      await saveSettings({ ...current, [key]: (event.target as HTMLInputElement).checked });
      await render();
    });
  }

  for (const el of Array.from(document.querySelectorAll<HTMLElement>('.ack[data-provider]'))) {
    el.addEventListener('click', async (event) => {
      const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
      if (!action) return;
      const provider = el.dataset.provider as FetchProviderId;
      const current = await loadSettings();
      const acknowledged = { ...current.acknowledged };
      if (action === 'allow') acknowledged[provider] = new Date().toISOString();
      else delete acknowledged[provider];
      await saveSettings({ ...current, acknowledged });
      await render();
      if (action === 'revoke') setStatus(`${NOTICE[provider].name} paused - MeterBar reads nothing until you allow it again.`);
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
