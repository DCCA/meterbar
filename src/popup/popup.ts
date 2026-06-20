import { getMockCards } from '../providers/mock/mockAdapter';
import { formatCountdown } from '../shared/time';
import type { UsageSnapshot } from '../shared/types';

function classForSnapshot(snapshot: UsageSnapshot): string {
  if (snapshot.usedPercent >= 90) return 'crit';
  if (snapshot.usedPercent >= 70) return 'warn';
  return '';
}

function labelForWindow(window: UsageSnapshot['window']): string {
  return window.replace('_', ' ');
}

function render(): void {
  const container = document.querySelector<HTMLDivElement>('#cards');
  if (!container) return;

  container.innerHTML = getMockCards().map((card) => {
    const rows = card.snapshots.map((snapshot) => `
      <div class="row">
        <span>${labelForWindow(snapshot.window)}</span>
        <div class="bar"><div class="fill ${classForSnapshot(snapshot)}" style="width:${snapshot.usedPercent}%"></div></div>
        <strong>${snapshot.usedPercent}%</strong>
      </div>
      <div class="meta">${snapshot.resetsAt ? `resets in ${formatCountdown(snapshot.resetsAt)}` : 'reset unknown'} · ${snapshot.confidence}</div>
    `).join('');

    return `
      <article class="card">
        <h2>${card.label}</h2>
        ${rows || `<p class="meta">${card.message ?? card.status}</p>`}
      </article>
    `;
  }).join('');
}

document.querySelector('#refresh')?.addEventListener('click', render);
render();
