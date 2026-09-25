# site — fluid-design's visual guide

Deploys to <https://fluid-design-skill.vercel.app> (`vercel.json` at the repo root serves this folder).
Static: vanilla HTML/CSS/JS, no build step. Shared family chrome (type, spacing, `:root` tokens,
hero terminal, "Start here", footer, favicon and og composition); this skill's accent triple is
`#796100 #f2cf3b 95`, mirrored in `remotion/src/theme.ts`.

## Files

| File | What |
|---|---|
| `index.html` | the page. Sections: the idea → the unit → try it live → bands → type → limits → structure vs settings → the CLI → stacks → proof → references → start → boundary |
| `demo/index.html` | the page framed by `#live`: drawn at 1440×900 and 390, written only as drawn number × unit. It posts its live units to the parent (read from the engine's registered `--_fluid-m-*` mirrors) |
| `demo/engine/` | `fluid.css` + `base.css`, byte-for-byte copies of `skills/fluid-design/assets/styles/css/`. Never edit; run `demo/refresh-engine.sh` after `npm run generate` |
| `assets/hero-{light,dark}.mp4`, `-poster.png` | the Remotion hero (`../remotion/`). The page falls back video → poster → the static CSS diagram in `.poster` |
| `og-source.html` → `og.png` | render at 1200×630 with Playwright (below) |
| `favicon.svg`, `llms.txt`, `sitemap.xml`, `robots.txt` | production URL throughout |

## Keep true

- Every number on the page came from the pack. The `fluid explain` column in `#live` (the `CLI`
  table in the page script) and the unit table in `#unit` are `node skills/fluid-design/bin/fluid
  explain <W>x<H> --config skills/fluid-design/assets/fluid.config.json`; re-run them when a
  default changes. The damping and limits charts are plotted from the engine's formula at the
  defaults (knee = 1024 / 1440). The proof numbers are `npm run test:browsers` output.
- After a generator change: `demo/refresh-engine.sh`, then check a preset in `#live` turns green.

## Local preview and checks

```bash
cd site && python3 -m http.server 4391            # any free port
cd examples/pizza-next                            # has Playwright
node -e "import('playwright').then(async({chromium})=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:630}});await p.goto('http://127.0.0.1:4391/og-source.html');await p.screenshot({path:'../../site/og.png'});await b.close()})"
```

## Deploy

Vercel CLI from the repo root. Re-point the canonical alias after every `vercel --prod`
(`vercel alias set <deployment-url> fluid-design-skill.vercel.app`) and compare bytes, not a 200.
