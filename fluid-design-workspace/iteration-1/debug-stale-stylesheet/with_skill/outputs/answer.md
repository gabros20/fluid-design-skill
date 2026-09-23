Nothing broke in `ScrubStage`. That exact pair — globals.css edit + server restart — is the signature of a stale stylesheet, not a scrub bug, per CLAUDE.md's own documented case.

**Why:** Next pushes CSS over the HMR socket. Restarting the server kills that socket, and a tab that was already open doesn't reliably re-fetch the new stylesheet — it keeps serving the old one from memory (Safari especially; a plain ⌘R can still render against cached CSS).

**Why it looks like a scrub bug:** the `fluid-*` classes are still in the HTML, but with no rules behind them:
- missing `lg:fluid-cap-1680` → video falls back to `max-w-none` → full-bleed, no gutters
- missing `lg:fluid-h-900` → the section gets `height: auto` → the pin has no scroll travel

Progress still runs 0→1, there's just almost no distance to spread it over — so it sits on frame one, then snaps to the last frame right at the bottom. `ScrubStage` itself is fine.

**Check it in one line**, in the console:
```js
getComputedStyle(document.documentElement).getPropertyValue('--fluid')
```
- `max(0.58px, min(calc(100svh / 900), calc(100vw / 1440)))` → stylesheet is fresh, the bug is real, keep debugging
- empty string, or an older/different form → confirmed stale, stop here

**Fix:** close the tab and open a new one (don't just reload). If that doesn't clear it:
```
rm -rf .next && pnpm dev
```
(Note: I didn't restart the server myself — that's yours to run per your own house rules. Restart it and open a fresh tab, then re-check `--fluid` before doing anything else.)

If the fresh tab still shows the same `--fluid` value as before and it's the correct/current form, then it's a genuine regression and worth looking at `ScrubStage` — but rule this out first; it's the far more common cause after touching `globals.css`.
