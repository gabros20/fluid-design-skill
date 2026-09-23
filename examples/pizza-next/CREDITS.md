# Asset credits — Forno Aurelia (pizza-next)

## Generated

All food, mascot and ground-plate imagery generated with **gpt-image-2** (Codex CLI
`generate-image` skill) for this example, from prompts in `assets-src/specs/`:

- `images/hero-pizza-peel.{png,webp}`
- `images/pinsa-margherita.{png,webp}`
- `images/pinsa-diavola.{png,webp}`
- `images/pinsa-mortadella.{png,webp}`
- `images/pinsa-funghi.{png,webp}`
- `images/pinsa-crudo.{png,webp}`
- `images/pinsa-zucca.{png,webp}`
- `images/ing-basil.{png,webp}`
- `images/ing-tomatoes.{png,webp}`
- `images/ing-flour-scoop.{png,webp}`
- `images/mascot.{png,webp}`
- `assets-src/ground-flour.png` (video ground plate, not shipped to `public/`)

`videos/dough-desktop.mp4` / `videos/dough-mobile.mp4` and their posters are
rendered from `assets-src/ground-flour.png` and the raw alpha master of
`pinsa-margherita.png` by `assets-src/make-dough-video.py`, then encoded with
ffmpeg — no external footage.

## Web photos (Unsplash License — free to use, no attribution required; credited anyway)

| File | Photographer | Source |
|---|---|---|
| `images/photo-oven.webp` | Emily Powers | https://unsplash.com/photos/9xWl_zhIcS4 |
| `images/photo-dough-hands.webp` | Brad (@minimdesignco) | https://unsplash.com/photos/someone-is-stretching-pizza-dough-wZyxpSGwW0g |
| `images/photo-dining.webp` | Raymond Yeung | https://unsplash.com/photos/a-cozy-restaurant-interior-with-string-lights-Wzo_34cS5bA |
| `images/photo-served.webp` | Nadya Spetnitskaya | https://unsplash.com/photos/classic-pizza-on-table-z11dSXXlt8c |

## Web video (Pexels License — free to use, no attribution required; credited anyway)

| File | Videographer | Source |
|---|---|---|
| `videos/ambient-fire.mp4` + `images/ambient-fire-poster.jpg` | K (@kelly) | https://www.pexels.com/video/the-hot-flame-of-a-burning-fire-woods-4310185/ |

Re-encoded from the original 1920x1080 clip: 6s segment, scaled to 960px wide,
H.264, no audio, for web delivery.
