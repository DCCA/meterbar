import { renderCardsInto, requestRefresh } from '../ui/cardsView';

async function render(): Promise<void> {
  const container = document.querySelector<HTMLDivElement>('#cards');
  if (container) await renderCardsInto(container);
}

function setRefreshing(on: boolean): void {
  const btn = document.querySelector<HTMLButtonElement>('#refresh');
  if (!btn) return;
  btn.disabled = on;
  btn.setAttribute('aria-busy', String(on));
  btn.classList.toggle('is-busy', on);
}

document.querySelector('#refresh')?.addEventListener('click', () => {
  setRefreshing(true);
  void requestRefresh()
    .then(render)
    .finally(() => setRefreshing(false));
});

document.querySelector('#open-sidepanel')?.addEventListener('click', async () => {
  const win = await chrome.windows.getCurrent();
  if (win.id != null) {
    await chrome.sidePanel.open({ windowId: win.id });
    window.close(); // close the transient popup once the panel is docked
  }
});

void render();
