#!/usr/bin/env python3
"""Render the 1920x1920 master frame sequence for the scrub-driven dough video.

frames/%04d.png, 30fps, 270 frames (0..269):
  - ground: ground-flour.png scaled to cover 1920x1920, fixed with a slight zoom
    tied to the same zoom curve x0.3.
  - subject: raw pinsa-margherita.png (full-res alpha master), centred, width ~1150px
    at zoom 1, soft blurred drop shadow offset (18, 24)px, opacity .55.
  - pose(f): angle(f) = 2.5*sin(2*pi*f/60) + R*S(f)
             zoom(f)  = 1 + 0.015*sin(2*pi*f/60) + Z*S(f)
             S(f) = smoothstep((f-60)/149) clamped to [0,1]  (0 for f<=60, 1 for f>=209)
             R = 90 deg, Z = 0.2 (subject width 820)
"""
import math
from pathlib import Path
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent
FRAMES_DIR = ROOT / "frames"
FRAMES_DIR.mkdir(exist_ok=True)

CANVAS = 1920
N_FRAMES = 270
SUBJECT_W0 = 820  # lead-7: leaves room for copy beside the subject at both ends
SHADOW_OFFSET = (18, 24)
SHADOW_OPACITY = 0.55
R_DEG = 90.0  # lead-7: horizontal oval at the head, vertical at the tail
Z_AMT = 0.2  # lead-7: a gentle push-in; the camera does the rest


def smoothstep(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def pose(f: int):
    s = smoothstep((f - 60) / 149)
    # lead-7: +0.5 deg constant tilt. PIL's rotate() skips resampling when the
    # angle is an exact multiple of 90, so frames 0/30 (sin = 0 exactly) came out
    # SHARPER than their neighbours: measured PSNR(60 vs 0) = 31.9 dB where the
    # poses are identical. With the offset every frame goes through the same
    # bicubic resample and the head seam is pixel-identical.
    angle = 0.5 + 2.5 * math.sin(2 * math.pi * f / 60) + R_DEG * s
    zoom = 1.0 + 0.015 * math.sin(2 * math.pi * f / 60) + Z_AMT * s
    return angle, zoom, s


def load_ground(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGB")
    # scale to cover CANVAS x CANVAS (square source, should already be square)
    scale = CANVAS / min(im.size)
    new_size = (round(im.width * scale), round(im.height * scale))
    im = im.resize(new_size, Image.LANCZOS)
    # centre-crop to CANVAS x CANVAS
    left = (im.width - CANVAS) // 2
    top = (im.height - CANVAS) // 2
    im = im.crop((left, top, left + CANVAS, top + CANVAS))
    # lead-7: soften the slate. Under ALL-INTRA every frame pays for the flour
    # speckle again (37 MB at CRF 22 unsoftened); a shallow-focus ground behind
    # the copy acts reads better anyway, and the subject stays sharp.
    im = im.filter(ImageFilter.GaussianBlur(radius=3.5))
    return im


def make_shadow(subject_rgba: Image.Image) -> Image.Image:
    alpha = subject_rgba.getchannel("A")
    shadow = Image.new("RGBA", subject_rgba.size, (0, 0, 0, 0))
    black = Image.new("RGBA", subject_rgba.size, (10, 8, 6, 255))
    shadow = Image.composite(black, shadow, alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=max(6, subject_rgba.width * 0.018)))
    # scale opacity
    r, g, b, a = shadow.split()
    a = a.point(lambda v: int(v * SHADOW_OPACITY))
    shadow = Image.merge("RGBA", (r, g, b, a))
    return shadow


def main():
    ground_src = ROOT / "ground-flour.png"
    subject_src = ROOT / "raw" / "pinsa-margherita.png"
    if not subject_src.exists():
        # fall back to the trimmed/served asset if raw isn't present
        alt = ROOT.parent / "public" / "images" / "pinsa-margherita.png"
        if alt.exists():
            subject_src = alt
        else:
            raise SystemExit(f"subject not found: {subject_src}")

    ground_base = load_ground(ground_src)
    subject_raw = Image.open(subject_src).convert("RGBA")

    # pre-scale subject to SUBJECT_W0 baseline once (zoom applied per-frame after)
    base_scale = SUBJECT_W0 / subject_raw.width
    base_h = round(subject_raw.height * base_scale)
    subject_base = subject_raw.resize((SUBJECT_W0, base_h), Image.LANCZOS)

    for f in range(N_FRAMES):
        angle, zoom, s = pose(f)

        # ground: very slight zoom tied to zoom curve x0.3
        ground_zoom = 1.0 + (zoom - 1.0) * 0.3
        gw = round(CANVAS * ground_zoom)
        gh = round(CANVAS * ground_zoom)
        ground_f = ground_base.resize((gw, gh), Image.LANCZOS)
        gl = (gw - CANVAS) // 2
        gt = (gh - CANVAS) // 2
        ground_f = ground_f.crop((gl, gt, gl + CANVAS, gt + CANVAS))
        canvas = ground_f.convert("RGBA")

        # subject: scale by zoom, rotate by angle
        sw = round(SUBJECT_W0 * zoom)
        sh = round(base_h * zoom)
        subj = subject_base.resize((sw, sh), Image.BICUBIC)
        subj = subj.rotate(angle, resample=Image.BICUBIC, expand=True)

        shadow = make_shadow(subj)

        cx, cy = CANVAS // 2, CANVAS // 2

        # paste shadow first (offset)
        shx = cx - shadow.width // 2 + SHADOW_OFFSET[0]
        shy = cy - shadow.height // 2 + SHADOW_OFFSET[1]
        canvas.alpha_composite(shadow, (shx, shy))

        # paste subject
        sx = cx - subj.width // 2
        sy = cy - subj.height // 2
        canvas.alpha_composite(subj, (sx, sy))

        out = canvas.convert("RGB")
        out.save(FRAMES_DIR / f"{f:04d}.png")

        if f % 30 == 0:
            print(f"frame {f:04d}: angle={angle:.2f} zoom={zoom:.3f} s={s:.3f}")

    print(f"done: {N_FRAMES} frames in {FRAMES_DIR}")


if __name__ == "__main__":
    main()
