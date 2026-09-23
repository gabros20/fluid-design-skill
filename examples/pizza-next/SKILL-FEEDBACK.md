# SKILL-FEEDBACK — what building "Forno Aurelia" with `fluid-design` turned up

Build: Next 16 + Tailwind v4 + Motion, greenfield, defaults config, one ScrubStage.
Each item: **what I hit**, **where**, **what I did instead**. Severity: 🔴 wrong / blocks,
🟠 misleading / cost time, 🟡 polish. The skill was being edited while I built; items re-checked
against the tree at the end are tagged **[fixed upstream]** or **[still open]**.

## Wrong or broken

0. 🔴 **[still open]** **`--breakpoint-lg: 1024px` alone breaks Tailwind's variant order — every `sm:` beats
   every `lg:fluid-*`.** `assets/styles/tailwind-v4/tokens.example.css` (and SKILL.md step 2.4)
   set only `lg` in px while Tailwind's other breakpoints stay in rem (40rem, 48rem…). Tailwind v4
   sorts breakpoint variants by value and cannot compare px with rem, so the whole `lg:` block was
   emitted BEFORE the `sm:` block. Symptom on the first render: `sm:text-[64px]` won over
   `lg:fluid-display-112/112` (a 112px headline rendered at 64px on a 112px line box) and
   `sm:size-[520px]` won over `lg:fluid-size-1100`. It compiles, the classes are present, the
   units are FRESH — it looks exactly like a design mistake. Found by reading the compiled CSS
   (`@media (min-width:1024px)` at offset 22k, `@media (min-width:40rem)` at 28k). *Did:* define
   ALL breakpoints in px in `@theme` (`sm 640px, md 768px, lg 1024px, xl 1280px, 2xl 1536px`).
   Not `lg: 64rem` instead: media-query rem follows the browser font-size setting, while
   fluid.css's `(width >= 1024px)` does not. *Fix:* ship the full px set in tokens.example.css,
   say why in SKILL.md 2.4, and add an audit rule (a `--breakpoint-*` set in px while others are
   default/rem).

1. 🔴 **[fixed upstream: `data-scrub-pin` / `data-scrub-content` now emitted and collapsed; I re-copied ScrubStage.tsx + base.css and confirmed the pin computes `static` under reduced motion]** **Reduced-motion structural collapse targets attributes nothing emits.**
   `assets/styles/shared/base.css` collapses `[data-motion-scene-viewport]`;
   `references/scroll-scenes.md` §10 says `[data-scrub-stage-sticky]`; `ScrubStage.tsx` puts
   neither on its sticky pin (it only sets `data-scrub-stage` on the range wrapper). The wrapper has
   no explicit height to begin with, so `[data-scrub-stage]{height:auto!important}` is a no-op too.
   Net effect: under reduced motion the pin stays sticky and the 4-viewport runway stays; only the
   JS half (held head frame, frozen camera) works. *Did:* left as shipped (did not edit the copied
   component) and recorded here. *Fix:* pick one attribute name, emit it on the sticky div in both
   engines, use it in base.css and scroll-scenes.md, and collapse the `-100lvh` cancel margin too.

2. 🔴 **[still open]** **`window.__scrub()` does not exist in a production build**, but the verification flow (and
   this brief) runs `next start`. `ScrubStage` returns early when `NODE_ENV === 'production'`.
   *Did:* my sweep script (`scripts/scrub-check.mjs`) reads the DOM contract instead
   (`video[data-motion-state]`, `currentTime`, the camera transform) and uses `__scrub()` only when
   present; I also ran the same sweep against `next dev` to read `__scrub()`. *Fix:* say so in
   `verification.md` §1, or gate the probe on a `?debug` flag / `data-motion-debug` rather than
   NODE_ENV.

3. 🟠 **[still open]** **`SubjectPoint` docblock contradicts the code.** `ScrubStage.tsx` documents
   `subject` as "in the CROP's own normalised coordinates", but `applyFraming` computes
   `(subject.x − crop.x) / crop.w`, i.e. it expects MASTER-canvas coordinates. With a centred
   subject both readings give 0.5, so it only bites off-centre. *Did:* wrote master-canvas
   coordinates and a comment saying why.

4. 🟠 **[still open]** **`base.css` must go into a cascade layer, and nothing says so.** Imported plainly after
   `@import 'tailwindcss'` it is unlayered, and unlayered beats every Tailwind layer: its
   `:focus-visible` outline, `button { cursor }` etc. override utilities. *Did:*
   `@import '../styles/base.css' layer(base);` in `globals.css`. *Fix:* put that line in the
   tailwind-v4 README and SKILL.md step 2.2.

5. 🟠 **[fixed upstream]** **`verification.md` §7 describes the scripts wrongly.** It says `audit.mjs` "runs after a
   matrix capture, scanning the resulting screenshots" (it is a static source scanner), and ends
   with "These are being written by another worker in this skill" — orchestration text that leaked
   into a shipped reference. `scripts/README.md` is the accurate one; §7 should defer to it.

6. 🟠 **[fixed upstream]** **CLI `--help` is broken on two scripts.** `generate-fluid.mjs --help` throws a raw stack
   trace (`unrecognised argument "--help"`); `verify-matrix.mjs --help` prints
   `unknown flag --help`. `verification.md` tells the reader to "check each script's own `--help`".

## Unclear or inconsistent

7. 🟠 **[fixed upstream: `references/attribute-contract.md`]** **SKILL.md cites a "§3" attribute table that is not in SKILL.md.**
   `motion-architecture.md` §4 and `scroll-scenes.md` §10 point to "`SKILL.md` §3" for the
   `data-stage` / `data-scrub-stage` / `data-header-theme` contract. SKILL.md has no such table (it
   lives in the orchestration CONTRACT.md). *Did:* read the component source. *Fix:* add the table
   to SKILL.md or a reference.

8. 🟡 **`generate-fluid.mjs --out` writes per-stack subfolders**, and `--stack tailwind-v4` also
   writes `shared/base.css`, `cn.ts`, a README and `tokens.example.css`. SKILL.md step 2.1 reads as
   if `--out <styles dir>` receives the stylesheet directly. Worth one sentence.

9. 🟡 **[fixed upstream]** **tailwind-v4 README links `references/tokens.md`** — the file is `tokens-and-theming.md`.

10. 🟡 **[still open]** **`CountUp` defaults `amount = 0.6`**, a fraction, while `motion-architecture.md` §6 says
    "`amount` as a fraction is a trap … set the trigger line with `margin`". Harmless on an inline
    numeral, but the shipped default contradicts the rule the reader was just taught.

11. 🟡 **[still open]** **Matrix heights disagree.** SKILL.md step 7 says heights `640/700/800/900/1440`;
    `scripts/README.md` and the script default say `640,700,800,900`.

12. 🟡 **`section-recipe.md` anatomy uses atoms that do not ship** (`<Eyebrow fluid>`,
    `<Btn fluid>`). Fine as illustration, but a fresh agent looks for them. *Did:* inline classes
    (an atom is extracted at its second consumer anyway).

13. 🟡 **`ScrubStage` does not forward attributes to its range wrapper** (only `className`). A dark
    scene therefore cannot be marked once with `data-header-theme="dark"`; every act, including
    the empty spacer act, has to carry it or the header flips to light ink mid-scene. Worth a line
    in the ScrubStage docblock, or pass-through props.

14. 🟡 **The header-theme probe's element.** `useHeaderTheme(base, ref)` probes
    `ref.offsetTop + offsetHeight/2`. When the ref is inside the fixed header (a nav inside a
    `StageItem` inside the header), `offsetTop` is relative to the header, which is what you want,
    but the doc never says which element to pass. One sentence would save a read of the hook.

15. 🟠 **`video.md`'s all-intra recipe does not give pixel-identical loop seams.** Master frames
    0 and 60 were byte-identical, yet `-crf 22 … keyint=1` (the recipe, at any CRF) decoded them at
    31.8 dB against each other: CRF's rate control (`qcomp` < 1) spends a different QP on each frame,
    and the first frame gets the most. That is a sharpness pop on every head-loop wrap, invisible to
    a PSNR check run on the MASTER (§2 measures seams there). *Did:* `-x264-params
    …:qcomp=1` (identical input → identical output; seams now decode as PSNR ∞ against ~30 dB
    neighbours), CRF raised to 33 to hold ~9 MB. *Fix:* add `qcomp=1` to the scrub recipe and say
    "measure seams on the ENCODED file" in §2, as §9 already says for posters.

16. 🟡 **A generated loop needs the renderer checked too.** PIL `rotate()` returns an unresampled
    copy at exact multiples of 90°, so the frames where the sway term was 0 were sharper than their
    neighbours. Generic lesson for `video.md` §2: a procedurally rendered loop can be pose-periodic
    and still not pixel-periodic.

17. 🟡 **Asset budget guidance for all-intra is missing a texture warning.** A textured ground (flour
    on slate) cost 37 MB at CRF 22 / 1600×900; softening the ground and dropping to 1440×676 got
    9 MB. `performance.md` §13 could say "all-intra re-pays background texture every frame".

18. 🔴 **[still open]** **The scroll well cancels smooth scrolls, and base.css turns smooth scrolling
    on.** `PullToCentre`/`scrollPull.ts` writes `scrollTo({behavior:'instant'})` every frame while
    engaged. An instant write cancels any smooth scroll in flight, and `base.css` sets
    `html { scroll-behavior: smooth }`. So any smooth programmatic scroll that crosses the well's
    target stops dead there. Measured: clicking the header's `#menu` anchor from the top landed at
    y=4263 (act 3) against a target of 5164, every time. The same bug made `verify-matrix --reveal`
    FAIL in all 27 cells (30/54 items never revealed: the harness's `scrollTo` never got past the
    scene). The well's "the visitor always wins" logic only sees user motion; a smooth anchor jump
    is the visitor's intent too. *Did:* `html { scroll-behavior: auto }` in globals.css (instant
    anchor jumps never dwell in the well). After that, anchor 5164/5164 and matrix 27/27 PASS.
    *Fix:* pause the well while a smooth scroll is in flight (e.g. listen for `click` on
    `a[href^="#"]` and `scrollend`), or drop `scroll-behavior: smooth` from base.css. Also make
    verify-matrix scroll with `behavior:'instant'`, so the harness measures reveals rather than
    the page's scroll behaviour.

19. 🟠 **[still open]** **Reduced motion leaves the empty spacer act.** With the pin collapsed,
    the 2-viewport spacer (`ScrollStack.tsx`'s own recipe) is still 1800 px of blank dark band.
    *Did:* marked it `data-scrub-spacer` and hid it in a page media query (scene 3600 → 1800 px).
    Also worth checking: the collapsed pin is `height:auto` with an absolutely-positioned video
    inside, so the pin box may collapse to 0 and hide the held frame. I did not chase this further.
    *Fix:* make the spacer part of the attribute contract, and give the reduced-motion pin an
    explicit height (e.g. `100svh`).

20. 🟡 **[still open]** **The audit passed a page that had item 0 and item 18.** Both are
    statically detectable: a `--breakpoint-*` token in px while the others are default/rem, and
    `PullToCentre` in a tree whose CSS sets `scroll-behavior: smooth`.

## Things that worked exactly as documented

- `generate-fluid.mjs` with the default config reproduced `assets/styles/tailwind-v4/fluid.css`
  and `shared/base.css` byte for byte.
- `calc.mjs budget` / `table` were the fastest way to settle the hero row (1280, 0px margin) and the
  menu grid's scaled minimum (360: never 4-up at the canvas, always 3-up at the reference).
- The `Stage`/`StageItem` wiring kept every section a server component.
- `ScrubStage` with a two-tier camera worked first time on my own clip: modes flip head → scrub → tail
  exactly at the configured frames, and `__scrub().targetTime` matched `currentTime` within half a frame.
- verify-matrix's unit/fit checks and the fit-ratio report are exactly the evidence the brief asks for.
