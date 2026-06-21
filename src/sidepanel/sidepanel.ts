import { renderCardsInto, requestRefresh } from '../ui/cardsView';

async function render(): Promise<void> {
  const container = document.querySelector<HTMLDivElement>('#cards');
  if (container) await renderCardsInto(container);
}

document.querySelector('#refresh')?.addEventListener('click', () => {
  void requestRefresh().then(render);
});

// The panel stays docked, so keep it live: re-render whenever the worker writes
// new usage data (latest cards / history) to local storage.
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === 'local') void render();
});

void render();
