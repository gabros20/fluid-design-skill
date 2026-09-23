# REVALIDATION — pizza-next resynced to the current skill (2026-09-23)

This pass re-copied the skill's shipped styles and React motion primitives into this example,
removed the example's local workarounds, and re-ran build, audit, matrix and an anchor-scroll
check on a production server. Nothing under `fluid-design/` was edited. Findings about the
skill are recorded here and were not patched.

## What changed in the example

| File | Change |
| --- | --- |
| `src/styles/fluid.css` | Re-copied. The only upstream change is a new `@theme` block holding the **full px breakpoint ladder** (`sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536`) and a docblock describing the mixed-unit ordering trap. |
| `src/styles/base.css` | Re-copied. Reduced motion: `[data-scrub-pin]` is now `height: 100svh` (was `auto`, which measured 0 around the absolutely positioned video). The new `[data-scrub-spacer] { height: 0 }` rule was added. |
| `src/styles/tokens.css` | **Workaround removed.** Deleted the local `--breakpoint-*` ladder, which `tokens.example.css` now says never to redeclare because it ships in fluid.css. |
| `src/app/globals.css` | **Workarounds removed.** (1) The `@layer base { html { scroll-behavior: auto } }` override. base.css's own `smooth` (with a reduced-motion `auto`) now applies. (2) The page-level `[data-scrub-spacer] { display: none }` rule under reduced motion, which base.css now covers. |
| `src/motion/lib/scrollPull.ts` | Re-copied. It adds `suspend(ms)` (default 1200 ms, cleared early by `scrollend`), a capture-phase `click` listener on `a[href^="#"]` and same-path hash links, and a `hashchange` listener. While suspended, the loop skips its `instant` writes and its away/reclaim bookkeeping. |
| `src/motion/components/ScrubStage.tsx` | Re-copied. `__scrub()` is now available in production behind `?fluid-debug` or `html[data-fluid-debug]`. The `SubjectPoint` docs now say master-canvas coordinates. The `className` docs say that it is the only prop forwarded. `data-scrub-pin` and `data-scrub-content` were already present, with no change. |
| `src/motion/components/Stage.tsx` | Re-copied. This drops the example's local `cn as cx from '../../lib/cn'` import in favour of the shipped `../lib/cx`. |
| `CountUp.tsx`, `useHeaderTheme.ts`, `lib/constants.ts` | Re-copied. The changes are docblocks only. |
| The other 12 listed primitives | Already byte-identical to the skill. |
| `scripts/anchor-check.mjs` | New. It runs the Playwright anchor-scroll check (step 7). |
| `verify/matrix-report.json`, `matrix-summary.txt`, `audit.txt` | Refreshed from this run. `hero-1440x900.webp` was recaptured and came out byte-identical. |

## Results

| Step | Command | Result |
| --- | --- | --- |
| Build | `pnpm build` | **PASS** (Next 16.3.6 Turbopack, 3/3 static pages) |
| Typecheck | `pnpm exec tsc --noEmit` | **PASS** (exit 0) |
| Audit | `node ../../fluid-design/scripts/audit.mjs .` | **PASS**: 0 errors, 0 warnings, 1 info (`fixed-px-at-engage`, Header.tsx:79, deliberate tracking) |
| Matrix | `verify-matrix.mjs http://localhost:4310 --reveal --fit-selector '[data-fit=screen]'` | **PASS 27/27** (25 desktop at heights 640/700/800/900/1440 plus 390×844 and 375×667). Overflow, units, fit and reveal all pass in every cell. |
| Anchor scroll | `node scripts/anchor-check.mjs` (3 runs) | **PASS 6/6.** At 1440×900 it landed at y=5164 against a target of 5164, **Δ 0.0 px**. At 390×844 it landed at y=4709 against 4709, **Δ 0.3 px**. The scroll was genuinely smooth (`scroll-behavior: smooth`, 68–72 distinct scrollY frames, about 1196 ms). Before the fix it stopped at y=4263. |
| CSS order | offsets in `.next/static/chunks/2c_rz01_xvn4h.css` | **PASS.** The `sm:` utility block `@media (min-width:640px)` is at byte 21959 and the `lg:` block `@media (min-width:1024px)` is at byte 22466. `lg:fluid-display-*` sits inside the 22466 block, and `sm:text-[64px]` sits inside the 21959 block. No rem media queries are emitted. The original bug had `lg` at about 22k before `sm` (`40rem`) at about 28k. |
| Screenshot | Playwright 1440×900, then `cwebp -q 82` | `verify/hero-1440x900.webp`, 70 KB. The hero renders correctly: the 2-line display headline over the sand arc, with no `sm:` override. |
| Server | `next start -p 4310` | Killed; nothing is listening on 4310. |

The anchor check's reference: `#menu` has no `scroll-margin-top`, and `html` has no
`scroll-padding-top`, so the correct landing is `rect.top = 0`. `--header-h` (72 px at 1440, 58 px at
390) is not used by the anchor. The section's heading still clears the header, with the heading at
top 196 and the header bottom at 72.

Extra reduced-motion check (items 1 and 19) at 1440×900 with `reducedMotion: 'reduce'`:
- `[data-scrub-pin]` is `position: static` with a height of 900 px. Before, `auto` measured 0.
- `[data-scrub-content]` has a `margin-top` of 0.
- `[data-scrub-spacer]` is 0 px tall.
- The scene is 2700 px tall, against 3600 px in full motion.

## SKILL-FEEDBACK items, re-checked

**Now confirmed fixed**
- **0:** the full px ladder ships in fluid.css's `@theme`. `tokens.example.css` warns never to
  redeclare it. The compiled order is correct.
- **1:** confirmed again.
- **2:** the `?fluid-debug` opt-in is in ScrubStage and in `verification.md`.
- **3:** the docblock now matches the code.
- **4:** `layer(base)` is covered in SKILL.md step 2.2 and the tailwind-v4 README.
- **8:** SKILL.md says `--out` is a directory.
- **10:** the default is kept and justified in the docblock.
- **11:** heights `640,700,800,900,1440` everywhere.
- **12:** the recipe says the atoms are inlined.
- **13, 14:** documented.
- **15:** `qcomp=1` is in `video.md`.
- **16:** renderer periodicity is in `video.md`.
- **17:** the texture warning is in `performance.md`.
- **18:** proven by the anchor check under real smooth scrolling.
- **19:** the spacer is in the attribute contract, and base.css collapses it. The pin is `100svh`.

**Still open / new findings**

1. **Item 20 is only half fixed. The scroll-well audit rule cannot fire on the canonical setup.**
   The new `scroll-well-vs-smooth-scroll` rule only fires when a scanned CSS file contains
   `scroll-behavior: smooth`. `scan()` skips every file whose header says "GENERATED …
   fluid-design", and the only place that sets it is `shared/base.css`, which carries that header.
   Measured two ways:
   - This project gives no finding, even though `DoughScene.tsx:121` uses `<PullToCentre>`.
   - A fixture made of just `base.css` plus a `<PullToCentre>` also gives no finding. Adding a
     hand-written `html{scroll-behavior:smooth}` makes it fire.

   The skip should still let generated files feed `buildContext`, and only exempt them from the
   rules. The finding is only info-level now that the well suspends itself, so this is 🟡. The
   `tw-breakpoint-units` rule works: a lone `--breakpoint-lg: 1024px` gives 1 error.
2. **🟡 Safari's fallback window is tight.** Without `scrollend`, `suspend()` clears after
   `SUSPEND_FALLBACK_MS = 1200`. Chromium's smooth jump from the top to `#menu` (about 5.2k px)
   took **1196 ms**. If WebKit's smooth scroll for a jump this long takes more than 1.2 s and is
   still inside the well's target when the suspension lapses, the well resumes its writes
   mid-flight. The tail of this particular jump is past the scene, so it probably would not bite
   here. This was **not tested**: only Chromium is installed for Playwright. Worth a WebKit run,
   or scaling the fallback with the jump distance.
3. **🟡 The harness no longer covers the anchor path.** `verify-matrix --reveal` now forces
   `scroll-behavior: auto` while it steps, which was the right fix for the harness. As a result,
   27/27 reveal passes do not exercise the scroll-well fix at all. Only a real anchor click does,
   which is what `scripts/anchor-check.mjs` does. The skill has no equivalent check.
4. **🟡 `audit.mjs --help` prints `unknown flag --help`**, the same class of bug as item 6,
   which was fixed for the other two scripts.
