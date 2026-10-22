# Design System

## Color Scheme

Primary palette (forest):
- `forest.500` / `#22854a` (primary action)
- `forest.400` / `#2ea05a`
- `forest.600` / `#1d6b3c`
- `forest.700` / `#16522e`
- `forest.800` / `#103d22`
- `forest.900` / `#0a2e1a`

Secondary palette (sage):
- `sage.50`  / `#f2faf5`
- `sage.100` / `#e4f5ec`
- `sage.200` / `#c6ebd6`
- `sage.300` / `#a4dcba`
- `sage.400` / `#76c597`

Semantic colors:
- `success` / `#22854a`
- `warning` / `#c97c10`
- `error`   / `#b91c1c`
- `info`    / `#1d6b3c`

Text & surface tokens:
- `on-surface`: `#0a2e1a`
- `surface`: `#f2faf5`
- `background`: `#f2faf5`
- `border-color`: `#c6ebd6`

## Typography

Font families:
- Display: `DM Serif Display`, Georgia, serif
- Body: `DM Sans`, `Noto Sans Devanagari`, system-ui, sans-serif

Base styles:
- `body`: `font-size: 16px`, `line-height: 1.6`
- `h1..h6`: `font-family: var(--font-display)`, `line-height: 1.15`, `letter-spacing: -0.01em`

Scale classes:
- `.display-lg`: clamp(2.5rem, 6vw, 4.5rem)
- `.display-md`: clamp(2rem, 4vw, 3rem)
- `.headline-lg`: clamp(1.5rem, 3vw, 2.25rem)
- `.headline-md`: 1.375rem
- `.title-lg`: 1.0625rem
- `.body-lg`: 1rem
- `.body-md`: 0.875rem
- `.label-lg`: 0.8125rem
- `.label-md`: 0.6875rem

## Radius & shadows

Border radius:
- sm: 0.5rem
- md: 0.875rem
- lg: 1.25rem
- xl: 1.75rem
- 2xl: 2.5rem
- full: 9999px

Shadows:
- `sm`: `0 1px 2px rgba(0,0,0,0.02)`
- `md`: `0 2px 8px rgba(0,0,0,0.04)`
- `lg`: `0 4px 16px rgba(0,0,0,0.06)`
- `xl`: `0 8px 24px rgba(0,0,0,0.08)`
- `primary`: `0 2px 10px rgba(0,0,0,0.05)`
