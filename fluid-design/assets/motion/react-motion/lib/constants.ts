/**
 * The one breakpoint every primitive in this folder agrees on.
 *
 * Must match `fluid.config.json`'s `engageAt` and the host project's Tailwind
 * `lg` (or whatever token marks the same width). Three places, one number —
 * drift between them is exactly what produced duplicate `LG_QUERY` constants
 * in the reference build (`Stage.tsx`, `PullToCentre.tsx`), each hand-typed
 * from the same fact. Change it once, here.
 *
 * This is the DEFAULT (`engageAt: 1024`). Nothing here reads
 * `fluid.config.json`, so the moment a project's config sets a different
 * `engageAt`, this literal silently stops matching it. Run `node
 * scripts/generate-fluid.mjs --stack ts` and import `ENGAGE_PX`/
 * `ENGAGE_QUERY` from the generated `fluid.config.ts` instead, replacing
 * both constants below at this one file.
 */
export const ENGAGE_BREAKPOINT_PX = 1024

/** `matchMedia`-ready form of `ENGAGE_BREAKPOINT_PX`, for JS callers. */
export const ENGAGE_QUERY = `(min-width: ${ENGAGE_BREAKPOINT_PX}px)`
