# Browser zoom: the measurements

The measurement record behind `fluid-design/references/fluid-scale.md` §12 (Browser zoom) and
`assets/runtime/fluid-zoom.js`. The skill keeps the rules; this file keeps the numbers they came
from. Moved out of `fluid-scale.md` in the September 2026 docs pass (FIX-PLAN S5).

## Without compensation

Desktop zoom shrinks the CSS viewport by the zoom factor, so a unit built only from `vw`/`svh`
renders at the same physical size at every zoom level. Type only grows once zoom pushes the CSS
viewport below the desktop breakpoint: about 141% on a 1440-wide window, 188% on 1920, 250% on
2560. Measured with real Chromium zoom, body text on an uncompensated build reached 100% of its size
at 150% zoom on 2560×1440, and 122% at 200%.

## With `--fluid-z`

The same build with the runtime installed: 110/125/150/200% zoom gave 110/125/150/200% text wherever
the desktop layout was still active, at 1440, 1920 and 2560, with no horizontal overflow.

**Why the arms are multiplied before the clamp.** Multiplying anything already clamped
over-compensates: the whole type unit (its px term already zooms) gave 146% text at 125% zoom on a
1440 window; `--fluid` itself where the ceiling binds gave 156% text at 125% on a 3840×2160 window
with `--fluid-desktop-scale-max: 1.6`.

**`fluid-text` by size.** Measured on the Vite example at 2560×1440 and 200%: zooming `fluid-text`
fully, the 200px hero title wrapped onto two lines and ran over the body copy beside it. Leaving it
out, the body copy that build sets in `fluid-text` (8 of its 14 type styles) did not zoom at all. By
size (full up to 24 drawn px, none from 48), the title held its line and the copy doubled.

**Fixed ui.** The Vite example's fixed reservation tab kept its size and position at 200% and sat
over copy it cleared at 100%.

**The mobile handover.** Body copy drawn 15px on mobile against 17.65px on a 1920 desktop reached
170% at 200% zoom (255% at 300%). With the mobile bands scaling type, 1920×1080 at 200% went from
166% (flat mobile) to 212%.

## Per engine (real browsers, 2026-09-24)

| Engine | Signal | Result |
|---|---|---|
| Chromium (Chrome, Edge, Arc, Brave, Opera) | `outerWidth/innerWidth` agreeing with `devicePixelRatio`, confirmed by the height axis | exact at 110–300% |
| Safari 26 (macOS) | `outerWidth/innerWidth` snapped to Safari's steps, confirmed by the height axis | exact at 115, 125, 150, 175, 200% |
| Firefox 146 | none reliable | not compensated (reads 1) |

**Chromium.** Verified with real zoom (`Preferences` `default_zoom_level`, new headless) at
110–300% on 1440, 1920 and 2560 windows, on the fixture page and both example builds
(`verify-matrix.mjs`'s zoom row). `outerWidth` reads 0 until the first frame, so the script retries
on the next frames.

The width match alone is fooled whenever a side panel's share of the window equals a
display-scaling ratio: Windows at 125% with a 20% side panel gives r = 1.25 = dpr 1.25 / native 1;
150% with a 1/6 panel gives 1.2 = 1.5 / 1.25; 200% with a 25% panel 1.333 = 2 / 1.5; a Retina Mac
with DevTools docked right at 50% gives 2 = 2 / 1. Zoom shrinks `innerHeight` by the same factor as
`innerWidth`, and a side panel doesn't, so a factor is accepted only when the toolbar it implies,
`outerHeight − innerHeight × z`, is 0–200 window px. In those cases it comes out tens to hundreds of
px negative. `scripts/test/zoom-detect.mjs` is the table (stubbed window values, runs in Node).

- DevTools docked at the bottom with real zoom fails the height check and reads 1: uncompensated,
  the safe failure.
- **Known limit:** Windows 150% display scaling plus a 1/6-width side panel plus a tall toolbar
  (a bookmarks bar: the implied toolbar is 1.2 × toolbar − 0.2 × outerHeight, which clears 0 from
  about 114 window px on a 680-tall window) still reads 1.2. Uncompensated would be 1; this
  inflates type by 20%.

**Safari** keeps `devicePixelRatio` fixed, but `innerWidth` shrinks by exactly the zoom (ratios
1.1507, 1.2506, 1.5000, 1.7500, 2.0000). The sidebar shrinks `innerWidth` too, but not `innerHeight`,
so a width ratio is accepted only when the toolbar height it implies is 0–150 points. That check is
necessary: sidebar open at 100% gives a width ratio of 1.2038 (implied toolbar −131); with the
sidebar open at 125% the width ratio was 1.5060, within 0.4% of Safari's 150% step, and the implied
toolbar (−126) rejected it. Sidebar plus zoom therefore reads 1. Measured by driving real Safari zoom
and the sidebar through Cua Driver, reading `assets/runtime/zoom-debug.html`.

**Firefox** reports `outerWidth` and `screen.width` in zoomed CSS px too, so zoom shows only in
`devicePixelRatio`, mixed with the display's own ratio. Measured on real Firefox 146 (Retina, Cmd +
driven through Cua Driver): `devicePixelRatio` 2, 2.222, 2.4, 2.609, 3, 3.333, 4 at 100, 110, 120,
133, 150, 170, 200%, while `outerWidth/innerWidth` stayed at 1.01–1.05 (the rest is Firefox's own
sidebar). The steps overlap: 3 is Retina at 150% or 1× at 300%, 2.4 is Retina at 120% or 1× at 240%.
The screen size can't break the tie, because a Retina Mac in "Larger Text" mode reports what a 1×
screen zoomed in does. A wrong factor inflates type, so Firefox reads 1.

## Reproducing

Serve `fluid-design/assets/runtime/zoom-debug.html` next to `zoom.js`, open it, zoom, and read the
live signals and the detected `--fluid-zoom` off the page. `fluid verify <url>` runs the Chromium zoom
row; `node fluid-design/scripts/test/zoom-detect.mjs` runs the geometry table.
