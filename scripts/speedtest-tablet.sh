#!/bin/bash
# Molasses short — ONE-frame speed test on the tablet (Termux).
# Run AFTER bash scripts/setup-tablet.sh, BEFORE the full render:
#   bash scripts/speedtest-tablet.sh
#
# Renders a single 2K still (frame 100, a representative 3D shot) and
# times it. Multiply the seconds-per-frame by 2010 to estimate the
# full render. On the VM one 2K frame took ~30 s (~17 h total).
#
# EXPECT IT TO FEEL SLOW THE FIRST TIME: bundling (~1-2 min) plus the
# first frame loading + compiling shaders (~2 min) happen before any
# frame renders. If nothing seems to happen for ~3-4 minutes, that is
# normal — do not stop it. The `time` output at the end is the number
# that matters: total seconds for this one frame, bundling included.
# A second run right after is much faster (bundling is cached).
set -e
cd "$(dirname "$0")/.."
export TMPDIR="$PWD/remotion-tmp"
export REMOTION_TMP="$PWD/remotion-tmp"
export TEMP="$PWD/remotion-tmp"
export TMP="$PWD/remotion-tmp"
mkdir -p "$TMPDIR" out/speedtest

CHROME="$(command -v chromium-browser || command -v chromium || true)"
if [ -z "$CHROME" ]; then
  echo "ERROR: no chromium found. Run: pkg install tur-repo && pkg install chromium" >&2
  exit 1
fi
echo "chromium: $CHROME"
echo "Rendering ONE 2K still (frame 100) — first run takes ~3-4 min (bundling + shader compile), that is normal."
time npx remotion still src/index.ts MolassesShort out/speedtest/molasses-f100.jpg \
  --frame=100 --scale=1.3333333333333333 \
  --browser-executable="$CHROME" \
  --binaries-location="/data/data/com.termux/files/usr/bin" \
  --gl=swangle --image-format=jpeg --timeout=600000 --overwrite
ls -lh out/speedtest/molasses-f100.jpg
echo ""
echo "If the still looks right (open it and check the picture is there),"
echo "start the full render: termux-wake-lock && bash scripts/render-molasses-tablet.sh"
echo "If it crashed on mount instead, try --gl=swiftshader for the still:"
echo "  npx remotion still src/index.ts MolassesShort out/speedtest/molasses-f100.jpg --frame=100 --scale=1.3333333333333333 --browser-executable=\"$CHROME\" --binaries-location=/data/data/com.termux/files/usr/bin --gl=swiftshader --image-format=jpeg --timeout=600000 --overwrite"
