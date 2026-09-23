# Asset checklist — Forno Aurelia (pizza-next)

Written before production. Every raster lands in `public/images/`, every video in
`public/videos/`; generation masters and specs live in `assets-src/` (not served).
Names are stable so the sibling Vite + GSAP build can copy them as-is.

## Shared style block (reused verbatim in every generated food prompt)

> Overhead top-down product photograph, camera exactly 90 degrees above, soft warm
> diffused daylight from the upper left, gentle natural contact shadow, colour
> temperature about 4800K, true-to-life colours, crisp focus edge to edge,
> editorial food photography, isolated subject, fully transparent background,
> no plate, no table, no text, no watermark.

## Generated (codex gpt-image-2 via `generate-image/scripts/gen-image.sh`)

| File | What | Alpha | Used in |
|---|---|---|---|
| `images/hero-pizza-peel.{png,webp}` | oval pinsa margherita on a long wooden peel, handle toward lower right | yes | Hero |
| `images/pinsa-margherita.{png,webp}` | oval pinsa, tomato, fior di latte, basil | yes | Menu, video subject |
| `images/pinsa-diavola.{png,webp}` | tomato, spicy salame, fior di latte, chili | yes | Menu |
| `images/pinsa-mortadella.{png,webp}` | mortadella, stracciatella, crushed pistachio | yes | Menu |
| `images/pinsa-funghi.{png,webp}` | white base, mixed mushrooms, truffle shavings | yes | Menu |
| `images/pinsa-crudo.{png,webp}` | prosciutto crudo, rocket, parmesan shavings, cherry tomato | yes | Menu |
| `images/pinsa-zucca.{png,webp}` | pumpkin cream, sausage crumble, sage, scamorza | yes | Menu |
| `images/ing-basil.{png,webp}` | basil sprig | yes | Craft numbers decoration |
| `images/ing-tomatoes.{png,webp}` | cherry tomatoes on the vine | yes | Craft numbers decoration |
| `images/ing-flour-scoop.{png,webp}` | wooden scoop of flour | yes | Craft numbers decoration |
| `images/mascot.png` | flat line chef face, checkered scarf | yes | Header logo |
| `assets-src/ground-flour.png` | dark slate, light flour dusting, top-down, square, no objects | no | Video ground plate |

## Video (built from the stills, ffmpeg)

| File | Spec |
|---|---|
| `videos/dough-desktop.mp4` | 1600×900, 30fps, 270 frames (9s), ALL-INTRA (`-g 1 -bf 0`, keyint=1), CRF ~22, no audio, faststart |
| `videos/dough-mobile.mp4` | 720×1280 portrait crop of the same square master, same timing, all-intra |
| `images/dough-poster-desktop.jpg`, `images/dough-poster-mobile.jpg` | frame 0 extracted FROM THE ENCODED mp4s |

Timeline (fps 30): frames 0–60 head loop (periodic sway, pose(60) = pose(0)) →
headLoop `{ fromFrame: 0, matchFrame: 60 }`; 60–209 scrub band (rotation + zoom-in on
smoothstep); 209–269 tail loop (periodic, pose(209) = pose(269)) → tailLoop `{ fromFrame: 210 }`.
Seams verified by PSNR (see `assets-src/VIDEO-NOTES.md`).

## Web-sourced (Unsplash / Pexels only; credits in `CREDITS.md`)

| File | Subject |
|---|---|
| `images/photo-oven.webp` | wood-fired oven with flame |
| `images/photo-dough-hands.webp` | hands stretching dough, flour |
| `images/photo-dining.webp` | warm restaurant interior / table |
| `images/photo-served.webp` | pizza served on a table (optional 4th) |
| `videos/ambient-fire.mp4` (optional) | Pexels flame loop, conventional GOP, ≤ 2 MB; falls back to a still |

## Optimisation

- Alpha cut-outs: PNG master trimmed to content, longest edge ≤ 1600 (menu ≤ 1000), plus
  lossy webp with alpha (`cwebp -q 82 -alpha_q 90`). Pages use `next/image`.
- Photos: webp, longest edge 1800, q 78.
- SVG: none shipped as `<img>`; the wordmark is live type.
