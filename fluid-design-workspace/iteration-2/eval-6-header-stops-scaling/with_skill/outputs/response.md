# Header stops growing past 1680, page content keeps scaling

## What changed

One line, in `src/app/globals.css`:

```css
:root {
  ...
  --fluid-ui-grow-until: 1680;
}
```

## Why this and not a class on `<header>`

Your header already draws its sizes from the `ui` type role (`SiteHeader.tsx` uses
`lg:fluid-ui-h-48`, `lg:fluid-ui-text-20`, `lg:fluid-ui-gap-32`, `lg:fluid-ui-text-14`), which
exists specifically for headers/nav/footers — it's damped separately from body copy so it doesn't
blow up on big screens.

`--fluid-ui-grow-until: 1680` caps only that role: past a 1680px-wide window, every `fluid-ui-*`
value freezes at the size it had at 1680, while `--fluid` (and the `display`/`copy` roles the rest
of the page uses) keeps growing normally. So the header/nav hold their 1680 size and the content
below keeps scaling on 2560 and 5K screens, exactly as asked.

The tempting alternative — putting a `fluid-grow-until-1680` (or `fluid-ui-grow-until-1680`) class
directly on the `<header>` element — was deliberately avoided. A limit class only scopes the
elements inside it, but the page also reads `--header-h` from `:root` (it's what
`pt-[var(--header-h)]` on the header and any anchor/scroll offsets use). A limit on `<header>`
would freeze the header's own contents while `--header-h` on `:root` kept growing unbounded, so the
page's top padding would drift away from the header's actual height. Setting the same variable on
`:root` instead keeps the header and `--header-h` reading from the same frozen `--fluid-ui`, so they
never drift apart. (`fluid check` specifically warns if a limit class is put on `<header>` for this
reason.)

## Verification

- `node .../fluid-design/bin/fluid check` — 0 errors (one pre-existing, unrelated warning about
  `src/lib/utils.ts`'s `cn` not wrapping `tailwind-merge` with `withFluid`; not touched by this
  change).
- `node .../fluid-design/bin/fluid audit src` — no findings.
- `fluid explain` at four window sizes confirms the split between the frozen header and the
  still-growing page:

  | window | `--fluid` (page) | `--fluid-ui` (header) |
  |---|---|---|
  | 1440×900 (artboard) | 1.0 | 1.0 |
  | 1680×945 | 1.05 | 1.05 |
  | 2560×1440 | 1.60 | **1.1667** (frozen — same as at 1680) |
  | 5120×2880 | 3.20 | **1.1667** (still frozen) |

  Above the 1680 threshold, `--fluid-ui` stops at 1680/1440 = 1.1667 and stays there no matter how
  wide the window gets, while `--fluid` keeps climbing — so the header/nav hold their 1680-window
  size and the rest of the page keeps scaling, which is the requested behaviour.

  (Dependencies aren't installed in this workspace, so I couldn't spin up `next dev` for a live
  `fluid verify`/browser check; the above is the CLI's offline model of the same generated CSS
  formulas, cross-checked by hand against `src/styles/fluid/fluid.css`'s `--fluid-ui`/`--header-h`
  rules.)

## One thing worth knowing

`--header-h` itself doesn't freeze quite as hard as `--fluid-ui` does: it's
`(--fluid-header-inset × --fluid) + safe-area-inset + (header row height × --fluid-ui)`. The header
row term is frozen (as above), but `--fluid-header-inset` — the breathing room *above* the header
bar — intentionally keeps scaling with the whole-page `--fluid`, not the capped `--fluid-ui`. That's
by design (it's page spacing, not part of the header itself), so on a 5K screen the header bar stays
1680-sized but sits with a bit more air above it. If you want the header's total footprint
(including that inset) to freeze completely too, that would need `--fluid-header-inset` set to a
fixed value instead, but nothing in the request asked for that, so I left it on the default.
