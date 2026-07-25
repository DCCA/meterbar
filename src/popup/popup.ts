import { renderCardsInto, wireRefresh } from '../ui/cardsView';

async function render(): Promise<void> {
  const container = document.querySelector<HTMLDivElement>('#cards');
  if (container) await renderCardsInto(container);
}

const refreshBtn = document.querySelector<HTMLButtonElement>('#refresh');
if (refreshBtn) wireRefresh(refreshBtn, render);

document.querySelector('#open-sidepanel')?.addEventListener('click', async () => {
  const win = await chrome.windows.getCurrent();
  if (win.id != null) {
    await chrome.sidePanel.open({ windowId: win.id });
    window.close(); // close the transient popup once the panel is docked
  }
});

void render();
