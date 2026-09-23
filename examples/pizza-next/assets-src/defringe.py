#!/usr/bin/env python3
"""Kill a faint dark chroma-key fringe ring around an alpha cutout.

Zeroes very-low alpha (residual key-color halo), erodes the remaining edge by
~1px to shave off any lingering tinted pixels, then feathers with a small
gaussian blur for clean antialiasing. In place on the given PNG.
"""
import sys
from PIL import Image, ImageFilter

def defringe(path, alpha_floor=60, erode_px=1, feather=0.6):
    im = Image.open(path).convert("RGBA")
    r, g, b, a = im.split()
    # kill faint residual halo
    a = a.point(lambda v: 0 if v < alpha_floor else v)
    # erode edge slightly to remove lingering tinted low-alpha ring
    if erode_px > 0:
        a = a.filter(ImageFilter.MinFilter(2 * erode_px + 1))
    # feather for smooth antialiasing
    if feather > 0:
        a = a.filter(ImageFilter.GaussianBlur(feather))
    out = Image.merge("RGBA", (r, g, b, a))
    out.save(path)
    print(f"defringed {path}")

if __name__ == "__main__":
    for p in sys.argv[1:]:
        defringe(p)
