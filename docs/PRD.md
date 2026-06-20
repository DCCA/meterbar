# MeterBar Product Requirements Document

**Product:** MeterBar  
**Repo:** `DCCA/meterbar`  
**Visibility:** Private  
**Date:** 2026-06-20  
**Owner:** DCCA  
**Status:** Draft v0.1

---

## 1. One-liner

**MeterBar is a privacy-first Chrome extension that shows Claude, ChatGPT/Codex, Gemini, and future AI subscription usage limits in one real-time browser bar.**

---

## 2. Problem

AI power users increasingly rely on several subscription-based AI products during the same workday:

- Claude / Claude Code
- ChatGPT / Codex
- Gemini
- future coding agents and AI tools

Each service exposes limits differently, often late, vaguely, or only after the user is already near exhaustion. Users are forced to manually check separate product UIs, infer resets, or wait until they are blocked mid-task.

The pain is especially acute for builders using AI tools as part of a daily workflow. A quota surprise can derail a coding session, research sprint, or content workflow.

---

## 3. Target user

### Primary persona: AI power user / builder

- Uses Claude, ChatGPT/Codex, and Gemini across browser and coding workflows.
- Has paid plans but still hits usage caps.
- Wants a quick glance before starting a session.
- Cares about privacy and does not want prompt/chat contents collected.
- Is willing to install a Chrome extension if the value is immediate and visible.

### Secondary persona: small AI-heavy team lead

- Wants lightweight visibility across teammates' AI usage.
- Does not necessarily want to move everyone to enterprise/team plans.
- Needs breach signals, weekly reports, and plan-fit insights.

### Not the initial persona

- Large enterprises needing official billing integrations, SSO, procurement, audit workflows, or admin consoles.
- API-only teams who need metering from provider billing APIs rather than browser subscriptions.

---

## 4. Product positioning

### Short positioning

> One bar for all your AI limits.

### Longer positioning

> MeterBar shows your AI subscription limits before they stop your work — starting with Claude, ChatGPT/Codex, and Gemini in Chrome.

### Differentiation

MeterBar should sit between simple single-provider extensions and heavier local proxy products.

| Product style | Example | Strength | Gap MeterBar targets |
|---|---|---|---|
| Single-provider browser tracker | Claude Usage Tracker | Deep per-provider UX | Not unified across providers |
| Multi-provider extension/dashboard | Claude Tuner | Strong analytics/team features | Trust/privacy concerns if server-first |
| Local proxy/menu bar | Quotio | CLI control, routing, failover | Heavier setup, macOS/coding-agent focused |
| MeterBar | This product | Lightweight unified visibility | Starts as visibility, may later add local companion |

---

## 5. Guiding principles

1. **Privacy-first by default**  
   No prompt, message, file, attachment, or chat content collection.

2. **Local-first MVP**  
   Usage snapshots and history stay in browser storage unless the user explicitly enables sync/team features later.

3. **Glanceable before detailed**  
   The product should be useful from the Chrome toolbar badge and compact popup before any advanced dashboard exists.

4. **Provider adapters, not a monolith**  
   Each provider integration should be isolated behind a common usage schema.

5. **Truthful uncertainty**  
   If a value is estimated, inferred, stale, or based on undocumented endpoints, the UI must say so.

6. **No routing/failover in the Chrome-only MVP**  
   Routing belongs to a later companion app or local proxy, not the first browser extension.

---

## 6. MVP scope

### MVP goal

Give one user a reliable, private, real-time-ish view of AI usage limits in Chrome for at least Claude first, with an architecture ready for ChatGPT/Codex and Gemini.

### MVP must-have features

#### 6.1 Chrome toolbar badge

- Shows current highest-risk provider usage as a percentage.
- Badge color states:
  - Green: below 70%
  - Yellow/orange: 70–89%
  - Red: 90%+
  - Gray: unknown/stale/not logged in

#### 6.2 Popup dashboard

The extension popup shows provider cards:

- Claude
- ChatGPT/Codex placeholder
- Gemini placeholder

Each card includes:

- provider name
- status: connected / not connected / stale / unsupported
- usage windows when known
- percentage consumed
- reset time/countdown when known
- last updated timestamp
- confidence label: exact / estimated / unavailable

#### 6.3 Claude adapter

Initial real adapter for Claude browser usage.

Minimum tracked windows:

- 5-hour session usage, if exposed
- 7-day usage, if exposed
- reset timestamp/countdown, if exposed

Implementation may rely on claude.ai requests/endpoints visible to the logged-in browser session.

#### 6.4 Local storage

Store usage snapshots locally using Chrome storage or IndexedDB.

Minimum stored fields:

- provider
- account/workspace identifier if available and non-sensitive
- usage window type
- used percentage
- reset timestamp
- captured timestamp
- source
- confidence

#### 6.5 Alert thresholds

Local notifications for:

- 70% warning
- 90% critical
- reset detected / usage replenished

Thresholds can be hardcoded for MVP.

#### 6.6 Settings page

Minimum settings:

- enable/disable provider cards
- enable/disable notifications
- clear local history
- privacy explanation

---

## 7. Explicit non-goals for MVP

- No backend service.
- No team dashboard.
- No cloud sync.
- No account creation.
- No paid billing.
- No CLI quota tracking.
- No local proxy.
- No automatic provider failover.
- No editing shell/CLI config files.
- No reading local filesystem.
- No collecting chat content.
- No promise of official provider API support.

---

## 8. Future scope

### Phase 2: Multi-provider browser tracking

- ChatGPT/Codex adapter.
- Gemini adapter.
- Provider-specific reset semantics.
- More robust history and trend chart.
- CSV/JSON export.

### Phase 3: Advanced personal dashboard

- Daily/weekly usage trends.
- Limit-hit prediction.
- Plan-fit recommendation.
- Usage pacing: are you burning quota faster than the reset window?
- Configurable thresholds.

### Phase 4: Optional sync/team mode

Only after explicit consent:

- Account-based sync.
- Team dashboard.
- Member usage snapshots.
- Weekly reports.
- Admin privacy controls.

### Phase 5: Local companion app

Approach parity with products like Quotio by adding:

- native tray/menu bar
- Native Messaging Host
- local proxy
- Claude Code / Codex CLI / Gemini CLI visibility
- local-only CLI status API
- optional routing/failover experiments

---

## 9. User stories

### Story 1: Quick glance before working

As an AI-heavy user, I want a Chrome toolbar indicator showing whether any AI provider is near its limit, so I can choose the right tool before starting work.

**Acceptance criteria:**

- Badge displays a percentage or unknown state.
- Badge color reflects risk level.
- Hover/click reveals which provider is driving the badge.

### Story 2: Understand Claude remaining usage

As a Claude user, I want to see my current 5-hour and weekly usage windows, so I avoid starting a long task when I am near exhaustion.

**Acceptance criteria:**

- Popup shows Claude connected when logged into claude.ai.
- Popup shows at least one usage window if available.
- Popup shows reset time/countdown if available.
- Popup labels stale or unavailable data clearly.

### Story 3: Stay private

As a privacy-conscious user, I want MeterBar to avoid reading or storing prompt/chat content, so I can trust installing it.

**Acceptance criteria:**

- Privacy section explains exactly what is collected.
- Local storage contains usage metrics only.
- Clear local history control works.

### Story 4: Get warned before a limit hit

As a user, I want to receive warnings before hitting limits, so I can switch providers or pause before being blocked.

**Acceptance criteria:**

- Notification fires at 70% and 90% thresholds.
- Notification includes provider and window.
- Repeated notifications are rate-limited.

---

## 10. Data model

Canonical usage snapshot:

```json
{
  "provider": "claude",
  "accountIdHash": "optional-stable-non-reversible-id",
  "workspaceLabel": "optional-display-name",
  "window": "five_hour",
  "usedRatio": 0.62,
  "usedPercent": 62,
  "resetsAt": "2026-06-20T18:30:00Z",
  "capturedAt": "2026-06-20T14:12:00Z",
  "source": "claude-web-usage-endpoint",
  "confidence": "exact",
  "stale": false
}
```

Provider enum:

- `claude`
- `chatgpt`
- `codex`
- `gemini`
- `unknown`

Window enum:

- `five_hour`
- `seven_day`
- `daily`
- `monthly`
- `api_billing`
- `custom`

Confidence enum:

- `exact`
- `estimated`
- `inferred`
- `unavailable`

---

## 11. Security and privacy requirements

### Data that must never be collected

- chat messages
- prompts
- completions
- uploaded files
- page screenshots
- full browsing history
- API keys unless a later feature explicitly requires user-provided keys
- raw session cookies

### Data allowed in MVP

- usage percentages
- reset timestamps
- provider names
- anonymous/local account identifiers when needed for dedupe
- extension settings
- local usage history

### Architecture constraints

- No backend calls in MVP except provider pages/endpoints required to read usage.
- No remote analytics in MVP.
- Use least-privilege host permissions.
- Clearly declare permissions in README and Chrome extension copy.

---

## 12. UX concept

### Toolbar badge

Examples:

- `42` green = highest active provider usage is 42%
- `81` orange = at least one provider window at 81%
- `95` red = urgent
- `?` gray = no fresh data

### Popup layout

```text
MeterBar
One bar for all your AI limits

Overall: 62% highest usage · Claude 5h

Claude
5h      ██████░░░░ 62%   resets in 2h 14m
7d      ████░░░░░░ 41%   resets Thu 8pm
last updated 2m ago · exact

ChatGPT / Codex
Not connected yet

Gemini
Not connected yet

[Settings] [Privacy] [Refresh]
```

---

## 13. Success metrics

### MVP qualitative success

- The user can install the extension locally.
- The user can see Claude usage in the popup.
- The badge updates based on Claude usage.
- No prompt/chat content is stored.

### MVP quantitative success

- Fresh usage displayed within 10 minutes of a relevant provider update.
- Popup loads under 300ms from local state.
- Extension stores fewer than 100KB for basic local history after one day.
- Notification de-duplication prevents repeated alerts more than once per threshold/window/reset cycle.

---

## 14. Open questions

1. Which provider should be first after Claude: ChatGPT/Codex or Gemini?
2. Should ChatGPT and Codex be treated as separate providers or one provider with multiple windows?
3. Should MeterBar start as a pure local extension, or include an optional self-hosted endpoint from the beginning?
4. Should the repo include a public landing page now, or wait until the extension has a working provider adapter?
5. How aggressively should MeterBar attempt to discover undocumented provider endpoints versus only observing requests already made by the official UI?
6. What is the minimum privacy posture required before making the repo public?

---

## 15. Recommended MVP decision

Start with a **Chrome extension only**, local-first, Claude-first.

Reasoning:

- It validates the core user value quickly.
- It avoids overbuilding a Quotio-like local proxy too early.
- It creates a narrow trust promise: “usage limits, not chat content.”
- It gives us a natural path to multi-provider and companion app later.

---

## 16. Suggested repo description

```text
Privacy-first Chrome extension that shows AI subscription usage limits in one real-time bar.
```

## 17. Suggested tagline

```text
One bar for all your AI limits.
```
