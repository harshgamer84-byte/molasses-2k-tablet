#!/bin/bash
# Molasses short — one-time tablet setup (Termux).
# Run from the project folder:  bash scripts/setup-tablet.sh
#
# What it does:
#   1. Checks Node, Chromium and FFmpeg are present.
#   2. Installs the project's Node dependencies (a few minutes).
#   3. Applies the compositor workaround that made tablet renders work
#      on 2026-11-11/12: Remotion's encoder binary
#      (@remotion/compositor-linux-arm64-musl) is not published for
#      Android, so npm never installs it. Remotion resolves the encoder
#      through that package's exported `dir` — pointing it at Termux's
#      bin dir makes Remotion use the system ffmpeg instead.
#   4. Sanity check: the MolassesShort composition must list without
#      errors (2010 frames, 1440x2560, 30 fps).
set -e
cd "$(dirname "$0")/.."

echo "== Versions =="
node --version
npm --version
if command -v chromium-browser >/dev/null 2>&1; then
  echo "chromium-browser: $(command -v chromium-browser)"
elif command -v chromium >/dev/null 2>&1; then
  echo "chromium: $(command -v chromium)"
else
  echo "ERROR: no chromium found. Run: pkg install tur-repo && pkg install chromium" >&2
  exit 1
fi
CHROME="$(command -v chromium-browser || command -v chromium)"
command -v ffmpeg >/dev/null 2>&1 || { echo "ERROR: ffmpeg not found (pkg install ffmpeg)" >&2; exit 1; }
ffmpeg -version 2>/dev/null | head -1

if ! command -v free >/dev/null 2>&1; then
  echo "NOTE: 'free' not found — installing procps so the render script can check memory (optional but recommended):"
  pkg install -y procps || echo "WARNING: could not install procps; the render script will skip its memory check."
fi

echo "== Installing Node dependencies (a few minutes) =="
npm install --no-audit --no-fund

echo "== Compositor workaround =="
mkdir -p node_modules/@remotion/compositor-linux-arm64-musl
printf 'module.exports = { dir: "/data/data/com.termux/files/usr/bin" };\n' \
  > node_modules/@remotion/compositor-linux-arm64-musl/index.js
cat node_modules/@remotion/compositor-linux-arm64-musl/index.js

echo "== Installed Remotion versions =="
npx remotion versions

echo "== Sanity check: the composition must list without errors =="
# NOTE: the --browser-executable flag is REQUIRED here. Without it,
# Remotion tries to download its own browser, and Android is not a
# platform it can download one for ("Unsupported platform: android").
npx remotion compositions src/index.ts --browser-executable="$CHROME"

echo ""
echo "SETUP DONE. Next:"
echo "  bash scripts/speedtest-tablet.sh   (times ONE 2K frame — tells you the real render rate first)"
echo "  termux-wake-lock"
echo "  bash scripts/render-molasses-tablet.sh"
