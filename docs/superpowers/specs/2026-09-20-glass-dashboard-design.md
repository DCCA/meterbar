# Glass dashboard design (2026-09-20)

User-picked direction after three rendered rounds: MeterBar adopts the structure and
material of Token Monitor's Limits/Home views (reference: github.com/Javis603/token-monitor,
`src/electron/renderer/styles.css`), not just its colors.

## Decisions

- **Material**: frosted glass shell. Tint `rgba(48,52,56,.68)`, `blur(32px) saturate(115%)`,
  14px radius, `0 22px 55px` shadow. Chrome popup paints its own ambient field behind the
  glass (the popup window is opaque). Omarchy uses the theme's popup background.
- **Type**: monospace UI (`JetBrains Mono` / `ui-monospace`), 11px base, 10px meta.
- **Structure**: mark + badge-target segmented control (Auto / Claude / OpenAI, the real
  setting) in the header; hero "Tightest limit" number; sections split by hairlines; footer
  with a view switcher (Home / Limits) on the left and icon buttons on the right.
- **Home view**: hero, 24-hour trend (one line per provider, its tightest window, fixed
  provider hues, 70/90 guides, direct labels + legend, crosshair tooltip), then limits as
  compact text rows.
- **Limits view**: per-provider sections with Updated stamp, window columns, 6px bars in
  risk color, pace tick, "Reset in" countdown, inferred/estimated notes, stale and empty
  states.
- **Semantics kept from the PRD**: "% used", risk colors green/amber/red everywhere,
  fixed provider order, truthful uncertainty, Gemini status-only. No daily bars (D2 rejected).
- **Light and dark**: both shipped; the popup follows `prefers-color-scheme`.
- **Omarchy**: bar widget = four mini bars + tightest percent; panel = hero, trend, compact
  limits. The companion snapshot gains an optional per-card `history` (24h, <= 64 points,
  tightest window) so the panel can draw the trend without any provider access.

## Out of scope

Token counts and cost (MeterBar never sees tokens), daily consumption bars, shell config
edits (Hyprland blur rules are the user's).
