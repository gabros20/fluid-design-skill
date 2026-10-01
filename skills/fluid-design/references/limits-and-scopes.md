# One scale: scopes and limits

Purpose: Why the page keeps one scale (no section re-anchors it), how a **scope** gives part of the
page its own settings, and how a **limit** stops part of the page scaling past or below a window
width.

Read when: a section is drawn taller than the design frame, a part should stop growing or
shrinking, one part needs different settings, or the header should stop growing on big screens.
Skip when: you are tuning the whole page (set the setting on `:root`; `fluid-scale.md` §6).
Inputs: the section or component, the window width where it should stop, the setting it needs.
Produces: a limit utility, a scope, or the drawing change that replaces a re-anchor.

## Contents
1. Why sections may not re-anchor the scale, and what a scope is
2. Limits: "this part stops scaling at a window width"
3. Traps

## 1. Why sections may not re-anchor the scale, and what a scope is

The tempting fix for a section drawn taller than 900 (1198, 987, 973 on the reference build) is to
make its own height the reference, so `1198 × --fluid = 100svh` there. It was built
(`fluid-frame-N`), it worked, and **it was removed**:

- **Re-basing only `--fluid` leaves the type behind.** Custom properties resolve `var()` where they
  are *declared*, so `--fluid-display` still resolves against `:root` (measured: `--fluid` 0.5 on the
  section, `--fluid-display` still 0.862).
- **A scope fixes the mechanics, not the problem.** Put class `fluid-scope` on an element and set any
  `--fluid-*` **setting** on it (`<section class="fluid-scope" style="--fluid-desktop-container-width: 1200">`).
  The formula block is written on `:root, .fluid-scope`, so every unit recomputes together inside.
  That is the supported way to give one part a different container, damping or `scale-min`. It does
  not make a per-section reference height a good idea: the site-wide promise (one proportional
  factor for the whole page) is what that breaks, and two sections would size the same drawn number
  differently for no reason a reader can name. That, not the mechanics, is why `fluid-frame-N` went.
- **Never declare a unit directly**, scope or not. `--fluid: 0.5` replaces the engine's formula (no
  min, no max, no relation to the other units); `fluid check` warns.
- **Settings apply only on `:root` or a scope.** A scope is an element with class `fluid-scope`,
  attribute `data-fluid-scope`, a limit utility (any variant or important form: `lg:fluid-off`,
  `fluid-off!`, `!fluid-off`), or a Tailwind arbitrary property setting a fluid setting
  (`[--fluid-grow-until:1680]`). A `*:` or `[&_…]:` variant on a limit does **not** make children
  scopes (audit rule `limit-on-children`). A setting inside a media query or on any other selector
  does nothing or never applies; `fluid check --verbose` notes both.

## 2. Limits: "this part stops scaling at a window width"

The everyday reason to scope is a **limit**: a header that stops growing past a 1680 window, a panel
that never shrinks below its 1280 size, a widget that does not scale. One utility makes the element
a scope and sets the limit; every `fluid-*` class inside follows:

| Utility (Tailwind) | Setting it writes | Inside the element |
|---|---|---|
| `fluid-grow-until-1680` | `--fluid-grow-until: 1680` | units keep the size they had at a 1680 window |
| `fluid-shrink-until-1280` | `--fluid-shrink-until: 1280` | units never go below their size at a 1280 window |
| `fluid-ui-grow-until-1680` | `--fluid-ui-grow-until: 1680` | only `--fluid-ui` stops growing |
| `fluid-off` | `--fluid-off: 1` | nothing scales: one drawn px is one CSS px (browser zoom still works) |

- **Widths are window widths**, like breakpoints; the engine divides by the band's base width.
- **A limit applies in the band containing its width.** `fluid-grow-until-1680` changes only
  desktop; `fluid-grow-until-430` only the phone band. The band test is plain arithmetic (1 when
  `lo <= W < hi`), still with no `clamp()`, `sign()` or `round()`.
- **They compose.** `lg:fluid-grow-until-1680` limits only from `lg`; the innermost limit wins;
  `fluid-off` beats a limit on the same element; `fluid-shrink-until` floors `--fluid-ui` too.
- **They are settings.** On `:root` (`--fluid-grow-until: 1920` stops the whole site) or any scope.
  SCSS: `@include fd.fluid-grow-until(1680)`. CSS / StyleX: `data-fluid-scope` plus the setting.
- **The header trap.** A limit on `<header>` limits the header, but the page reads
  `--fluid-header-h` on `:root` (anchor offsets, hero padding), so the two drift apart above the
  limit. Use `:root { --fluid-ui-grow-until: 1680; }`: the header spends `--fluid-ui` and
  `--fluid-header-h` is built from it. `fluid check` warns (audit rule `header-limit`).
- **`shrink-until` overrides fit-height**: a one-screen section inside it can outgrow a short window.
  Use it on components, not on one-screen sections.
- **Script.** `fluidPx(n, unit, el)` reads the unit at an element, limits included: each unit is
  mirrored as a registered, non-inherited length on `:root` and every scope, and the call walks up to
  the nearest (`performance.md` §1 has why they don't inherit). Without `@property` (Firefox < 128,
  Safari < 16.4) it falls back to the page's units.

Verified in the repository: `tests/engine-matrix.mjs` (every limit against the model in Chromium,
WebKit and Firefox) and `tests/tailwind-compile.mjs`.

So a section drawn taller than the design frame **is** more than one screen, a faithful copy of the
drawing. Making it fit is a drawing job: take the room out of its padding (622 of one 1198-tall
section was whitespace). A second sizing ladder inside a section (a width-only `--stage` variable
with `xl:` rules) is the same mistake and must go.

## 3. Traps

- Declaring a unit (`--fluid: 0.5`) on a section instead of a setting on a scope: it replaces the
  formula, with no minimum, no maximum and no relation to the other units. `fluid check` warns.
- A setting inside a media query or on a selector that is not `:root` or a scope: it does nothing or
  never applies. `fluid check --verbose` notes both.
- A limit behind `*:` or `[&_…]:`: children are not scopes (audit rule `limit-on-children`).
- A limit on `<header>`: use `:root { --fluid-ui-grow-until: 1680; }` (audit rule `header-limit`).
- `fluid-shrink-until` on a one-screen section: it can outgrow a short window.
