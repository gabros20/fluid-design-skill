# Dough scrub video — notes (lead-7)

Source: `make-dough-video.py` renders a 1920² master (270 frames, 30fps) from
`ground-flour.png` (softened, see the script) and `raw/pinsa-margherita.png`.

pose(f): angle = 0.5° + 2.5°·sin(2πf/60) + 90°·S(f); zoom = 1 + 0.015·sin(2πf/60) + 0.2·S(f);
S = smoothstep((f−60)/149). Frames 0–60 and 209–269 are exactly periodic.

ScrubStage config: `fps 30`, `headLoop { fromFrame: 0, matchFrame: 60 }`, `tailLoop { fromFrame: 210 }`.

## Tiers (all-intra)

| File | Crop of master | Size | Bytes |
|---|---|---|---|
| `public/videos/dough-desktop.mp4` | `crop=1920:900:0:510` → 1440×676 | 2.13:1 | 8,995,720 |
| `public/videos/dough-mobile.mp4` | `crop=1080:1920:420:0` → 720×1280 | 9:16 | 8,107,614 |

```
ffmpeg -framerate 30 -i frames/%04d.png -vf "crop=…,scale=…:flags=lanczos,format=yuv420p" \
  -c:v libx264 -preset slow -tune film -crf 33 -g 1 -bf 0 \
  -x264-params "keyint=1:min-keyint=1:scenecut=0:qcomp=1" -movflags +faststart -an OUT.mp4
```

Every frame is a keyframe (ffprobe: 270 × key_frame=1 on both tiers). Posters are frame 0 of the
ENCODED files (`public/images/dough-poster-{desktop,mobile}.jpg`).

## Findings on the way

1. **PIL's `rotate()` skips resampling at exact multiples of 90°**, so frames whose sway term was
   exactly 0 came out sharper than their neighbours. Fixed with a constant 0.5° tilt.
2. **CRF rate control does not encode identical frames identically, even all-intra.** With the
   masters for frames 0/30/60 byte-identical, CRF 27 decoded them at 31.8 dB against each other
   (frame 0 got more bits: 35.1 dB vs the master where frame 60 got 30.8). That is a visible
   sharpness pop at every head-loop wrap. `qcomp=1` (constant quality, no complexity blur across
   frames) makes identical inputs decode identically; CRF raised to 33 to hold the size.
3. Unsoftened slate cost 37 MB at CRF 22 (1600×900): all-intra re-pays the flour speckle every frame.

## Seams, measured on the encoded files
    desktop: 270 frames
       60 vs   0:  identical   head seam (match vs fromFrame)
       59 vs   0:   29.75 dB   neighbour
       61 vs   0:   29.94 dB   neighbour
        0 vs  15:   21.71 dB   loop moves
      269 vs 209:  identical   tail seam (last vs fromFrame-1)
      268 vs 209:   28.95 dB   neighbour
      210 vs 225:   20.52 dB   loop moves
      head motion floor MAD 3.343; seam MAD(60,0) 0.000
      tail motion floor MAD 4.019; seam MAD(269,209) 0.000
      { at: 0, t: '#484849', b: '#464546' },
      { at: 0.25, t: '#484849', b: '#464546' },
      { at: 0.5, t: '#494949', b: '#474547' },
      { at: 0.75, t: '#534b47', b: '#564b48' },
      { at: 1, t: '#594d47', b: '#5d4e48' },
    mobile: 270 frames
       60 vs   0:  identical   head seam (match vs fromFrame)
       59 vs   0:   30.55 dB   neighbour
       61 vs   0:   30.85 dB   neighbour
        0 vs  15:   22.56 dB   loop moves
      269 vs 209:  identical   tail seam (last vs fromFrame-1)
      268 vs 209:   29.63 dB   neighbour
      210 vs 225:   21.17 dB   loop moves
      head motion floor MAD 2.990; seam MAD(60,0) 0.000
      tail motion floor MAD 3.548; seam MAD(269,209) 0.000

The backdrop stops (desktop, top/bottom tenth at scrub progress 0…1) are in DoughScene.tsx.
