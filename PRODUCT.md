# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: the AI power user or builder who works across Claude, ChatGPT/Codex, and Gemini in the same workday, has paid plans but still hits caps, and wants a quick glance before starting or continuing a session. This user is privacy-sensitive, will not accept prompt or chat collection, and checks MeterBar repeatedly while working. (Source: docs/PRD.md §3.)

MeterBar is deliberately a personal, single-user product. Team dashboards, cross-member visibility, enterprise administration, and API-only billing workflows are not target use cases. (Confirmed 2026-09-19.)

## Product Purpose

Show AI subscription usage limits before they stop the user's work. A quota surprise mid-session is the pain being removed. Success is glanceable: the toolbar instrument should be useful before the popup or side panel is opened. (Source: docs/PRD.md §1-2, §5.3.)

## Positioning

"One bar for all your AI limits." MeterBar sits between single-provider trackers, which are deep but fragmented, and local proxy tools, which are powerful but heavy. Its distinct mechanism is unified multi-provider visibility from the user's own browser sessions, with usage data kept on the user's device and no MeterBar backend. (Source: docs/PRD.md §4.)

## Operating Context

MeterBar is a Chrome Manifest V3 extension with five browser surfaces: the toolbar badge and four-channel icon, hover tooltip, popup, dockable side panel, and options page. The popup is constrained by Chrome's 600px height. A 10-minute refresh loop reads the user's logged-in provider sessions; undocumented provider sources can change, and data can become stale. Gemini reports connection status only because no stable, verified consumer usage source is available.

An optional Omarchy companion is an experimental display preview, not a stable product surface. It renders a sanitized local snapshot through Native Messaging. Chrome remains the sole provider collector; the preview performs no provider requests and adds no CLI tracking, proxy, routing, or failover. (Confirmed 2026-09-19.)

## Capabilities and Constraints

- Never collect chat content. Store only usage metrics, reset timestamps, provider names, local history, and settings. Raw cookies, tokens, API keys, prompts, completions, files, screenshots, and browsing history are prohibited. (PRD §11, non-negotiable.)
- Local-first and personal-only: no MeterBar backend, cloud sync, remote analytics, account system, or team dashboard.
- Truthful uncertainty: inferred, estimated, stale, unavailable, and undocumented readings must be labeled rather than presented as exact.
- Fixed provider order everywhere: Claude, ChatGPT, Codex, Gemini. Position identifies the provider; color, pulse, and the badge number express risk. (Confirmed 2026-07-25.)
- ChatGPT and Codex have separate cards and history while sharing one OpenAI enablement setting and badge target.
- The 24-hour trend is the only history chart: one line per provider (its tightest window) over one labeled 24-hour span, in fixed provider hues, with direct labels and a legend. No daily consumption bars, token counts, or cost. (Confirmed 2026-09-20; replaces the 2026-07-25 sparkline rule.)
- No routing, failover, local proxy, CLI collection, or shell configuration editing in the Chrome product.
- Clearing MeterBar data removes browser-local state and requests deletion of the experimental companion snapshot when the host is installed.

## Brand Commitments

Name: MeterBar. Tagline: "One bar for all your AI limits." Voice: specific, calm, and unhedged about privacy and uncertainty. Privacy copy says what stays local; error copy names the problem and the recovery. Provider trademarks identify the services MeterBar reads and never imply affiliation or endorsement.

## Evidence on Hand

- `docs/PRD.md` is the authoritative requirements and privacy record; its security rules win every conflict.
- `README.md` documents the shipped browser and experimental companion behavior.
- `docs/PROJECT_STATUS.md` records implementation history and product decisions.
- `docs/superpowers/plans/` and `docs/superpowers/specs/` are historical implementation records, not active requirements.
- No testimonials, customer logos, benchmarks, pricing proof, or adoption evidence exists. Future work must not fabricate them.

## Product Principles

1. Glanceable before detailed: the toolbar instrument must carry useful risk information by itself.
2. Truthful uncertainty: freshness, source confidence, and unavailable data are rendered, not hidden.
3. Privacy is the moat: provider collection stays in Chrome and usage data stays on the user's device.
4. Position means provider; color means risk: spatial memory is never sacrificed to sorting.
5. Time makes percentages meaningful: a usage value needs its reset timing, pacing, or explicit absence.
