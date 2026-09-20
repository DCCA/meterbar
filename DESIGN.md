---
name: MeterBar
description: One bar for all your AI limits.
colors:
  bg-deep: "#0e111a"
  ambient-blue: "#2a3b66"
  ambient-violet: "#3b2450"
  surface: "#303438"
  surface-strong: "#1f2329"
  overlay: "#ffffff"
  line: "#e8eef4"
  sunken: "#04080d"
  text: "#eef5fb"
  muted: "#a3adbb"
  number: "#f3fbf7"
  accent: "#b7ead4"
  ok: "#b7ead4"
  warn: "#f1d973"
  crit: "#f47788"
  series-claude: "#d9702f"
  series-openai: "#35a577"
  series-codex: "#4189cf"
  shadow: "#000000"
  glass: "rgb(48 52 56 / 0.56)"
  hairline: "rgb(232 238 244 / 0.14)"
  hairline-strong: "rgb(232 238 244 / 0.24)"
  hairline-soft: "rgb(232 238 244 / 0.12)"
  control: "rgb(255 255 255 / 0.05)"
  control-hover: "rgb(255 255 255 / 0.07)"
  control-active: "rgb(255 255 255 / 0.10)"
  track: "rgb(4 8 13 / 0.44)"
  bg-deep-light: "#e6ebf2"
  ambient-blue-light: "#cfe3ff"
  ambient-pink-light: "#f4d9e8"
  surface-light: "#eceff3"
  surface-strong-light: "#f7f9fb"
  overlay-light: "#000000"
  line-light: "#141c24"
  sunken-light: "#141c24"
  text-light: "#141c24"
  muted-light: "#5b6673"
  number-light: "#0f171f"
  accent-light: "#146e45"
  ok-light: "#146e45"
  warn-light: "#7d5e00"
  crit-light: "#b5283f"
  series-claude-light: "#8e3417"
  series-openai-light: "#127a5a"
  series-codex-light: "#1f64a3"
  glass-light: "rgb(236 239 243 / 0.56)"
  hairline-light: "rgb(20 28 36 / 0.14)"
  hairline-strong-light: "rgb(20 28 36 / 0.24)"
  hairline-soft-light: "rgb(20 28 36 / 0.12)"
  control-light: "rgb(0 0 0 / 0.05)"
  control-hover-light: "rgb(0 0 0 / 0.07)"
  control-active-light: "rgb(0 0 0 / 0.10)"
  track-light: "rgb(20 28 36 / 0.12)"
  icon-casing: "#303438"
  icon-border: "#5a6068"
  icon-track: "#1b1f24"
  icon-accent: "#b7ead4"
typography:
  display:
    fontFamily: "\"JetBrains Mono\", \"JetBrainsMono Nerd Font\", ui-monospace, SFMono-Regular, Menlo, Consolas, \"Liberation Mono\", monospace"
    fontSize: "40px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "15px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "0.06em"
  subtitle:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "normal"
  body:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "normal"
  meta:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  label:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0.06em"
  micro:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "9px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  pane: "14px"
  control: "7px"
  pill: "9px"
  chip: "6px"
  badge: "5px"
  meter: "3px"
  casing: "10px"
  dot: "50%"
spacing:
  2xs: "2px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  2xl: "14px"
  3xl: "18px"
components:
  glass-pane:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.text}"
    rounded: "{rounded.pane}"
    padding: "12px 14px 14px"
    width: "376px"
  section:
    textColor: "{colors.text}"
    typography: "{typography.title}"
    padding: "9px 0 10px"
  hero-value:
    textColor: "{colors.number}"
    typography: "{typography.display}"
    padding: "4px 0 2px"
  hero-value-warn:
    textColor: "{colors.warn}"
  hero-value-crit:
    textColor: "{colors.crit}"
  hero-value-idle:
    textColor: "{colors.muted}"
  segmented:
    backgroundColor: "{colors.control}"
    rounded: "{rounded.pill}"
    padding: "3px"
  segmented-item:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.chip}"
    padding: "4px 9px"
  segmented-item-selected:
    backgroundColor: "{colors.control-active}"
    textColor: "{colors.text}"
    rounded: "{rounded.chip}"
    padding: "4px 9px"
  button:
    backgroundColor: "{colors.control}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "28px"
  button-hover:
    backgroundColor: "{colors.control-hover}"
    textColor: "{colors.text}"
  button-icon:
    backgroundColor: "{colors.control}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0"
    width: "34px"
    height: "28px"
  button-danger:
    backgroundColor: "{colors.control}"
    textColor: "{colors.crit}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "28px"
  meter-track:
    backgroundColor: "{colors.track}"
    rounded: "{rounded.meter}"
    height: "6px"
  meter-fill-ok:
    backgroundColor: "{colors.ok}"
    rounded: "{rounded.meter}"
    height: "6px"
  meter-fill-warn:
    backgroundColor: "{colors.warn}"
    rounded: "{rounded.meter}"
    height: "6px"
  meter-fill-crit:
    backgroundColor: "{colors.crit}"
    rounded: "{rounded.meter}"
    height: "6px"
  meter-fill-stale:
    backgroundColor: "{colors.muted}"
    rounded: "{rounded.meter}"
    height: "6px"
  switch-track:
    backgroundColor: "{colors.track}"
    rounded: "{rounded.pill}"
    width: "34px"
    height: "18px"
  settings-row:
    textColor: "{colors.text}"
    typography: "{typography.subtitle}"
    padding: "8px 0"
    height: "44px"
  trend-tooltip:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.text}"
    typography: "{typography.meta}"
    rounded: "{rounded.control}"
    padding: "6px 8px"
  cta-link:
    textColor: "{colors.accent}"
    typography: "{typography.meta}"
  toolbar-badge:
    backgroundColor: "{colors.crit}"
    textColor: "{colors.surface}"
    rounded: "{rounded.badge}"
    padding: "3px 5px"
---

# Design System: MeterBar

## Overview

**Creative North Star: "The Lit Instrument Pane"**

MeterBar is one frosted pane of glass laid over a lit desk. The light is real and it is underneath: an ambient field of deep blue and violet (or, in daylight, pale sky and blush) that the pane blurs at 32px and tints at 56% opacity, so the surface has a temperature rather than a fill color. Everything printed on that pane is monospace, because MeterBar's whole job is numbers that must not shift position between one ten-minute refresh and the next. The pane is the only element in the product that floats. Nothing inside it floats: values sit in recesses, controls sit on a hairline-raised lip, and sections are separated by a single 1px line at 12% alpha rather than by boxes.

The density is instrument density, not dashboard density. A 376px popup holds a wordmark, a control, a 40px headline number, a labeled 24-hour chart, four provider rows and a footer, and it does that without a scrollbar because every secondary value is 10px and every divider is a hairline. One number is large. It is the tightest limit across every provider, phrased "91% used", and it exists so the answer to "what stops me first" lands before the eye reaches a card. Every other reading is a 10px value at the right edge of its own row, aligned into a column you can scan vertically.

The system is honest at the pixel level, which is the one place a usage tool can lie. A reading that is not exact carries one short word in the row ("inferred", "estimated") and the full phrase ("unofficial source") only in tooltips and notifications. A reading that is out of date goes gray, both the number and its meter fill, and says how long ago it was taken. A provider that reports connection only (Gemini) says "Status only" and never borrows a percentage. Risk is green, amber and red, always at the same thresholds, and it is the only place those three hues appear. The rejected alternative is explicit: no daily consumption bars, no token counts, no cost, because MeterBar never sees a token and will not imply that it does.

**Key Characteristics:**
- Frosted glass pane over a self-painted ambient light field, in both themes
- Monospace everywhere, tabular figures, 11px base and 10px meta
- Exactly one hero number per view; everything else is inline at 10 to 11px
- Hairline sections instead of cards; nothing inside the pane floats
- 6px sunken meters with a 1px pace tick, risk-colored, animated on fill only
- Fixed provider order (Claude, ChatGPT, Codex, Gemini) on every surface
- Uncertainty is a word in the row, never a missing value or a rounded guess

## Colors

Two complete, mirrored palettes generated from one source (`src/ui/workbenchPalette.json`) into CSS custom properties and a QML object, so the browser surfaces and the Omarchy companion cannot drift. The dark set is the `:root` default; the light set replaces it under `prefers-color-scheme: light` and under an explicit `data-theme="light"` override.

### Primary
- **Mint Signal** (dark `accent` / light `accent-light`): the product's one accent. It is simultaneously the healthy risk color on meter fills, the CTA and status link color, the selection background, the focus ring at 70% alpha, the toggle knob and its 28% track wash, and the "Signed in" affirmation. In light it darkens to a deep forest so it still carries text contrast on a near-white pane.

### Secondary
The risk triad. These three, and only these three, express how close a limit is to stopping work.
- **Mint Signal** (`ok`, same value as the accent): below 70% used.
- **Amber Caution** (`warn` / `warn-light`): at or above 70% used. In light it drops to a dark ochre rather than staying bright, because a pale yellow on a pale pane is unreadable.
- **Rose Alarm** (`crit` / `crit-light`): at or above 90% used. Also the destructive-action color on "Clear local data" and the toolbar badge background.

### Tertiary
Three series hues for the 24-hour trend, one per provider with usage history. They are separated for color-vision legibility (warm orange, green, blue are distinguishable under deuteranopia and protanopia) and darkened in the light theme to hold contrast against a pale pane.
- **Ember** (`series-claude` / `series-claude-light`): Claude's line.
- **Jade** (`series-openai` / `series-openai-light`): ChatGPT's line.
- **Azure** (`series-codex` / `series-codex-light`): Codex's line.

### Neutral
- **Abyss** (`bg-deep` / `bg-deep-light`): the page under the ambient field and the pane. The Chrome popup window is opaque, so the page paints this itself.
- **Ambient Blue** and **Ambient Violet** (`ambient-blue`, `ambient-violet`; in light, Ambient Blue and **Ambient Blush** `ambient-pink-light`): three radial gradients (top left, bottom right, and a soft 45%-alpha wash at center) that give the glass something to refract. They are never used as a fill.
- **Pane Gray** (`surface`) and **Pane Gray Deep** (`surface-strong`): the glass tint source and the opaque tooltip base. `surface` at 56% alpha is the pane material (`glass`); `surface-strong` at 92% is the only thing allowed to sit opaque on top of the pane.
- **Frost Line** (`line` / `line-light`): a hairline source, never drawn at full strength. It exists only to be mixed at 12%, 14% and 24% (`hairline-soft`, `hairline`, `hairline-strong`).
- **Well** (`sunken` / `sunken-light`): the recess source. Mixed at 44% in dark and 12% in light to make `track`, the meter and toggle bed.
- **Readout** (`text` / `text-light`) and **Hush** (`muted` / `muted-light`): body text and everything secondary, which in this system is most text: window names, countdowns, staleness, axis labels, legends, section subheads.
- **Numeral White** (`number` / `number-light`): a faintly warmer white reserved for the hero value at rest, so the one large number reads as a different material from body text.
- **Overlay** (`overlay` / `overlay-light`, pure white or pure black): never painted directly. It is mixed at 5%, 7%, 8% and 10% to make the control surfaces, so a button is a lightening of the pane in dark and a darkening of it in light, with no second palette.
- **Icon Casing, Icon Border, Icon Track, Icon Accent**: a four-color set used only by the generated toolbar PNGs and the live canvas icon, which Chrome renders outside any theme context and which therefore stays on the dark set in both themes.

### Named Rules

**The Risk-Only Color Rule.** Mint, amber and rose appear only where a value or its meter carries risk, at the same thresholds everywhere (amber at 70, red at 90, gray when stale or unknown). Nothing decorative borrows them, and no other element invents a fourth status color.

**The Mirrored Palette Rule.** Every token exists in both themes under the same name, generated from one JSON file. A surface reads `var(--crit)`, never a hex. A value that exists in only one theme is a bug, and the generator fails the build when the two key sets diverge.

**The Overlay Mix Rule.** Control surfaces, hairlines and recesses are never their own colors. They are `color-mix` of `overlay`, `line` or `sunken` into transparency, which is why the whole material system inverts correctly with a single palette swap.

**The Position-Not-Hue Rule.** Provider identity is position plus a drawn mark plus a written label. Series hue is a second, redundant channel that exists only inside the trend chart, and every line there is additionally labeled with its end value and named in the legend.

## Typography

**Display Font:** JetBrains Mono (with JetBrainsMono Nerd Font, `ui-monospace`, SF Mono, Menlo, Consolas, Liberation Mono)
**Body Font:** the same stack
**Label/Mono Font:** the same stack

**Character:** One monospace voice for the entire product, including headings and prose. The pairing is the ramp itself: an 800-weight 15px wordmark against a 600-weight 40px numeral against 10px uppercase labels. Monospace is not decoration here, it is the reason a percentage does not shift horizontally when 9% becomes 91%, reinforced by `font-variant-numeric: tabular-nums` on the body.

### Hierarchy
- **Display** (600, 40px, line-height 1, tracking -0.02em): the hero "Tightest limit" value, and only that. Its trailing "% used" is a 16px, 500-weight, muted `<small>` on the same baseline. The side panel promotes it to 48px above 500px wide.
- **Headline** (800, 15px, line-height 1, tracking -0.02em): the MeterBar wordmark in the header of the popup, side panel and options page. Nothing else uses 800.
- **Title** (700, 11px, uppercase, tracking 0.06em): section headings ("Trend", "Limits", "Alerts", "Toolbar", "Providers", "Local record").
- **Subtitle** (600, 12px): provider names in the Limits view and setting titles in options. At 11px/600 it becomes the compact limit row's provider name.
- **Body** (400, 11px, line-height 1.35): the base. Hero support copy runs 11px at 1.45 with `text-wrap: pretty`.
- **Meta** (400, 10px, line-height 1.4 to 1.45): window names, values, countdowns, staleness, "Updated 1m ago", empty-state hints, legends, the section subhead at the right of each heading.
- **Label** (500, 10px, uppercase, tracking 0.06em to 0.08em): the hero kicker "Tightest limit", segmented control options, the "Local only" status, the version line.
- **Micro** (400, 9px): chart axis and end labels only.

### Named Rules

**The One Number Rule.** Exactly one Display-size number exists per view: the tightest limit across all providers. Every other reading is Meta-size, right-aligned in its row. A second large number would make the user compare instead of act.

**The Tabular Rule.** The body sets `font-variant-numeric: tabular-nums`. Percentages, countdowns and chart labels must not reflow between refreshes; a value that jitters reads as unstable data even when the data is fine.

**The Uppercase Label Rule.** Uppercase with 0.06em to 0.08em tracking is reserved for section headings, the hero kicker, and control labels. Values, provider names and body copy are always sentence case. Uppercase is a role marker, not emphasis.

**The Percent Phrase Rule.** A usage value is always written "72% used", never "72%" alone and never "28% left". The phrase is the unit, and it is identical in the popup, the side panel, the compact rows, the Omarchy panel and the hero.

## Layout

One column, always. There is no grid system, only a stack of hairline-separated sections inside a single pane.

**The popup** is fixed at 376px wide with `overflow-x: hidden`, `min-height: 420px` and `max-height: 600px`, which is Chrome's ceiling. The pane pads 12px top, 14px sides, 14px bottom, stacks its children with an 8px gap, and pins the footer with `margin-top: auto` so the button row sits at the bottom whether the dashboard is full or empty.

**The side panel** imports the popup's stylesheet whole and relaxes it: width auto with a 320px floor, the pane capped at 680px and centered, and its top corners squared so it reads as docked to the browser chrome. Above 500px the body gains a 14px gutter, the pane rounds fully, padding grows to 16px/18px, the hero grows to 48px, the compact row's name column widens from 76px to 110px, and the provider window grid's column gap opens from 14px to 20px.

**The options page** uses the same pane at 640px max width, centered, with 40px of breathing room above it. Below 480px the page gutter tightens to 10px and the action buttons stretch to fill.

**Section rhythm.** Every section is `border-top: 1px solid` hairline-soft with 9px to 12px of vertical padding and a 6px internal grid gap. A section header is a baseline-aligned flex row: uppercase title on the left, muted context on the right ("24 h - % of limit used", "Updated 1m ago", "Fixed provider slots"), the right side ellipsized so it never wraps.

**Row grids.** The compact limit row is a two-column grid, a fixed name column plus fluid content, with the windows inside it on `repeat(auto-fit, minmax(110px, 1fr))` so one window fills the row and two share it. The Limits view uses a 2-column window grid that collapses to one when a provider reports a single window. Settings rows are 44px-minimum flex rows separated by hairline-soft, which keeps the toggle target at the accessible floor.

**Chart sizing.** The trend SVG's viewBox matches its CSS pixel box exactly so text never scales with the container. Width clamps to 300 to 660px; height steps from 104px to 180px once the container passes 420px. Plot padding is 26px left, 24px right, 6px top, 12px bottom.

**Spacing rhythm.** 2, 4, 6, 8, 10, 12, 14, 18. Gaps inside a row are 3 to 8px, between rows 6 to 10px, between sections 9 to 12px of padding plus the hairline.

### Named Rules

**The Fixed Order Rule.** Claude, ChatGPT, Codex, Gemini, in that order, in the compact limits, the Limits view, the chart legend, the toolbar icon bars, the Omarchy widget pills and the Omarchy panel. Never sorted by value, never reordered by risk. Position is how the user identifies a provider at a glance; sorting destroys the only memory the toolbar icon has.

**The No-Card Rule.** Structure comes from hairlines and vertical rhythm, never from nested boxes. There is one container in the product and it is the pane.

**The One Stylesheet Rule.** The side panel and options page import the popup's stylesheet and override only what geometry demands. A visual change made in one surface and not the others is drift, not a variant.

## Elevation & Depth

This system is not shadow-based in the card sense, and it is not flat either. Depth is material: a blurred, tinted pane with a 1px inset ring and a top highlight sits above a lit field, and everything inside the pane is described as either recessed into it or raised off it by one hairline. There is exactly one drop shadow in the product, and it belongs to the pane.

### Shadow Vocabulary
- **Pane lift** (`box-shadow: 0 22px 55px` shadow at 36% alpha): the shell's only drop shadow. It is what separates the glass from the ambient field.
- **Pane ring** (`inset 0 0 0 1px` hairline): the 1px edge that gives the glass a physical thickness.
- **Pane highlight** (`inset 0 1px 0` control-active): a single lit top edge, as if the light field catches the pane's upper lip.
- **Control highlight** (`inset 0 1px 0` control-highlight, overlay at 8%): the same idea one scale down. It is what makes a button and a segmented control read as raised rather than painted.
- **Recess ring** (`inset 0 0 0 1px` hairline, on the toggle track): the inverse cue, a lip around a well.
- **Tooltip lift** (`0 8px 20px` shadow at 30%): the trend crosshair tooltip, the one element allowed to float above the pane's own plane because it tracks the cursor.

### Named Rules

**The Recess Rule.** Anything that holds a value is sunken: meter tracks, toggle tracks, the toolbar icon's bar wells, all built from `sunken` mixed into transparency. Anything you press is raised by a single inset top highlight: buttons, segments, the view switcher. No element is both, and nothing gets an outer shadow to fake either.

**The One Pane Rule.** One drop shadow per surface, the shell's. Sections, rows, meters and provider blocks never float. If a new element seems to need elevation, it needs a hairline instead.

**The Glass Needs Light Rule.** A backdrop-filter over a solid background is just a gray box. Any surface that renders the pane must also paint the ambient field behind it: Chrome does this itself with three radial gradients, because the popup window is opaque; the Omarchy panel takes the shell theme's popup background instead and switches to the light palette when that background's luminance passes 0.6.

## Shapes

Corners step down with importance: 14px on the pane, 9px on a segmented control's outer shell, 7px on buttons and the tooltip, 6px on a segment, 5px on the toolbar badge, 3px on meters (fully round at their 6px height), and 50% on dots and toggle knobs. The result is a consistent softness with no single dominant radius fighting the pane.

Borders are hairlines or nothing. A border at rest is `line` at 14%; on hover it firms to 24%; a section divider is 12%. The palette's `line` value never appears at full strength anywhere in the product.

Icons are authored, not imported. Every glyph is an inline SVG on a 16-unit viewBox with `fill: none`, `stroke: currentColor`, `stroke-width: 1.6`, and round caps and joins, rendered at 12px in rows and 13px in buttons. The four provider marks (a Claude burst, a ChatGPT spoked circle, a Codex bracketed square, a Gemini four-point star) are drawn from the same 16-unit paths in the browser's SVG and in the Omarchy panel's Canvas, so the glyph and its slot agree across runtimes.

The toolbar icon is its own geometry and the product's only pixel art: a rounded casing (20% radius, 4.5% border) holding one vertical sunken well per provider with a risk-colored fill rising from the bottom, drawn at 16px and 32px into an OffscreenCanvas and falling back to the bundled static PNG when nobody has data.

### Named Rules

**The Hairline Rule.** Every divider, border and ring is `line` mixed into transparency at 12%, 14% or 24%. Solid dividers do not exist in this system.

**The Drawn Mark Rule.** Provider identity is an authored single-weight path on a 16-unit grid. Never an emoji, never a downloaded brand asset, never a letter in a circle. Trademarks identify the services MeterBar reads and imply no affiliation, which is exactly why the marks are drawn rather than borrowed.

**The Round-The-Meter Rule.** A meter's radius is half its height, so a 6px bar is a capsule at any fill. A fill of 2% still reads as a deliberate sliver, not a rendering artifact.

## Components

### Buttons
- **Shape:** softly rounded (7px), 28px tall, hairline-bordered.
- **Primary (and only) variant:** control surface (overlay at 5%), readout text, a 1px inset top highlight, 10px horizontal padding, 6px icon gap. There is no filled accent button in the product; every action is equal weight and the interface does not push one.
- **Hover / Focus:** background firms to overlay at 7%, border to hairline-strong, over 140ms. Active presses 1px down on the shell easing. Focus draws a 2px mint ring at 70% alpha with a 2px offset, globally, from the token layer.
- **Icon variant:** square-ish at 34px wide with zero padding, holding a 13px stroked SVG.
- **Danger variant:** identical geometry, rose text, and on hover a rose border at 50% and a rose wash at 12%. Used once, on "Clear local data".
- **Disabled / busy:** 62% opacity and a 13px hairline-strong spinner that replaces the refresh glyph, spinning at 700ms linear.

### Chips
Not used. The segmented control below covers the one selection pattern in the product.

### Cards / Containers
- **Corner Style:** 14px on the pane; the side panel squares its top corners when docked.
- **Background:** the glass tint (`surface` at 56%) with `blur(32px) saturate(115%)`.
- **Shadow Strategy:** pane lift plus pane ring plus pane highlight, per Elevation.
- **Border:** the inset ring only; no outer border.
- **Internal Padding:** 12px/14px in the popup, 16px/18px in the side panel and options.
- There are no sub-cards. Sections inside the pane are hairline-topped stacks.

### Inputs / Fields
The product has no text input. The two controls are:
- **Segmented control (badge target):** a hairline-bordered pill (9px) on the control surface with 3px inner padding, holding uppercase 10px options at 4px/9px. The selected option takes the active control wash, a hairline-strong border and readout text. It is a `radiogroup` with roving tabindex; arrow keys move the selection and commit immediately. On the options page the same component grows a second line per option showing that target's live badge value at 14px in its risk color, so the choice previews its own consequence.
- **Toggle switch:** a 34x18px sunken track with a recess ring and a 14px muted knob. On, the track washes to mint at 28% with a mint ring at 50%, and the knob slides 16px and turns mint over 180ms on the shell easing. The input itself is visually hidden but focusable, and focus draws the global mint ring 3px off the track.

### Navigation
- **View switcher:** a split control in the footer, a 62px label reading "Home" or "Limits" joined to a 24px chevron button, sharing one rounded outline (left cap and right cap). Both halves toggle, both hover together, and the chosen view persists in `localStorage` so the popup and side panel agree.
- **Footer bar:** switcher left, spacer, then three 34px icon buttons (dock to side panel, refresh, settings). Order is fixed and the row is pinned to the bottom of the pane.

### Usage Meter (signature component)
The product's defining element. A 6px sunken capsule holding a risk-colored fill that animates in from zero over 600ms on the shell easing, plus a 1px full-height pace tick at 70% opacity marking where even consumption would be right now, derived from the window length and the reset time. The tick is what makes 91% with 46 minutes left look different from 91% with four hours left. Stale readings drop both fill and value to muted. Exposed as `role="meter"` with an `aria-valuetext` that speaks the full phrase.

### Trend Chart (signature component)
A 24-hour, 0 to 100 line chart generated as pure SVG markup with no charting library: three hairline gridlines at 0/50/100 with left-anchored micro labels, dashed guides at 70 (amber at 40%) and 90 (rose at 45%), one 2px round-capped line per provider in its series hue, a 3.5px end dot ringed in the pane color, a direct end label, a time axis reading "-24h / -12h / now", and a wrapping legend below. Hover draws a hairline-strong crosshair and an opaque tooltip listing every series' reading at that moment, flipping to the cursor's left past 60% of the width. Below two points it renders nothing and the section says so in plain words.

### Compact Limit Row (signature component)
The Home view's provider list. A fixed-width name cell (drawn mark plus label) beside an auto-fitting set of window readouts, each a label and a right-aligned "N% used" in its risk class, with one muted note line underneath collapsing every countdown, staleness and uncertainty into a single dot-separated string. A provider with no usage collapses to one line: "No usage" or "Status only" on the left, its status on the right in mint if connected.

### Header Mark
The wordmark followed by a 6px status dot that takes the risk color of the tightest limit (or muted when idle), crossfading over 240ms. It is the smallest possible restatement of the hero, present on every surface including the Omarchy panel.

### Toolbar Icon
One vertical risk-colored bar per provider with fresh data, left to right in the fixed order, inside a rounded casing with sunken wells, repainted on every recompute at 16px and 32px. A non-zero reading always draws at least 8% of the icon height so a live-but-low provider is never invisible. Zero bars restores the static bundled logo. The options page mirrors this as a static 52x44px legend with a rose badge, so the setting explains the instrument.

### Omarchy Panel
The companion reuses the grammar rather than the stylesheet: the same palette JSON compiled to QML, the same 16-unit provider marks drawn on Canvas, the same hero, hairlines, trend and compact rows, the same "% used" phrasing and the same short uncertainty words. It takes its background from the shell theme's popup color and picks the dark or light palette by that background's luminance (threshold 0.6). The bar widget is four 12x4px pills in fixed provider order plus the tightest percent, and the percent takes the bar's own foreground color rather than a risk color, so it stays legible on any shell theme while the pills carry the risk.

### Motion
Controls transition color, background and border over 140ms ease; the toggle moves over 180ms on the shell easing (`cubic-bezier(0.22, 1, 0.36, 1)`); the mark dot crossfades over 240ms; the meter fill grows over 600ms on the shell easing; the refresh spinner runs 700ms linear. `prefers-reduced-motion: reduce` disables every animation and transition in the product with one rule.

## Do's and Don'ts

### Do:
- **Do** read every color through a token. `var(--crit)`, never a hex, so the light theme and the Omarchy companion stay correct for free.
- **Do** paint the ambient field on any surface that renders the pane. A backdrop-filter with nothing behind it is a gray rectangle.
- **Do** keep the fixed provider order (Claude, ChatGPT, Codex, Gemini) in every list, legend, icon and widget. Position is the user's memory.
- **Do** write usage as "N% used", in every surface, including tooltips and notifications.
- **Do** label a non-exact reading with one short word in the row ("inferred", "estimated") and keep the full phrase ("unofficial source") for tooltips and alerts.
- **Do** gray a stale reading, its meter fill and its number together, and say how long ago it was captured.
- **Do** separate sections with a 1px hairline at 12% alpha and vertical rhythm.
- **Do** sink anything that holds a value and raise anything you press, with a single inset highlight on each.
- **Do** draw new icons as 16-unit, 1.6-weight, `currentColor` stroked SVG paths with round caps.
- **Do** give the meter a pace tick whenever the window has a known length and reset time.
- **Do** keep the popup inside 376 x 600 with no horizontal scroll, and verify at 360px.

### Don't:
- **Don't** add a filled accent button. Every action in this product is the same weight.
- **Don't** introduce a card, a panel-in-a-panel, or a second drop shadow. There is one pane.
- **Don't** draw `line` or `sunken` at full strength. They exist to be mixed into transparency.
- **Don't** use mint, amber or rose for anything that is not risk, an action state, or the one status affirmation.
- **Don't** let color alone carry meaning. Every risk color is accompanied by its number, every series hue by an end label and a legend entry.
- **Don't** sort providers by usage, alphabetically, or by recency.
- **Don't** add a second Display-size number to a view.
- **Don't** show a percentage for a provider that does not report one. "Status only" is the correct and complete answer for Gemini.
- **Don't** render token counts, costs, or daily consumption bars. MeterBar never sees a token and the interface must not imply otherwise.
- **Don't** introduce a proportional typeface, or a non-tabular numeral, anywhere in the product.
- **Don't** hand-edit `src/ui/workbenchPalette.css` or `companion/omarchy/local.meterbar/WorkbenchPalette.qml`. Edit `src/ui/workbenchPalette.json` and regenerate; the same generator guards `public/assets/icon*.png`.
