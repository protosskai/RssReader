---
version: alpha
name: Inkline
description: A calm desktop RSS reader identity — paper desk, deep ink, single clay accent. Optimized for scan → open → read → return.
colors:
  primary: "#111111"
  secondary: "#6C7278"
  tertiary: "#007aff"
  neutral: "#f5f5f7"
  surface: "#FFFFFF"
  surface-raised: "#FFFCFA"
  on-primary: "#f5f5f7"
  on-tertiary: "#FFFFFF"
  on-surface: "#111111"
  border: "#E4E0DA"
  muted: "#9A9590"
  positive: "#2F6F4E"
  negative: "#A33B32"
  warning: "#B87A1A"
  dark-primary: "#F0EBE3"
  dark-secondary: "#A8A29A"
  dark-tertiary: "#D4654A"
  dark-neutral: "#141310"
  dark-surface: "#1C1A17"
  dark-surface-raised: "#24211C"
  dark-border: "#332F29"
  dark-on-surface: "#F0EBE3"
typography:
  display:
    fontFamily: "Source Serif 4"
    fontSize: 2.5rem
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.02em
  h1:
    fontFamily: "Source Serif 4"
    fontSize: 1.75rem
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.015em
  h2:
    fontFamily: "Source Serif 4"
    fontSize: 1.35rem
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.01em
  h3:
    fontFamily: "Source Sans 3"
    fontSize: 1.125rem
    fontWeight: 600
    lineHeight: 1.35
  body-lg:
    fontFamily: "Source Serif 4"
    fontSize: 1.125rem
    fontWeight: 400
    lineHeight: 1.7
  body-md:
    fontFamily: "Source Sans 3"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: "Source Sans 3"
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  label-md:
    fontFamily: "Source Sans 3"
    fontSize: 0.8125rem
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0.02em
  label-caps:
    fontFamily: "Source Sans 3"
    fontSize: 0.6875rem
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0.08em
  meta:
    fontFamily: "Source Sans 3"
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0.01em
rounded:
  none: 0px
  sm: 4px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
  gutter: 20px
  margin: 28px
  reader-max: 720px
  shell-rail: 280px
components:
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
    rounded: "{rounded.sm}"
    padding: 12px
    height: 40px
  button-primary-hover:
    backgroundColor: "#9E3826"
    textColor: "{colors.on-tertiary}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: 12px
    height: 40px
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.secondary}"
    rounded: "{rounded.sm}"
    padding: 8px
  chip-unread:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
    rounded: "{rounded.full}"
    padding: 4px
  list-item:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: 16px
  list-item-unread:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.primary}"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
    padding: 12px
    height: 40px
  shell-header:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    height: 48px
  shell-rail:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.on-surface}"
    width: 280px
  reader-surface:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    padding: 32px
  card-surface:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: 20px
---

# Inkline

## Overview

**Inkline** is a desktop RSS reader that feels like a private reading desk, not a dashboard. The product optimizes a single primary loop: **scan feeds → open an article → read without chrome noise → return**.

Brand personality: quiet, editorial, permanent. The UI should evoke a premium matte broadsheet or a contemporary gallery wall of clippings — warm paper, deep ink, and one decisive accent. It is never playful, never neon, never “enterprise SaaS blue.”

Target user: someone who already curates feeds and wants frictionless reading. Density is allowed in the rail (many feeds), but the reader column is spacious and typographic. Motion is subtle and functional (fade/crossfade under 200ms). Dark mode inverts to a low-glare charcoal desk while preserving the same hierarchy.

If a decision is not specified, prefer **less chrome, more text, more whitespace, one accent**.

## Colors

The palette is rooted in high-contrast neutrals and a single earthy accent.

- **Primary (#1A1C1E) — Deep Ink:** Headlines, primary body text, shell chrome. Conveys permanence and readability.
- **Secondary (#6C7278) — Soft Slate:** Captions, timestamps, inactive icons, helper text.
- **Tertiary (#B8422E) — Boston Clay:** The only interactive accent — primary buttons, unread dots, focus rings, critical links. Never decorate large surfaces with it.
- **Neutral (#F7F5F2) — Warm Limestone:** App foundation / rail background. Softer than pure white to reduce eye strain.
- **Surface (#FFFFFF) / Surface-raised (#FFFCFA):** Cards and reader paper over limestone.
- **Border (#E4E0DA):** Hairline dividers; prefer 1px borders over drop shadows.
- **Positive / Negative / Warning:** Status only — never competing brand colors.

Dark mode maps ink→paper and paper→charcoal desk (`dark-neutral`, `dark-surface`) with a slightly brighter clay (`dark-tertiary`) for contrast on dark fields.

## Typography

Two families only:

- **Source Serif 4** for display, article titles, and long-form body — journalistic gravity and long-session comfort.
- **Source Sans 3** for UI chrome, labels, metadata, buttons — geometric clarity without coldness.

Hierarchy rules:

- **Display / H1–H2:** Serif, slightly tight tracking, used sparingly (home hero, article title).
- **Body (reader):** Serif at ~18px / 1.7 line-height, max measure ~65–72ch (`reader-max` 720px).
- **Body (UI):** Sans at 14–16px for lists and settings.
- **Labels / meta:** Sans, smaller, slate color; caps + wide tracking only for section eyebrows (“SUBSCRIPTIONS”, “READING”).

Never mix more than two weights on one surface. Prefer weight contrast over size contrast for list hierarchy (unread = 600, read = 400).

## Layout

Desktop-first three-zone shell:

1. **Top bar (48px):** Product name, global actions (add, sync, search, favorites, settings). Deep ink background, light type.
2. **Left rail (`shell-rail` ~280px):** Folder tree + feed list + local search. Limestone background; sticky within viewport.
3. **Main stage:** Feed list or reader. Neutral/surface paper with generous horizontal margin (`margin` 28px). Article body centered to `reader-max` 720px.

Spacing uses an **8px base** (with 4px half-steps). Related groups use containment: cards with `lg` (24px) internal padding and `md` gaps between cards. Avoid nested card-in-card.

Feed list rows are full-bleed list items (~72–96px tall), not Material “raised cards stacked with gap noise.” The reader has a sticky minimal toolbar (back, favorite, open original, type size) that does not steal vertical attention.

## Elevation & Depth

Depth is **tonal**, not shadowed. Prefer:

- Limestone background + white surface cards
- 1px `border` hairlines
- At most a soft ambient shadow on floating dialogs (`0 8px 28px rgba(26,28,30,0.08)`)

Do not stack Material elevation levels (z1–z24). Active/selected rail items use a left clay bar + slightly raised surface, not a drop shadow.

## Shapes

**Architectural sharpness with soft edges:** default radius `sm` (4px) for buttons and inputs; `md` (8px) for cards and list blocks; `full` only for unread badges and avatars. Do not mix pill-shaped primary buttons with sharp cards in the same view — keep the language consistent: small radii everywhere except badges.

## Components

- **Primary button:** Clay fill, white label, 4px radius, 40px height. One primary action per view.
- **Secondary / ghost:** Transparent or hairline border, ink or slate text. Used for Cancel, Open original, Mark read.
- **List items (posts):** Full width, hairline bottom border, title (serif or strong sans), one-line meta (source · time), optional two-line excerpt in slate. Unread: clay micro-dot + heavier title weight. Hover: surface-raised, no scale transform.
- **Rail feed row:** Compact; unread count as clay pill. Selected: left 2px clay indicator.
- **Inputs:** White surface, 1px border, focus ring in clay (2px outline, offset 2px).
- **Dialogs:** Raised white surface, 12px radius, limestone scrim; title in serif h2.
- **Reader toolbar:** Flat, sticky, border-bottom hairline; icon buttons ghost.
- **Chips:** Use sparingly for status (unread count, syncing). Never rainbow chip sets.

## Do's and Don'ts

- Do treat reading as the hero: maximize type quality and measure in the content column.
- Don't use Quasar default blue (`#1976D2`) or multi-color Material accents as brand chrome.
- Do use Boston Clay only for the single most important interactive cue per region (CTA, unread, focus).
- Don't flood the UI with icons; prefer text labels for primary actions when space allows.
- Do keep dark mode tonal (warm charcoal), not pure black OLED gamer aesthetic.
- Don't introduce a third font family or decorative gradients.
- Do preserve keyboard paths: `j/k` list nav, Enter open, Backspace back, `/` search.
- Don't animate page leaves in ways that can freeze navigation; enter fades only, ≤200ms.
- Do show honest empty/error states with one recovery action.
- Don't pretend destructive settings actions succeeded when they no-op.
