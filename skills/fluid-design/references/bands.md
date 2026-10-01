# The bands: phone, tablet, landscape, desktop

Purpose: The four bands: what each scales off, where it switches, why landscape needs its own rule,
the continuity between them, the full-width default on tablet and landscape, damping per band, and
converting an existing mobile layout.

Read when: setting up the mobile side, a tablet or landscape question, a jump at a breakpoint, a
designed tablet frame, or holding a band still.
Skip when: the site is desktop-only below (`bands.phone: false`): there are no mobile bands.
Inputs: the design's phone frame (and any tablet frame), `fluid.config.json` (`bands`), the band
settings in the project's `:root`.
Produces: band settings and breakpoints with their reasoning, or the explanation of a band's value.

## Contents
1. The four bands
2. How they fit together
3. Variations: a designed tablet, holding a band, plain Tailwind
4. Measured, converting, and what stays off the bands
5. Traps

On by default (`bands.phone: true` brings `tablet` and `landscape`; `false` is a flat 1px below
desktop). The **phone design scales off its own frame** in three bands; the desktop design keeps its
own scale above the desktop breakpoint. Built for the usual brief: a desktop frame and a phone frame,
no tablet design. **The numbers below are fallbacks:** read each band's frame off the design (phone
frames are often 402 wide, not 390).

## 1. The four bands

| Band | Media condition | Scales off | Range (settings) | Covers |
|---|---|---|---|---|
| phone | default | `100vw / --fluid-phone-base-width` (390) | `--fluid-phone-scale-min/-max` (0.82–1.10) | iPhone SE (320) to Pro Max (430) |
| tablet | `width >= bands.tablet.minWidth` (600) | `100vw / --fluid-tablet-base-width` (700) | `--fluid-tablet-scale-min/-max` (1.10–1.30) | portrait tablets: iPad mini 1.10, Air 1.17, Pro 11 1.19 |
| landscape | `(orientation: landscape) and (height <= bands.landscape.maxHeight)` (500) | `100vw / --fluid-landscape-base-width` (780) | `--fluid-landscape-scale-min/-max` (1.00–1.20) | a phone on its side: SE 1.00, 15 1.08, Pro Max 1.20 |
| desktop | `width >= bands.desktop.minWidth` (1024) | 1440×900, both axes | `--fluid-desktop-scale-min` (0.58–) | laptops, and **landscape tablets** (iPad 1024–1366 wide: 0.71–0.95) |

## 2. How they fit together

- **The three mobile bands run one drawing.** Authors write the phone frame's numbers once
  (`fluid-py-48`, `fluid-display-44/48`); the bands only change the unit. Rotating a phone swaps the
  unit in CSS and the page reflows.
- **Why landscape needs its own rule.** By width alone a phone on its side (844×390) and a portrait
  iPad (834×1194) match. Height separates them: under 500px tall is a phone. The landscape block comes
  after the tablet block so it wins when both match (a Pro Max on its side is 932 wide); `bandAt()`
  checks desktop, then landscape, tablet, phone.
- **Continuous, then one switch.** The phone band tops out at 1.10, exactly where tablet starts, and
  landscape never goes below 1.00, so rotating never shrinks the design. **Keep
  `--fluid-tablet-scale-min` equal to `--fluid-phone-scale-max`** when you change either, or the page
  jumps at 600px. The only intended jump is at the desktop breakpoint, where the composition changes.
- **Full width on tablet and landscape.** Their container width defaults to the desktop breakpoint
  (1024, wider than any window in those bands) with a 32 gutter, so the phone design spans the
  screen. The old 560 column read as a phone floating on a tablet; restore it with
  `--fluid-tablet-container-width: 560; --fluid-tablet-container-padding: 24;` (and the same for
  `landscape`). Section colour is full width either way, since it sits on the section.
- **Damping per band.** Each band has its own `--fluid-<band>-<role>-damping` (mobile display 0.85,
  copy 0.60). The desktop values (0.62 / 0.33) were tuned for a 0.58–1.0 range; across the phone's
  0.82–1.10 they leave type nearly static (body 16 → 15.1 at 320). With the phone values type
  follows the layout more closely: heading 44 → 42.6 at 375 and 37.3 at 320, body 16 → 15.6 and 14.3.
  Smallest labels shrink too: draw phone labels at 12 or more, or raise
  `--fluid-phone-copy-damping` toward 0.33.
- **Why the ranges are narrow.** A phone composition stretched past about 1.3× reads as a toy, and
  outside the range the unit is plain px, so text zoom on the phone keeps working there.
## 3. Variations: a designed tablet, holding a band, plain Tailwind

- **A designed tablet.** If the designer draws one (say 834), author its numbers with `md:` (or
  `fluid-tablet:`) and set `bands.tablet.minWidth` and `--fluid-tablet-base-width: 834` plus a real
  scale range.
- **Holding a band still.** `scale-min` = `scale-max` makes a band plain px; `bands.tablet: false`
  or `bands.landscape: false` leaves those screens on the phone band (held at 1.10).
- **Plain Tailwind still works per value.** `text-[15px]` stays 15px everywhere; only `fluid-*`
  moves. Fluid desktop with fixed breakpoints below is `bands.phone: false`.

## 4. Measured, converting, and what stays off the bands

Measured on `examples/pizza-next` (hero `fluid-display-44`, `lg:fluid-display-112/112`): phone
320 → 37.3, 375 → 42.6, 390 → 44.0, 430 → 48.4; tablet 768 → 48.4, 820 → 51.5; landscape 844×390 →
47.6, 932×430 → 52.6; a landscape iPad at 1024×768 is already desktop (unit 0.821, heading 91.9px).
Both examples pass `fluid verify` in Chromium, WebKit and Firefox plus a real-zoom row.

- **Converting an existing site:** check the geometry at the phone frame's width before and after
  (the unit is exactly 1 there, so moving mobile px to fluid utilities is a no-op). Remove `sm:`/`md:`
  size overrides that were never drawn: they are what makes a tablet jump.
- **Keep off the bands:** input font sizes (iOS zooms into a focused input under 16px; keep 16px),
  text measures, borders, tracking, entrance offsets, icons of 24px and under.
- **The bands and zoom:** a desktop window zoomed past the breakpoint lands here, where mobile type
  is up to 1.3× drawn, so the handover drop mostly closes (1920×1080 at 200%: 166% flat, 212% with
  the bands on).

## 5. Traps

- Changing `--fluid-phone-scale-max` or `--fluid-tablet-scale-min` without the other: a jump at 600px.
- A fluid input font size with the mobile bands on: iOS zooms into inputs under 16px.
- `sm:`/`md:` size overrides that were never drawn: they make a tablet jump.
- Keeping the defaults without reading the phone frame off the design (390 vs a 402 frame is 3% off
  everywhere).
