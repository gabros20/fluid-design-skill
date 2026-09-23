#!/usr/bin/env python3
"""Trim, resize and export raw generated PNGs to public/images/.

Usage: python3 optimize.py <name> <max_long_edge> [--opaque]
Reads assets-src/raw/<name>.png (or assets-src/<name>.png for opaque),
writes public/images/<name>.png (+ .webp via cwebp, unless --opaque then
plain cwebp lossy no alpha).
"""
import subprocess
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets-src" / "raw"
SRC_ROOT = ROOT / "assets-src"
OUT = ROOT / "public" / "images"
OUT.mkdir(parents=True, exist_ok=True)

PAD_FRAC = 0.02


def trim_alpha(im: Image.Image, pad_frac: float = PAD_FRAC) -> Image.Image:
    alpha = im.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        return im
    l, t, r, b = bbox
    w, h = r - l, b - t
    pad_x = round(w * pad_frac)
    pad_y = round(h * pad_frac)
    l = max(0, l - pad_x)
    t = max(0, t - pad_y)
    r = min(im.width, r + pad_x)
    b = min(im.height, b + pad_y)
    return im.crop((l, t, r, b))


def resize_long_edge(im: Image.Image, max_edge: int) -> Image.Image:
    long_edge = max(im.size)
    if long_edge <= max_edge:
        return im
    scale = max_edge / long_edge
    new_size = (round(im.width * scale), round(im.height * scale))
    return im.resize(new_size, Image.LANCZOS)


def process_alpha(name: str, max_edge: int):
    src = RAW / f"{name}.png"
    im = Image.open(src).convert("RGBA")
    im = trim_alpha(im)
    im = resize_long_edge(im, max_edge)
    out_png = OUT / f"{name}.png"
    im.save(out_png, optimize=True)
    out_webp = OUT / f"{name}.webp"
    subprocess.run(
        ["cwebp", "-q", "82", "-alpha_q", "90", str(out_png), "-o", str(out_webp)],
        check=True, capture_output=True,
    )
    print(f"{name}: {im.width}x{im.height} -> {out_png.stat().st_size}B png, {out_webp.stat().st_size}B webp")


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return
    name = args[0]
    max_edge = int(args[1]) if len(args) > 1 else 1600
    process_alpha(name, max_edge)


if __name__ == "__main__":
    main()
