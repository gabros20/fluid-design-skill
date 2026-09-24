# Fix: shadcn `cn` didn't know the fluid utilities

## Root cause

`src/lib/utils.ts` (shadcn's stock helper) built its own `twMerge` straight from
the `tailwind-merge` package:

```ts
import { twMerge } from 'tailwind-merge'
```

`tailwind-merge` only knows Tailwind's own class groups. It has no idea that
`lg:fluid-px-40` and `lg:fluid-px-24` are both "padding-x" — to it they're two
unrelated arbitrary class names — so when `Button`'s `cva` base
(`lg:fluid-px-40`) and a caller's `className` (`lg:fluid-px-24`) both flow
through `cn()`, neither gets dropped. Both classes ship in the `class`
attribute, and which one wins becomes a stylesheet-order coin flip instead of
"the caller's className wins," which is what everyone calling `cn` assumes.

This is exactly the failure mode `fluid-design`'s `references` warn about: a
project's own `cn` has to be taught the fluid class groups, or two fluid
classes for the same property both survive.

## Fix

`src/lib/utils.ts` — kept the file and its callers (nothing importing `cn`
changed), and changed only how it builds `twMerge`, per the skill's
"already have a `cn`" path:

```ts
import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'
import { withFluid } from '@/styles/fluid/cn'

const twMerge = extendTailwindMerge(withFluid)

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

`withFluid` (generated into `src/styles/fluid/cn.ts` by `fluid init`/`fluid
generate` — not hand-edited) is a `tailwind-merge` plugin that registers every
`fluid-*` family into the Tailwind class group its property already belongs
to: `fluid-px`/`fluid-ui-px` join `px`, `fluid-text`/`fluid-display`/etc. join
`font-size`, and so on. Once `px` knows about `fluid-px`, `twMerge` treats
`lg:fluid-px-40` and `lg:fluid-px-24` as the same group and keeps only the
last one — so `<Button className="lg:fluid-px-24">` now correctly overrides
the component's own `lg:fluid-px-40` instead of shipping alongside it.

No second `cn` was added, and nothing in `src/styles/fluid/` was touched
(that folder is generated and `fluid generate` refuses to overwrite
hand-edits to it anyway).

## Verification

Dependencies aren't installed in this workspace, so this was verified with
the skill's own static tooling rather than a build:

1. **Reproduced the warning against the original file.** Temporarily
   restored the broken `utils.ts` (plain `twMerge` import) and ran:

   ```
   node <skill>/bin/fluid check
   ```

   Output:
   ```
   ! src/lib/utils.ts builds a tailwind-merge without withFluid:
     cn('lg:fluid-p-40', 'lg:fluid-p-24') keeps both there. Add the plugin:
     extendTailwindMerge(withFluid) (import { withFluid } from the generated
     cn.ts), or use the generated cn.
   OK (1 warning(s))
   ```

   This is the exact bug described in the task (`Button`'s
   `lg:fluid-px-40` + a caller's `lg:fluid-px-24` on `<Button
   className="lg:fluid-px-24">` in `src/app/page.tsx`, which is the live
   repro already in this project).

2. **Re-ran `fluid check` and `fluid audit src` against the fixed file:**

   ```
   ✓ generated files match fluid.config.json
   ✓ settings: nothing to flag
   OK
   audit: no findings.
   ```

   The warning is gone and nothing else regressed.

3. Confirmed by reading `src/components/ui/button.tsx` and `src/app/page.tsx`
   that the fix covers the project's actual usage: `Button` has
   `lg:fluid-px-40` baked into its `cva` base, and `page.tsx` renders
   `<Button className="lg:fluid-px-24">Start</Button>` — the pair now
   resolves through the same `px` class group, so only `lg:fluid-px-24`
   ships.

I did not run a real browser/build check (no `node_modules`, and installing
was out of scope for this task) — `fluid check`/`fluid audit` are the
project's own static verification for precisely this failure mode and are
what the skill's workflow calls for at this step.

## Files changed

- `src/lib/utils.ts` — build `twMerge` via `extendTailwindMerge(withFluid)`
  instead of importing the bare `twMerge`.
