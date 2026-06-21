import { renderCardsInto, requestRefresh } from '../ui/cardView';

const container = document.querySelector<HTMLDivElement>('#cards');

function rerender(): void {
  if (container) void renderCardsInto(container);
}

document.querySelector('#refresh')?.addEventListener('click', () => {
  void requestRefresh().then(rerender);
});

// The panel stays docked, so keep it live: re-render whenever the worker writes
// new usage data (latest cards / history) to local storage.
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === 'local') rerender();
});

rerender();
