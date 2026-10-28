# Phase 0 — Frontend port

The frontend is a Vite + React app built around one feature, the **SpaceMapper**. It is an interactive office floor plan: you pick zones on it and get a planting recommendation for each one.

The map was first built for the [Cairn Botanics](https://github.com/Tasha-B/cairn-botanics) marketing site (Next.js). It was moved into this repo as a standalone app so that it can grow into a fullstack zone editor.

## Stack

| Concern | Choice |
| --- | --- |
| UI | React 19, TypeScript |
| Build / dev server | Vite 8 |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`), design tokens in `@theme` |
| Animation | Framer Motion 12 |
| Linting | Oxlint |
| Fonts | Fraunces (display), Inter (body), Caveat (handwritten marker), all from Google Fonts |

## Run

```bash
cd frontend
npm install
npm run dev       # dev server with HMR
npm run build     # tsc -b + vite build
npm run lint      # oxlint
npm run preview   # serve the production build
```

## Structure

```
frontend/
├── index.html                    fonts, favicon, root element
├── public/favicon.svg            three stacked stones (the "cairn")
└── src/
    ├── main.tsx                  React root
    ├── App.tsx                   providers + page container
    ├── index.css                 Tailwind import and @theme design tokens
    ├── components/
    │   ├── SpaceMapper/
    │   │   ├── SpaceMapper.tsx         section container: layout, hint timing, mobile sheet state
    │   │   ├── SpaceMapperPlan.tsx     the SVG plan: zones, markers, walls, furniture, labels
    │   │   ├── SpaceMapperPanel.tsx    "Your plan" panel: selected zones + start over
    │   │   ├── RecommendationCard.tsx  one zone's recommendation
    │   │   ├── SpaceMapperSheet.tsx    full-screen bottom sheet for mobile
    │   │   └── zoneData.ts             zone copy (EN / RU)
    │   ├── Button/Button.tsx           primary / secondary button, renders <button> or <a>
    │   └── SectionNumber/              handwritten section number
    └── lib/
        ├── i18n/                       LanguageProvider + translations (map section)
        ├── selection/                  SelectionProvider: selected zone ids
        └── usePrefersReducedMotion.ts  single source of the reduced-motion flag
```

## Features

### Interactive floor plan

- A hand-drawn style SVG plan (`viewBox 0 0 800 600`) with five zones: reception, meeting room, open floor, break room and signature corner.
- Zone geometry is a discriminated union, `{ kind: "rect" } | { kind: "circle" }`, so rendering and hit-testing switch on `kind`.
- **Multi-select.** Clicking a zone toggles it. Selected zones fill in with an animated "highlighter" marker: each stroke draws in through Framer Motion `pathLength`, with a small delay between strokes.
- **Hover tint** in the zone's own color.
- **Hit areas** are 20 units larger than the visible shape for easier touch. The signature-corner circle gets no padding, because it sits on top of the open-floor corridor and would otherwise steal its clicks.
- **One-shot hint.** The first time the map scrolls into view, the reception marker draws in, holds, fades out and never repeats. If the user selects reception first, the hint is cancelled.
- Non-interactive layers are drawn on top of the zones with `pointer-events: none`: walls, doors, furniture, trees, the palette legend, room labels and areas, the entry arrow and the north marker.

### Recommendation panel

- Lists the selected zones in the order they were picked. Each one shows its name, tagline, recommendation and rationale, and enters and leaves with `AnimatePresence`.
- An empty state explains what to do, and "start over" clears the selection.
- Selection lives in `SelectionProvider` (React Context), so the plan and the panel can sit in different parts of the layout.

### Mobile (< 640px)

- A static preview of the plan with an "Explore the plan" button opens a full-screen bottom sheet. The sheet contains the interactive plan and the panel.
- The sheet is rendered through a portal to `document.body`. An animated ancestor with a transform would otherwise break `position: fixed`.
- Focus is trapped inside the sheet. It closes with Escape, a backdrop click, the × button or Done. Page scroll is locked while it is open, and focus returns to where it was before.
- The plan component has two modes, `interactive` and `preview`, so the SVG markup is not duplicated between desktop and mobile.

### Accessibility

- Each zone is `role="button"` with `tabIndex=0`, `aria-pressed`, and an accessible name taken from the zone name and tagline (`aria-labelledby`).
- Zones respond to Enter and Space on the keyboard and show a visible focus ring (`focus-visible`).
- Decorative layers are `aria-hidden`.
- Every animation respects `prefers-reduced-motion`: markers appear without drawing in, and the sheet opens without sliding.

### Design system and i18n

- Tokens in Tailwind v4 `@theme`: palette (forest, ivory, paper, gold, ink…), fluid type scale (`clamp()`) and spacing scale.
- Gold text uses `gold-dark` (`#796034`), because plain gold on ivory fails WCAG AA contrast.
- English and Russian copy are provided through `LanguageProvider`. English is the default; Russian is kept in the code for later.

## Porting from Next.js

| Next.js original | This repo |
| --- | --- |
| `next/font/google` + CSS variables | Google Fonts `<link>` in `index.html`, font families set directly in `@theme` |
| `app/icon.tsx` (`next/og` ImageResponse) | static `public/favicon.svg` with the same three-stone icon |
| `"use client"` directives | removed, because they do nothing in Vite |
| full-site `translations.ts` | only the `map` section |
| `page.tsx` with every site section | `App.tsx` with the SpaceMapper only |

Everything else was moved over 1:1, so the behaviour matches the live site at <https://cairn-botanics.vercel.app/>.

## Repository setup

- Monorepo layout: `frontend/` now, `backend/` next.
- A single root `.gitignore` covers `node_modules`, build output and `.env*`.
- `.gitattributes` forces LF line endings. Code is edited on Windows but built on Linux (Docker, GitHub Actions).

## Known gaps

- ~~Zone data is spread over several maps keyed by zone id: shapes, marker lines, label positions, hover colors and copy. Marker lines, label positions and areas are hand-placed coordinates rather than computed.~~ **Resolved in phase 1:** one `Zone` record per zone, with markers and areas computed (see [phase-1-zone-model.md](phase-1-zone-model.md)).
- Oxlint reports two `only-export-components` warnings, because each provider and its hook share a file. They will be split when state management is revisited.
- ~~There are no automated tests yet.~~ **Resolved in phase 1:** Vitest runs in CI and covers geometry, marker generation and the demo plan.
