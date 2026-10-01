import { loadView, renderCardsInto, requestSurfaceRefresh, wireRefresh, wireViewSwitcher, type DashboardView } from '../ui/cardsView';
import { renderBadgeTargets, wireBadgeTargets } from '../ui/badgeTargetControl';
import { loadSettings } from '../storage/usageStore';

async function render(view: DashboardView = loadView()): Promise<void> {
  const container = document.querySelector<HTMLDivElement>('#cards');
  if (container) await renderCardsInto(container, view);
}

const refreshBtn = document.querySelector<HTMLButtonElement>('#refresh');
if (refreshBtn) wireRefresh(refreshBtn, () => render());

const switcher = document.querySelector<HTMLElement>('#view-switcher');
if (switcher) wireViewSwitcher(switcher, render);

const badgeGroup = document.querySelector<HTMLElement>('#badge-target');
if (badgeGroup) {
  wireBadgeTargets(badgeGroup);
  void loadSettings().then((settings) => renderBadgeTargets(badgeGroup, settings));
}

// The panel stays docked, so keep it live: re-render whenever the worker writes
// new usage data (latest cards / history) to local storage.
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === 'local') void render();
});

void render();
// The storage listener above re-renders when the refresh lands.
void requestSurfaceRefresh();
