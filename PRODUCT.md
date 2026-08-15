# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: the AI power user / builder who works across Claude, ChatGPT/Codex, and Gemini in the same workday, has paid plans but still hits caps, and wants a quick glance before starting a session. Privacy-sensitive: will not accept prompt/chat collection. Checks the surface many times a day, usually mid-task. (Source: docs/PRD.md §3.)

Secondary (future, not current UI scope): small AI-heavy team leads wanting lightweight cross-team visibility. Explicit non-persona: enterprises needing billing integrations/SSO, and API-only teams. (Inferred from PRD §3; not user-confirmed.)

## Product Purpose

Show AI subscription usage limits before they stop the user's work — a quota surprise mid-session is the pain being removed. Success is glanceable: useful from the toolbar badge/icon alone before any dashboard is opened. (Source: PRD §1–2, §5.3.)

## Positioning

"One bar for all your AI limits." Sits between single-provider trackers (deep but not unified) and local proxy tools (powerful but heavy): lightweight unified visibility, local-first, no server. A neighboring product cannot truthfully copy the combination of multi-provider unification + nothing-leaves-the-device. (Source: PRD §4.)

## Operating Context

Chrome MV3 extension. Five surfaces: toolbar badge + dynamically painted multi-bar icon (always visible), hover tooltip, popup (Chrome caps at 600px height), dockable side panel, options page. Usage is read from the user's own logged-in provider sessions via undocumented endpoints; Gemini reports connection status only. Refresh loop every 10 minutes; data can go stale.

## Capabilities and Constraints

- Never collect chat content; store only usage metrics, reset timestamps, provider names, settings. Local-first, no backend, least-privilege permissions. (PRD §5.1–5.2, non-negotiable.)
- Truthful uncertainty: estimated/inferred/stale values must say so in the UI; never present a guess as exact. (PRD §5.5.)
- No routing/failover in the Chrome MVP. (PRD §5.6.)
- Canonical schema: `UsageSnapshot` (PRD §10); provider adapters isolated behind it. Provider-reported window durations drive labels and pacing, so positional fields are never assumed to mean a fixed period.
- **Confirmed 2026-07-25 (user decision): position means provider.** Fixed provider order everywhere — icon bars and popup/side-panel cards share the order Claude, ChatGPT, Codex, Gemini. Risk is expressed through color/pulse/badge number, never through reordering.
- **Confirmed 2026-07-25 (user decision): sparklines draw a fixed 24-hour span**, labeled, so identical shapes mean identical periods. Shown only on warn/crit rows.

## Brand Commitments

Name: MeterBar. Tagline: "One bar for all your AI limits." Voice: specific and unhedged, especially about privacy ("locally, never leaving your device"); errors name the problem and the recovery. Visual world (incumbent, documented nowhere else yet): permanently dark navy, green/amber/red risk semantics from one `riskLevel()` source, tabular-numeral percent typography. (Inferred from shipped UI; treat as binding until a redesign says otherwise.)

## Evidence on Hand

docs/PRD.md (authoritative product requirements, §10 data model, privacy rules — wins all conflicts). docs/superpowers/plans+specs (historical build records). `.impeccable/critique/` (scored design critiques; 2026-07-25: 20/40 before fix pass). No testimonials, benchmarks, or customer evidence exist — do not fabricate any.

## Product Principles

1. Glanceable before detailed — the badge/icon must carry the product alone.
2. Truthful uncertainty — staleness and estimation are rendered, not hidden.
3. Privacy is the moat — every surface reinforces nothing-leaves-the-device.
4. Position means provider; color means risk — spatial memory is never sacrificed to sorting.
5. Time makes percentages meaningful — a number without its reset countdown/pace is half a fact.
