# One OpenAI card for ChatGPT and Codex (2026-09-20)

## Finding

ChatGPT and Codex are one subscription and one endpoint. `GET chatgpt.com/backend-api/wham/usage`
returns an account-wide `rate_limit` pool (Codex / Work / agents) plus `additional_rate_limits`,
per-model caps that exist only while OpenAI publishes them (the checked-in capture has one,
`GPT-5.3-Codex-Spark`). The 2026-09-19 Workbench hardening split these into a "ChatGPT" card (the
pool) and a "Codex" card (the riskiest cap). On the live account the Codex card read "no Codex usage
window reported" while the "ChatGPT" card showed the Codex pool, so the split mislabeled one card and
left the other empty on every surface (popup, side panel, toolbar icon, trend, Omarchy widget/panel).

## Decision (user, 2026-09-20)

- One provider slot labeled **OpenAI** (id stays `chatgpt` so settings, history keys, and the badge
  target survive). Fixed order is Claude, OpenAI, Gemini.
- Pool windows stay as they are; the riskiest per-model cap becomes an extra window on the same card
  under `window: 'custom'` with `workspaceLabel` = its `limit_name`.
- `codex` is removed from `ProviderId`. Cards stored under the retired id are dropped by
  `aggregateCards`; legacy `codex*` badge-target ids still migrate to OpenAI.
- PRD sections 5 and 6.4 updated to three slots; toolbar icon, static icons, companion order, native
  host allowlist, and the Omarchy panel follow.
