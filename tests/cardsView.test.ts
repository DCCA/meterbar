import { describe, expect, it } from 'vitest';
import { KNOWN } from '../src/ui/cardsView';

describe('Workbench provider slots', () => {
  it('keeps the user-confirmed Claude, ChatGPT, Codex, Gemini order', () => {
    expect(KNOWN).toEqual([
      { provider: 'claude', label: 'Claude' },
      { provider: 'chatgpt', label: 'ChatGPT' },
      { provider: 'codex', label: 'Codex' },
      { provider: 'gemini', label: 'Gemini' }
    ]);
  });
});
