#!/bin/sh
# Refresh the live demo's engine from the shipped pack. The two files are the
# generator's CSS-stack output at the defaults (skills/fluid-design/assets/styles/css/),
# copied byte-for-byte; never edit them here. Run from anywhere after `npm run generate`.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
src="$here/../../skills/fluid-design/assets/styles/css"
cp "$src/fluid.css" "$src/base.css" "$here/engine/"
grep -o -- '--fluid-build: "[^"]*"' "$here/engine/fluid.css" | head -1
