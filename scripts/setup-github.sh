#!/bin/bash
# Setup GitHub repository for m2k (Molasses 2K Tablet Render)
# Run this script to initialize git and upload to GitHub
set -e
cd "$(dirname "$0")/.."

echo "=== Git & GitHub Setup for m2k ==="
echo "Project: Molasses 2K Tablet Render + Termux Optimizer"
echo ""

# 1. Check prerequisites
echo "[1/6] Checking prerequisites..."
if ! command -v git >/dev/null 2>&1; then
  echo "  ❌ Git not installed. Run: pkg install git"
  exit 1
fi
echo "  ✓ Git installed: $(git --version)"

if ! command -v gh >/dev/null 2>&1; then
  echo "  ⚠️  GitHub CLI not installed (optional)"
  echo "     Install with: pkg install gh"
  echo "     Or proceed manually (instructions will be provided)"
  USE_GH=false
else
  echo "  ✓ GitHub CLI installed: $(gh --version | head -1)"
  if gh auth status >/dev/null 2>&1; then
    echo "  ✓ GitHub authenticated"
    USE_GH=true
  else
    echo "  ⚠️  GitHub CLI not authenticated. Run: gh auth login"
    USE_GH=false
  fi
fi
echo ""

# 2. Initialize git repository
echo "[2/6] Initializing git repository..."
if [ -d .git ]; then
  echo "  ✓ Git repository already initialized"
else
  git init
  echo "  ✓ Git repository initialized"
fi
echo ""

# 3. Add files to staging
echo "[3/6] Staging files for commit..."
git add .gitignore
git add scripts/optimize-for-termux.sh
git add scripts/init-remotion-project.sh
git add scripts/speedtest-tablet.sh
git add scripts/render-molasses-tablet.sh
git add .cline/
git add docs/
git add README-TABLET.md 2>/dev/null || true
echo "  ✓ Optimizer and documentation files staged"
echo ""

# 4. Show what will be committed
echo "[4/6] Files ready to commit:"
git status --short
echo ""

# 5. Create initial commit
echo "[5/6] Creating initial commit..."
if git rev-parse HEAD >/dev/null 2>&1; then
  echo "  ✓ Commits already exist"
  git log --oneline -3
else
  git commit -m "feat: Add Termux Remotion optimizer and tablet render setup

- Automated optimizer for preparing Remotion projects on Android Termux
- Fixes WebGL backend (--gl=swangle for ARM Chromium)
- Adds audio muting for Termux FFmpeg compatibility
- Optimizes ThreeCanvas settings for software WebGL
- Includes speedtest and full render scripts for m2k (Molasses 2K)
- Cline AI skill for automatic optimization
- Complete documentation and quick reference

Tested on: Molasses Short 2K tablet render
Platform: Android Termux (ARM64)
Date: 2026-11-12"
  echo "  ✓ Initial commit created"
fi
echo ""

# 6. Upload to GitHub
echo "[6/6] GitHub repository setup..."
if [ "$USE_GH" = true ]; then
  echo "  Using GitHub CLI to create repository..."
  
  # Check if remote already exists
  if git remote get-url origin >/dev/null 2>&1; then
    echo "  ✓ Remote 'origin' already configured: $(git remote get-url origin)"
  else
    # Create repo and push
    gh repo create molasses-2k-tablet \
      --public \
      --description "Molasses Short 2K render on Android Termux tablet + Remotion optimizer" \
      --source=. \
      --push || {
        echo "  ⚠️  GitHub CLI failed, falling back to manual setup"
        USE_GH=false
      }
  fi
  
  if [ "$USE_GH" = true ]; then
    echo "  ✓ Repository created and pushed!"
    gh repo view --web
  fi
else
  echo "  Manual GitHub setup required:"
  echo ""
  echo "  1. Create a new repository on GitHub:"
  echo "     https://github.com/new"
  echo "     Name: molasses-2k-tablet"
  echo "     Description: Molasses Short 2K render on Android Termux tablet + Remotion optimizer"
  echo "     Public or Private: Your choice"
  echo ""
  echo "  2. After creating the repo, run these commands:"
  echo "     cd $(pwd)"
  echo "     git remote add origin git@github.com:YOUR_USERNAME/molasses-2k-tablet.git"
  echo "     git branch -M main"
  echo "     git push -u origin main"
  echo ""
  echo "  Or use HTTPS:"
  echo "     git remote add origin https://github.com/YOUR_USERNAME/molasses-2k-tablet.git"
  echo "     git branch -M main"
  echo "     git push -u origin main"
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ Git setup complete!"
if [ "$USE_GH" = true ]; then
  echo "✅ Repository uploaded to GitHub"
fi
echo "═══════════════════════════════════════════════════════"
