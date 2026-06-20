const DEFAULT_SETTINGS = {
  notificationsEnabled: true,
  claudeEnabled: true
};

type Settings = typeof DEFAULT_SETTINGS;

async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
  return stored as Settings;
}

async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set(settings);
}

async function render(): Promise<void> {
  const settings = await loadSettings();
  const notifications = document.querySelector<HTMLInputElement>('#notifications');
  const claude = document.querySelector<HTMLInputElement>('#claude');
  if (notifications) notifications.checked = settings.notificationsEnabled;
  if (claude) claude.checked = settings.claudeEnabled;
}

async function wire(): Promise<void> {
  document.querySelector<HTMLInputElement>('#notifications')?.addEventListener('change', async (event) => {
    const current = await loadSettings();
    await saveSettings({ ...current, notificationsEnabled: (event.target as HTMLInputElement).checked });
  });

  document.querySelector<HTMLInputElement>('#claude')?.addEventListener('change', async (event) => {
    const current = await loadSettings();
    await saveSettings({ ...current, claudeEnabled: (event.target as HTMLInputElement).checked });
  });

  document.querySelector<HTMLButtonElement>('#clear')?.addEventListener('click', async () => {
    await chrome.storage.local.clear();
    const status = document.querySelector('#status');
    if (status) status.textContent = 'Local MeterBar data cleared.';
    await render();
  });
}

render();
wire();
