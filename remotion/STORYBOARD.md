# Storyboard — the fluid-design hero

1280×720 · 30 fps · two renders (`hero-light`, `hero-dark`) · loops.

The whiteboard sketch an expert draws to explain fluid-design: a design is drawn on one frame, a
normal site is exact there and wrong everywhere else; fluid-design writes every drawn number as
`n × unit`, where the unit is 1px at the artboard and follows the tighter window axis. Then the
refinements a reader needs to trust it (bands, type roles, the ui unit and limits), how you adopt
it, and why it holds up.

Every scene is **animate IN → HOLD still → fade OUT** (`dur = in-end + hold + fade`, fade 15
frames; 21 on the last scene). Holds are sized to the text read aloud. Scenes play back to back (`<Series>`); each
starts and ends on the bare page background, so the loop seam (last frame → frame 0) is two
identical empty frames.

Every number on screen comes from `node skills/fluid-design/bin/fluid explain <W>x<H>` against
the pack's default config (`skills/fluid-design/assets/fluid.config.json`), or from the pack's
own text. The morphs in between are computed from the same formula
(`--fluid = max(0.58, min(W/1440, H/900))`, display `1 − 0.62·(1 − u)` below 1), so the ticking
readout lands exactly on the `explain` value at each hold.

The diagram vocabulary is one "mini page" drawn to scale inside a browser window: a header (logo,
nav), a hero with a real headline, copy bars and an accent button, and an illustration panel —
the page is laid out in drawn px and rendered with the unit, so what moves on screen is what the
engine does.

| # | Scene | What the viewer sees | Numbers (all from `fluid explain`) | In → hold → fade |
|---|---|---|---|---|
| 1 | **The problem** | "Drawn at 1440×900. Built in fixed px." Three windows of the same fixed-px page: 1280×800 (the illustration runs off the side — *cramped*), 2560×1440 (the page sits small in a sea of margin — *floating*), 1440×700 (the 900-tall hero runs 200px below the fold — *cut off*). | window sizes only | 2.5 s → 3.6 s → 0.5 s (6.6 s) |
| 2 | **The unit** | "Every drawn number becomes n × unit" · "The unit is 1px at the 1440×900 artboard." A window resizes 1440×900 → 1280×800 → 1920×1200 and the page inside scales as one piece. Readout ticks `--fluid 1.0000 → 0.8889 → 1.3333` and `padding 120 → calc(120 * var(--fluid)) = 120.0 → 106.7 → 160.0 px`. | 1440×900 1.0000 · 1280×800 0.8889 · 1920×1200 1.3333 | 1.5 s in, 1.2 s at each intermediate stop, morphs 1.0/1.3 s → 3.0 s → 0.5 s (9.8 s) |
| 3 | **The tighter axis wins** | `--fluid = min(W / 1440, H / 900)`. The window squeezes from 1440×900 to 1440×700; two ratio bars: W/1440 stays 1.000, H/900 drops to 0.778 and is marked *wins*. The 900-tall hero shrinks with it and still fits: `900 × 0.7778 = 700` ✓ — the same window that cut the hero off in scene 1. | 1440×700 → 0.7778 | 3.6 s (in + squeeze) → 3.6 s → 0.5 s (8.3 s) |
| 4 | **Bands** | "Each band scales its own artboard. The phone design is drawn once." Four devices at one scale: phone 390×844 (the 390 artboard), tablet 820×1180 (phone design, scaled up), landscape 844×390 (a phone on its side), desktop 1440×900 (the 1440×900 artboard); unit under each. | phone 1.0000 · tablet 1.1714 · landscape 1.0821 · desktop 1.0000 | 3.1 s → 3.6 s → 0.5 s (7.2 s) |
| 5 | **Type roles** | "Headings shrink more gently than the layout." At 1024×768, three bars against the 1.0 line: layout `--fluid 0.7111`, headings `--fluid-display 0.8209`, body `--fluid-copy 0.9047`. A 64 drawn px heading lands at 52.5px instead of 45.5px (ghost behind it). | 1024×768: 0.7111 / 0.8209 / 0.9047; 64 → 52.5 px | 2.5 s → 3.6 s → 0.5 s (6.6 s) |
| 6 | **The header has its own unit** | Two windows. 1440×700: the page shrinks (`--fluid 0.7778`) but the header does not (`--fluid-ui 1.0000`) — ui follows width, never height. 2560×1440 with `:root { --fluid-ui-grow-until: 1680; }`: the page keeps growing (`--fluid 1.6000`) while the header holds its 1680 size (`--fluid-ui 1.1667`). | 1440×700 ui 1.0000 · 2560×1440 (+ `--set --fluid-ui-grow-until=1680`) fluid 1.6000, ui 1.1667 | 2.7 s → 3.8 s → 0.5 s (7.0 s) |
| 7 | **Set up: `fluid init`** | A terminal: `$ fluid init`, the real questions with their defaults answered with Enter (styling, framework, desktop frame, phone frame, max width…), then the three ✓ lines it prints. | captured from a real `fluid init --interactive` run in a scratch Next + Tailwind v4 project | 3.4 s → 3.3 s → 0.5 s (7.2 s) |
| 8 | **Use it** | Three code cards: `globals.css` (the one `@import '../styles/fluid/fluid.css';` + a setting in `:root`), Tailwind (`class="fluid-py-48 lg:fluid-py-120"`), CSS (`padding-block: calc(120 * var(--fluid));`). Caption: "Write the drawn number. Settings are CSS variables — live, no rebuild." | real utilities / setting names from the pack | 2.3 s → 3.6 s → 0.5 s (6.4 s) |
| 9 | **Why it holds** | Three checks: pixel-exact at the artboard (`1440×900 → --fluid 1.0000`), proportional everywhere else, text still zooms 1:1 with the browser (WCAG 1.4.4). Footer: "18,840 engine checks · Chromium · WebKit · Firefox · 0 failures". Wordmark `/fluid-design`. Fades to the bare background → loops to scene 1. | 18,840 from the engine-matrix run recorded in docs/designs/FIX-PLAN-2026-09.md | 3.0 s → 3.5 s → 0.7 s (7.2 s) |

Total: 1987 frames = 66.2 s (the durations live in `src/scenes.tsx`; `Root.tsx` sums them).

Poster (frame 432): the final hold of scene 2 (the 1920×1200 window with `--fluid 1.3333` and the
`n × unit` headline) — the single frame that states the idea.
