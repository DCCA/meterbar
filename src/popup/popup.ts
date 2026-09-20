import { loadView, renderCardsInto, wireRefresh, wireViewSwitcher, type DashboardView } from '../ui/cardsView';
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

document.querySelector('#open-sidepanel')?.addEventListener('click', async () => {
  const win = await chrome.windows.getCurrent();
  if (win.id != null) {
    await chrome.sidePanel.open({ windowId: win.id });
    window.close(); // close the transient popup once the panel is docked
  }
});

void render();
