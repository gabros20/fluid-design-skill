#!/bin/sh
# install.sh — the standalone `fluid` binary, for projects without Node.
#
#   curl -fsSL https://raw.githubusercontent.com/gabros20/fluid-design-skill/main/install.sh | sh
#
# Env: FLUID_VERSION=v2.0.0 (default: the latest release)
#      FLUID_INSTALL_DIR=/usr/local/bin (default: ~/.local/bin)
#      FLUID_DOWNLOAD_BASE=https://mirror/… (default: the GitHub release)
# Checks the download against the release's SHA256SUMS before installing.
# Projects with Node don't need this: npx fluid-design-cli@2 init
set -eu

REPO="gabros20/fluid-design-skill"
DIR="${FLUID_INSTALL_DIR:-$HOME/.local/bin}"

case "$(uname -s)" in
  Darwin) os=darwin ;;
  Linux) os=linux ;;
  *) echo "fluid: unsupported OS $(uname -s). On Windows, download fluid-windows-x64.exe from https://github.com/$REPO/releases (or run install.ps1)." >&2; exit 1 ;;
esac
case "$(uname -m)" in
  arm64 | aarch64) arch=arm64 ;;
  x86_64 | amd64) arch=x64 ;;
  *) echo "fluid: unsupported CPU $(uname -m)" >&2; exit 1 ;;
esac
# Rosetta: an arm64 Mac running this shell under x86_64 still wants the native binary.
if [ "$os" = darwin ] && [ "$arch" = x64 ] && [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || echo 0)" = 1 ]; then arch=arm64; fi

asset="fluid-$os-$arch"
if [ -n "${FLUID_DOWNLOAD_BASE:-}" ]; then base="$FLUID_DOWNLOAD_BASE"; elif [ -n "${FLUID_VERSION:-}" ]; then base="https://github.com/$REPO/releases/download/$FLUID_VERSION"; else base="https://github.com/$REPO/releases/latest/download"; fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
echo "fluid: downloading $asset ${FLUID_VERSION:-(latest)}"
curl -fsSL "$base/$asset" -o "$tmp/$asset"
curl -fsSL "$base/SHA256SUMS" -o "$tmp/SHA256SUMS"

expected="$(grep " $asset\$" "$tmp/SHA256SUMS" | cut -d' ' -f1)"
if command -v sha256sum >/dev/null 2>&1; then actual="$(sha256sum "$tmp/$asset" | cut -d' ' -f1)"; else actual="$(shasum -a 256 "$tmp/$asset" | cut -d' ' -f1)"; fi
if [ -z "$expected" ] || [ "$expected" != "$actual" ]; then
  echo "fluid: checksum mismatch for $asset (expected ${expected:-nothing}, got $actual). Not installing." >&2
  exit 1
fi

mkdir -p "$DIR"
mv "$tmp/$asset" "$DIR/fluid"
chmod +x "$DIR/fluid"
echo "fluid: installed $("$DIR/fluid" --version) to $DIR/fluid"
case ":$PATH:" in
  *":$DIR:"*) ;;
  *) echo "fluid: $DIR is not on your PATH. Add it:  export PATH=\"$DIR:\$PATH\"" ;;
esac
echo "Next, in your project:  fluid init"
