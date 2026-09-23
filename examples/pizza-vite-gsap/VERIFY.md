# VERIFY — evidence for the definition of done

Run on 2026-09-23 against `npx vite preview --port 4320`, a production build that I started and
stopped myself. Raw outputs are in `verify-out/`. The PNGs and contact sheets are git-ignored
because they are large and reproducible.

## 1. Build and types: PASS
- `npx tsc --noEmit`: clean, with `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals` and
  `verbatimModuleSyntax` on TypeScript 7.0.2.
- `npm run build` (`tsc --noEmit && vite build`): built. Output is 17.1 kB of HTML, 14.8 kB of CSS
  and 96.4 kB of JS (37.5 kB gzip, mostly GSAP).

## 2. Audit: 1 error, a false positive in the skill's generated file (see SKILL-FEEDBACK #10)
`node ../../fluid-design/scripts/audit.mjs src` → `verify-out/audit-src.txt`:
one `length-times-unit` error at `src/styles/fluid/scss/_fluid.scss:39`. That line is the
generator's own `@error "…64px * var(--fluid)…"` message string, in a do-not-edit generated
file. No hand-written file has a finding. Scanning the project root (which adds `index.html`)
gives the same single finding. Caveat: on the SCSS stack the audit's main rule cannot see fixed
px values in SCSS at all (SKILL-FEEDBACK #11), so this result is weak evidence.

## 3. Viewport matrix: PASS
- **The brief's exact command** (`--reveal --screens --fit-selector '[data-fit=screen]'`):
  PASS on all 20 cells, 1024–2560 × 640–900. Output in `verify-out/brief-command.txt`. It
  never visits 2560×1440 or a phone, because those are not in the defaults (SKILL-FEEDBACK #12).
- **Extended**: `--widths 1024,1440,1680,2560,3840 --heights 700,900,1440,2160 --mobile 390x844,375x667`.
  PASS on all 22 cells: overflow, units, fit and reveal. Output in `verify-out/extended.txt`.
- **Non-default units confirmed** by the verifier's own maths from `fluid.config.json`:
  1024×700 → 0.7111, 1440×900 → 1.000, 1680×1440 → 1.1667, **2560×1440 → 1.600 (capped)**,
  2560×2160 → 1.600, 3840×2160 → 1.600. The raw expression is
  `min(1.6px, max(.58px, min(calc(100svh / 900), calc(100vw / 1440))))`.
- **The ceiling actually binds.** At 2560×1440 the uncapped value is also 1.6, so that cell
  cannot tell a capped build from an uncapped one. The negative control
  (`verify-out/negative-no-ceiling-patch/report.json`) is the generator's raw SCSS without the
  local ceiling re-declaration. It FAILS at 2560×2160 (`--fluid` 1.778) and at 3840×2160 (2.4).
  The patched build passes both at 1.6.
- `probe.mjs` at 1440×900: FRESH. All four units are 1.0000.
- Hero fit: `height / innerHeight` is 1.0 wherever height binds (1440×700, 2560×1440,
  3840×1440) and ≤ 1 everywhere else.

## 4. Scrub modes: PASS
`node scripts/scrub-modes.mjs` drives `#forno` by scene progress in 20 steps, then waits 2.5 s
for the glide:

| progress | 1440×900 mode / frame | 390×844 mode / frame |
|---|---|---|
| 0 | head / 9 (loop 1–60) | head / 9 |
| 0.5 | scrub / 169, paused | scrub / 171, paused |
| 1 | tail / 253 (loop 241–298) | tail / 253 |
| 0.5 (back) | scrub / 170 | scrub / 172 |
| 0 (back) | head / 2 | head / 2 |

The expected frame at progress 0.5 is 169: headExit 0.0067 and tailEnter 0.822 on an 1800px
range give t = 0.60 → 61 + 0.60·180. `scripts/scrub-jitter.mjs`, parked at 0.5: 0 frames
presented in 3 s, paused. Before the local `scrubStage.ts` patch it presented 121 frames in 2 s,
alternating 171 and 172 (SKILL-FEEDBACK #14). `data-motion-state="head"` at progress 0 relies on
the markup seed (SKILL-FEEDBACK #15).

## 5. Screenshots I looked at
- **1440×900**: the header rail sits on the 64 gutter, "Pinsa romana" is at 200px, the peel is
  centred on the sand arc, the flanking copy is on the gutters and the vertical Réservation pill
  is on the right rail. Nothing is clipped. This is the calibration point: the frame is 1440 with
  1312 of content.
- **1024×700**: the same composition at 0.711, the whole hero is within 640px, and the headline
  fits the frame.
- **2560×1440**: the same composition at 1.6, and the header is on the scaled rail.
- **390×844**: plain mobile: stacked hero, pill as a horizontal button, a 2-up menu, 2-up stats,
  acts over the pinned video, and a stacked footer.
- 1680×700 (height binds on a wide window): the hero's flanking copy spreads to the 1600px
  frame's gutters while the centre shrinks. That is expected from the grow-only cap, but it
  contradicts `frame-and-gutter.md` §1 (SKILL-FEEDBACK #6). The menu grid was 6 columns there
  before its own width went on the scale; it is now 4 at every viewport
  (`scripts/grid-cols.mjs`).

## Extra checks (`scripts/misc-checks.mjs` → `verify-out/misc-checks.txt`)
Header ink: no attribute over the hero (light is the base), `dark` over the numbers, the scene
and the footer, and `light` again back over the menu. The count-ups end at 72, 450, 90 and 3. The
FadeOnExit group reads opacity 1 on arrival, 0 once 75% of the way out, and 1 again when
scrolled back.

## Who did the work
All of it was done in this session by lead-8 directly. No sub-workers were dispatched: the
page is one `index.html` plus one stylesheet that every section shares, so there were no
disjoint files to split.

> Note on `screenshots/screenshot-1440x900.jpg`: it is a full-page capture, so the pinned scrub scene
> appears as a long dark band. The video only paints inside the sticky viewport-sized pin while you
> scroll; see `screenshots/scrub-*.jpg` for the scene at progress 0, 0.5 and 1.
