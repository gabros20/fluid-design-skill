# Browser zoom (WCAG 1.4.4, resize text)

Purpose: Why viewport-scaled type does not grow under browser zoom on its own, how `--fluid-z` and
the zoom runtime give it back, how to install the runtime (and under a CSP), how detection works and
where it gives up, and the mobile handover.

Read when: wiring the zoom script, a WCAG 1.4.4 question, a strict CSP, or type that does not grow
(or jumps) under Cmd/Ctrl +.
Skip when: the project set `zoom: false` with the client's informed agreement (recorded in
`FLUID.md`).
Inputs: `fluid.config.json` (`zoom`, `output.integration`), the framework, the CSP.
Produces: the head-script wiring, the CSP answer, or the explanation of a zoom result.

## Contents
1. The problem and the fix
2. What zooms, and what does not
3. Install it first in `<head>`, and under a CSP
4. How it detects zoom, and when it gives up
5. The mobile handover, and checking it
6. Traps

## 1. The problem and the fix

**The problem.** Desktop zoom (Cmd/Ctrl +) makes a CSS pixel bigger and shrinks the CSS viewport by
the same factor, so a length built only from `vw`/`svh` renders at the **same physical size at every
zoom**. Without help, type does not grow until zoom pushes the CSS viewport below the desktop
breakpoint: about 141% on a 1440-wide window, 250% on 2560. That fails WCAG 1.4.4 on every display
wider than about 1440, worst on the large displays this system is proudest of.

**The fix, on by default.** `zoom: true` emits `--fluid-z`: the `--fluid` formula with each window
term multiplied by `var(--fluid-zoom, 1)` *inside* the same minimum and maximum, and the type units
read it instead of `--fluid`. The generated `runtime/zoom.js` detects the zoom factor and writes
`--fluid-zoom` to `:root` through an adopted stylesheet (`<html>`'s style attribute only where those
are missing). Each window term times the zoom equals its unzoomed value, so each type unit resolves
to the CSS px it had at 100% and renders z times larger: **text zooms 1:1, damping included**,
wherever the desktop layout is still active.

## 2. What zooms, and what does not

- **Only type is compensated.** `--fluid` and `--fluid-ui` stay; scaling the layout by the zoom would
  make it z times wider than the zoomed window. The layout keeps fitting and the larger text reflows,
  which is what zoom is for.
- **`fluid-text-*` zooms by size** (`--fluid-zoom-text-full` / `-none`, default 24 / 48): fully up to
  24px drawn, not at all from 48px, linearly between. It sits in a box that scales on `--fluid` and
  does not zoom: big type zoomed fully overruns its neighbours, small type not zoomed fails the
  check. The line height uses the same share, so a line box never zooms differently from its text
  (SCSS `fd.fluid-text($n, $size)`, StyleX `fluidText(n, size)`; the Tailwind utility does it for
  you). Roles always zoom fully: they sit in fixed measures and wrap. The css stack has no
  `fluid-text`, so no `zoom-text-*` settings.
- **Fixed ui does not move out of the way.** A fixed side tab keeps its size while text beside it
  grows, so at 200% it can cover copy it cleared at 100%. Check fixed elements in the zoom screenshots.
## 3. Install it first in `<head>`, and under a CSP

- **Install it first in `<head>`**, before first paint, or a page opened at a remembered zoom renders
  small type and then jumps. `output.integration` generates the wiring:
  - Next: `import { FluidHead } from '…/fluid/integrations/next'` → `<head><FluidHead /></head>`
  - Vite: `import { fluidPlugin } from './fluid/integrations/vite'` → `plugins: [fluidPlugin()]`
  - other (`"none"`): `<script src="/…/fluid/runtime/zoom.classic.js"></script>` as the first classic
    script in `<head>` (not `type="module"`, which runs after first paint), or the
    `FLUID_ZOOM_INLINE` string from `runtime/zoom.js` pasted into that `<script>`.

  `runtime/zoom.d.ts` ships alongside (TypeScript with `allowJs: false` needs it). The adopted
  stylesheet changes no DOM, so React sees no extra attribute and no hydration warning; read the
  value with `getComputedStyle`, not `element.style`.
- **Under a Content Security Policy.** The adopted stylesheet is not an inline style, so `style-src`
  does not apply. The script needs `script-src`:
  - **nonce:** `<FluidHead nonce={nonce} />` (Next: `const nonce = (await headers()).get('x-nonce') ?? undefined`),
    `fluidPlugin({ nonce })` in Vite (a placeholder your server replaces), or your nonce on the
    `zoom.classic.js` tag.
  - **hash:** allow `'<FLUID_ZOOM_SHA256>'` (exported by `runtime/zoom.js`) in `script-src`.
    `FLUID_ZOOM_INLINE` is fixed at generate time, so no bundler changes the text under the hash;
    `zoom.classic.js` carries the same line and names its hash in its header.
## 4. How it detects zoom, and when it gives up

- **How it detects zoom, and when it gives up.** No browser exposes page zoom. In Chromium the
  factor is accepted only when `outerWidth / innerWidth` and `devicePixelRatio` over a plausible
  native ratio agree within 4%, **and** the height axis agrees (the implied toolbar is 0–200 window
  px); a side panel or right-docked DevTools shrinks only the width, so it reads 1. Safari keeps dpr
  fixed, so it snaps `outerWidth / innerWidth` to Safari's zoom steps with the same height check.
  Firefox always reads 1. An iframe, device emulation, bottom-docked DevTools with zoom, or zoom-out
  also read 1: it can fail to compensate, and it is built never to inflate type on an unzoomed page.
  **Known limit:** Windows 150% display scaling plus a 1/6-width side panel plus a tall toolbar can
  still read 1.2.

  | Engine | Result (real browsers, 2026-09) |
  |---|---|
  | Chromium (Chrome, Edge, Arc, Brave, Opera) | exact at 110–300% |
  | Safari 26 (macOS) | exact at 115, 125, 150, 175, 200% |
  | Firefox | not compensated (reads 1). Desktop type ignores zoom until the page falls through to mobile; say so before promising WCAG 1.4.4 |

  The measurements and false-positive geometries are in the repository's
  `docs/research/zoom-measurements.md`; `tests/zoom-detect.mjs` is the geometry table as a test. To
  check a browser yourself, serve `assets/runtime/zoom-debug.html` next to `zoom.js`, zoom, and read
  the detected `--fluid-zoom`.
## 5. The mobile handover, and checking it

- **The mobile handover.** When zoom pushes the CSS viewport below the desktop breakpoint, text
  becomes *mobile size × zoom*. On a window wider than the design frame, desktop type had grown past
  its drawn size, so the handover steps down. Draw mobile body copy no smaller than desktop; the
  mobile bands (`bands.md`) soften the step further.
- **Check it** with `fluid verify <url>`: its zoom row loads the page under real browser zoom and
  reports physical text growth (`verification.md`). To *see* a zoomed page, capture it through the
  DevTools protocol (`Page.captureScreenshot`); Playwright's `page.screenshot` crops a zoomed page to
  its top-left 1/zoom. `zoom: false` turns this off; only with the client's informed agreement,
  recorded in `FLUID.md`.

## 6. Traps

- No browser-zoom script: `vw`/`svh` type does not grow under zoom, a WCAG 1.4.4 failure on wide displays.
- Multiplying anything already clamped by the zoom (the whole type unit, or `--fluid` where its
  minimum or maximum binds): measured 146% and 156% text at 125% zoom. Multiply the window terms,
  then clamp; that is `--fluid-z`.
