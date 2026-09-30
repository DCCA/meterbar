import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(new URL('../.github/workflows/docs-update.yml', import.meta.url), 'utf8');

describe('docs workflow security', () => {
  it('pins every third-party action to a full commit SHA', () => {
    const uses = [...workflow.matchAll(/^\s*(?:-\s*)?uses:\s*([^\s#]+)/gm)].map((match) => match[1]);
    expect(uses).toHaveLength(3);
    for (const action of uses) expect(action).toMatch(/@[0-9a-f]{40}$/);
  });

  it('does not auto-merge model-authored documentation', () => {
    expect(workflow).not.toContain('gh pr merge');
  });

  it('does not pass a merged PR title into the model prompt or generated PR body', () => {
    expect(workflow).not.toContain('github.event.pull_request.title');
  });
});

describe('ci workflow security', () => {
  const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

  it('pins every action to a full commit SHA', () => {
    const uses = [...ci.matchAll(/^\s*(?:-\s*)?uses:\s*([^\s#]+)/gm)].map((match) => match[1]);
    expect(uses.length).toBeGreaterThan(0);
    for (const action of uses) expect(action).toMatch(/@[0-9a-f]{40}$/);
  });

  it('runs fork PRs with a read-only token and no secrets', () => {
    expect(ci).toMatch(/^permissions:\n\s+contents: read$/m);
    expect(ci).not.toContain('pull_request_target');
    expect(ci).not.toContain('secrets.');
  });
});
