#!/usr/bin/env python3
"""Render the scrub clip from one still: head loop, scrub band, tail loop.

    python3 scripts/make-scrub-video.py assets-src/pizza-table.jpg public/video/oven-scrub.mp4

The clip is built so its two loops are seamless BY CONSTRUCTION rather than
measured after the fact (video.md section 2 describes the measuring route
for a real render). 30 fps, 300 frames:

  frames   0..60   head: a periodic "breath" (period 60), frame 60 == frame 0
  frames  61..240  scrub: zoom 1.00 -> 1.55, rotate 0 -> -14 deg, smoothstep
  frames 240..299  tail: a periodic breath around the end pose (period 58),
                   frame 298 == frame 240

scrubStage.ts options that match (see src/main.ts):
  headLoop { fromFrame: 1, matchFrame: 61 }   frame[fromFrame-1] == frame[matchFrame-1]
  tailLoop { fromFrame: 241 }                 frame[240] == frame[298] (the wrap frame)

Encoded all-intra (`-g 1 -bf 0`, keyint=1) because this asset is scrubbed:
every seek must be a one-frame decode (video.md section 1).
"""
import math
import subprocess
import sys

from PIL import Image

W, H, FPS, N = 1280, 720, 30, 300
HEAD_P, TAIL_P = 60, 58
SCRUB_A, SCRUB_B = 60, 240
Z0, Z1 = 1.0, 1.55
A0, A1 = 0.0, -14.0
BREATH_Z, BREATH_A = 0.018, 0.8


def smoothstep(t: float) -> float:
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def pose(n: int) -> tuple[float, float]:
    if n <= SCRUB_A:
        ph = 2 * math.pi * n / HEAD_P
        return Z0 + BREATH_Z * (1 - math.cos(ph)) / 2, A0 + BREATH_A * math.sin(ph)
    if n <= SCRUB_B:
        k = smoothstep((n - SCRUB_A) / (SCRUB_B - SCRUB_A))
        return Z0 + (Z1 - Z0) * k, A0 + (A1 - A0) * k
    ph = 2 * math.pi * (n - SCRUB_B) / TAIL_P
    return Z1 + BREATH_Z * (1 - math.cos(ph)) / 2, A1 + BREATH_A * math.sin(ph)


def main() -> None:
    src, out = sys.argv[1], sys.argv[2]
    img = Image.open(src).convert('RGB')
    # Cover the output frame with margin so a rotated frame never shows a corner.
    base_scale = max(W / img.width, H / img.height) * 1.25
    base = img.resize((round(img.width * base_scale), round(img.height * base_scale)), Image.LANCZOS)
    # Subject point: the pizza's centre in the source still (normalised).
    sx, sy = 0.66, 0.52
    cx, cy = base.width * sx, base.height * sy

    ff = subprocess.Popen(
        [
            'ffmpeg', '-y', '-v', 'error',
            '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
            '-c:v', 'libx264', '-preset', 'slow', '-crf', '30',
            '-g', '1', '-bf', '0', '-x264-params', 'keyint=1:min-keyint=1:scenecut=0',
            '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out,
        ],
        stdin=subprocess.PIPE,
    )
    assert ff.stdin is not None
    for n in range(N):
        z, a = pose(n)
        # Inverse affine: output pixel (u, v) -> source pixel, rotating/zooming about the subject.
        r = math.radians(a)
        cos, sin = math.cos(r) / z, math.sin(r) / z
        ox, oy = W / 2, H / 2
        coeffs = (
            cos, sin, cx - cos * ox - sin * oy,
            -sin, cos, cy + sin * ox - cos * oy,
        )
        frame = base.transform((W, H), Image.AFFINE, coeffs, resample=Image.BICUBIC)
        ff.stdin.write(frame.tobytes())
    ff.stdin.close()
    sys.exit(ff.wait())


if __name__ == '__main__':
    main()
