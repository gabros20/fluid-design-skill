/**
 * The one breakpoint every primitive in this GSAP port agrees on. This file
 * is the SINGLE place the literal is declared for this stack — `stage.ts`,
 * `scrollPull.ts`, `scrubStage.ts` and `eases.ts` all import
 * `ENGAGE_PX`/`ENGAGE_QUERY` from here rather than each keeping its own
 * copy. Before this file existed `eases.ts` declared its own literal and
 * the other three imported it from there, which is a harder place to find
 * than a file named for exactly this job — and the shape invited a second,
 * silently-drifting copy the moment anyone reached for `1024` directly
 * instead of importing it.
 *
 * `1024` below is the shipped DEFAULT — `fluid.config.json`'s unmodified
 * `engageAt`. Nothing in this file reads the config, so the moment a
 * project's `engageAt` stops matching 1024 this constant silently stops
 * matching it too. **Replace the value below with the output of
 * `node scripts/generate-fluid.mjs --stack ts` for a non-default engageAt**
 * — that generated file exports the same two names (`ENGAGE_PX`,
 * `ENGAGE_QUERY`), so swapping this file's body for its output (or having
 * this one re-export from it) is the whole fix.
 */
export const ENGAGE_PX = 1024

/** `matchMedia`-ready form of ENGAGE_PX. */
export const ENGAGE_QUERY = `(min-width: ${ENGAGE_PX}px)`
