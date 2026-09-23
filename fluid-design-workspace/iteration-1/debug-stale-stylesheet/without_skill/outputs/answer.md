Nothing broke in `ScrubStage` — this is the stale-stylesheet symptom, not a scrub bug.

**Why it looks like a scrub bug.** Next dev pushes CSS over the HMR socket. Restarting the server kills that socket, and a tab you already had open doesn't reliably re-fetch the new stylesheet — it keeps the old one in memory (Safari is worst about this: a plain ⌘R can still serve the cached CSS). Since you edited `globals.css` and then restarted the server with a tab open, that's exactly the trigger pair.

With the old stylesheet, the `fluid-*` utility classes are still in the HTML but have no rules behind them:

- missing `lg:fluid-cap-1680` → the video falls back to `max-w-none` → full-bleed, no gutters
- missing `lg:fluid-h-900` → the sections get `height: auto` → the pin loses its scroll travel

So the scrub's progress is still running 0→1 correctly, there's just almost no distance to spread it over — hence it sits on frame one and then snaps to the tail near the bottom. `ScrubStage` itself isn't touching layout or frame math, so there's nothing to fix there.

**Confirm before doing anything else.** In devtools console:

```js
getComputedStyle(document.documentElement).getPropertyValue('--fluid')
```

- `max(0.58px, min(calc(100svh / 900), calc(100vw / 1440)))` → stylesheet is fresh, this isn't it, keep digging in the scrub code.
- empty string, or an older form like `clamp(..., 1px)` or `1500px / 900` → confirmed stale, stop here.

**Fix:** close the tab entirely and open a new one (don't just reload). If that doesn't clear it:

```
rm -rf .next && pnpm dev
```

Note: don't run that dev-server restart yourself if an agent is doing this for you — the dev server is yours to run. After any `globals.css` change, the habit is: restart the server, then open a fresh tab before judging what's on screen, since Tailwind v4 `@utility` rules only exist in a rebuilt stylesheet.
