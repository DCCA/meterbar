import { describe, expect, it } from 'vitest';
import { hasGeminiAuthMarker } from '../src/content/gemini';

function scripts(...text: Array<string | null>): ArrayLike<{ textContent: string | null }> {
  return text.map((textContent) => ({ textContent }));
}

describe('hasGeminiAuthMarker', () => {
  it('finds the sign-in marker only in script payloads', () => {
    expect(hasGeminiAuthMarker(scripts('window.bootstrap={"SNlM0e":"token"}'))).toBe(true);
    expect(hasGeminiAuthMarker(scripts('const unrelated = true', null))).toBe(false);
  });

  it('does not need rendered conversation text', () => {
    const conversation = '<main>private prompt and private response</main>';
    expect(hasGeminiAuthMarker(scripts(conversation))).toBe(false);
  });
});
