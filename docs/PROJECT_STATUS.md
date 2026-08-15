# Project status

Session logbook, newest first. Each entry: where the project was, what the session
changed (with evidence), and what is still open.

## 2026-08-23 - Security hardening (split from PR #25)

**Where we were:** The OpenAI window update worked in live testing, then a focused
security review found low-severity trust-boundary and privacy hardening gaps. Runtime
reports had incomplete schema/sender checks, authenticated fetches used default cache
behavior, the Gemini status script serialized the full page DOM, and one unused legacy
OpenAI host permission remained. The development dependency tree also had known audit
findings.

**What we did:**
- Validate runtime message schemas and authorize content reports by exact provider origin;
  privileged refresh/state requests now accept extension-page senders only.
- Add `cache: 'no-store'` to every credentialed provider request so the short-lived OpenAI
  access token and usage responses are not retained in the HTTP cache.
- Narrow Gemini sign-in detection to inline script payloads instead of reading rendered
  conversation DOM, while sending only the same fixed status message.
- Remove the unused `https://chat.openai.com/*` permission and defensively normalize
  corrupted stored status values before rendering.
- Upgrade Vite and Vitest to secure supported releases and refresh the lockfile.

**Evidence:** see PR. The built Gemini content script has no
module import and contains no full-page `innerHTML` read.

**Pending / next:**
- [ ] Reload the unpacked extension and confirm Gemini still changes between connected
      and signed-out status in a real Gemini session after the narrowed marker scan.

