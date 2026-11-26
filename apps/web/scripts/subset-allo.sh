#!/usr/bin/env bash
# Rebuilds src/fonts/allo-*.woff2 from the allo-font npm package.
# Needs fonttools with brotli: `pip install 'fonttools[woff]'`.
# Usage: scripts/subset-allo.sh [version]
#
# The shipped variable file is 291 KB because it carries the full Inter
# charset and the whole optical-size axis. Allo is only the display face here,
# so opsz is pinned to Display (32), weight is cut to the 400-900 the app uses,
# and the glyphs are split into the same latin / latin-ext unicode ranges
# fontsource uses. That leaves about 60 KB for latin. Allo's OFL has no
# Reserved Font Name, so modified builds can keep the name.
set -euo pipefail

VERSION="${1:-1.1.0}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/src/fonts"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

LATIN="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2190-2193,U+2212,U+2215,U+FEFF,U+FFFD"
LATIN_EXT="U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"

(cd "$TMP" && npm pack "allo-font@$VERSION" --silent >/dev/null && tar xzf ./*.tgz)
SRC="$TMP/package/fonts/webfonts"

python3 -I -m fontTools.varLib.instancer "$SRC/AlloVariableFriendly.woff2" \
  opsz=32 wght=400:900 -o "$TMP/display.ttf" -q

mkdir -p "$OUT"
rm -f "$OUT"/allo-*.woff2

subset() {
  pyftsubset "$1" --unicodes="$2" --layout-features='*' --flavor=woff2 \
    --output-file="$OUT/$3.woff2"
}

for range in latin latin-ext; do
  [[ $range == latin ]] && codes="$LATIN" || codes="$LATIN_EXT"
  subset "$TMP/display.ttf" "$codes" "allo-$range-wght-normal"
  for weight in 400:Oblique 500:MediumOblique 600:SemiBoldOblique \
    700:BoldOblique 800:ExtraBoldOblique 900:BlackOblique; do
    subset "$SRC/Allo-${weight#*:}.woff2" "$codes" \
      "allo-$range-${weight%%:*}-italic"
  done
done

cp "$TMP/package/OFL.txt" "$OUT/allo-OFL.txt"
ls -l "$OUT"
