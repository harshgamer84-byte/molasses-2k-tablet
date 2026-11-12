#!/bin/bash
# Auto-Initialize Remotion Project for Termux
# Place in ~/bin/init-remotion-project and chmod +x
# Usage: init-remotion-project [path-to-remotion-project]
#
# This script automatically:
# 1. Detects if we're on Termux
# 2. Runs the optimizer if needed
# 3. Creates speedtest if missing
# 4. Provides next steps

set -e

PROJECT="${1:-.}"
cd "$PROJECT"

echo "🚀 Initializing Remotion project for rendering..."
echo "   Project: $(pwd)"
echo ""

# Detect platform
if [ ! -d "/data/data/com.termux" ]; then
  echo "ℹ️  Not running on Termux — skipping tablet optimizations"
  exit 0
fi

echo "✓ Termux environment detected"

# Check if optimizer exists, otherwise use inline version
OPTIMIZER_PATH="$HOME/m2k/scripts/optimize-for-termux.sh"
if [ -f "$OPTIMIZER_PATH" ]; then
  echo "✓ Running Termux optimizer..."
  bash "$OPTIMIZER_PATH" "$PROJECT"
else
  echo "⚠️  Optimizer not found at $OPTIMIZER_PATH"
  echo "   Run: cp $HOME/m2k/scripts/optimize-for-termux.sh ~/bin/"
  echo ""
  echo "Manual checklist:"
  echo "  [ ] Switch --gl=angle to --gl=swangle in all scripts"
  echo "  [ ] Add --muted flag to all remotion render commands"
  echo "  [ ] Verify ThreeCanvas has antialias: false"
  echo "  [ ] Set TMPDIR=\$PWD/remotion-tmp"
  exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ Project ready for Termux rendering!"
echo ""
echo "Next steps:"
echo "  1. Test: bash scripts/speedtest-tablet.sh"
echo "  2. If test passes, run: termux-wake-lock && bash scripts/render-*-tablet.sh"
echo "═══════════════════════════════════════════════════════"
