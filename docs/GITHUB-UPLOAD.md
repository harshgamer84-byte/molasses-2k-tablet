# GitHub Upload Guide (Manual - No GitHub CLI)

Since you're on Android Termux without GitHub CLI, here's the manual process:

## Step 1: Initialize Git Repository

```bash
cd ~/m2k
git init
git add .gitignore
git add scripts/optimize-for-termux.sh
git add scripts/init-remotion-project.sh  
git add scripts/speedtest-tablet.sh
git add scripts/render-molasses-tablet.sh
git add scripts/setup-github.sh
git add .cline/
git add docs/
git add README-TABLET.md
```

## Step 2: Create Initial Commit

```bash
git commit -m "feat: Add Termux Remotion optimizer

- Automated optimizer for Remotion projects on Android Termux
- WebGL backend fix: --gl=swangle for ARM Chromium
- Audio muting: --muted flag for Termux FFmpeg
- ThreeCanvas optimization: antialias false for software GL
- Cline AI skill for automatic optimization
- Complete documentation and guides

Tested: Molasses 2K tablet render
Platform: Android Termux ARM64
"
```

## Step 3: Create GitHub Repository

On your phone/computer browser:
1. Go to: https://github.com/new
2. Repository name: `molasses-2k-tablet`
3. Description: `Molasses Short 2K render on Android Termux + Remotion optimizer`
4. Choose: Public or Private (your choice)
5. **DON'T** initialize with README, .gitignore, or license
6. Click "Create repository"

## Step 4: Connect Local Repo to GitHub

After creating the repo, GitHub will show you commands. Use these:

### Option A: SSH (Recommended if you have SSH keys set up)
```bash
cd ~/m2k
git remote add origin git@github.com:YOUR_USERNAME/molasses-2k-tablet.git
git branch -M main
git push -u origin main
```

### Option B: HTTPS (Easier, uses personal access token)
```bash
cd ~/m2k
git remote add origin https://github.com/YOUR_USERNAME/molasses-2k-tablet.git
git branch -M main
git push -u origin main
```

**Note:** For HTTPS, you'll need a Personal Access Token instead of password:
- Go to: https://github.com/settings/tokens
- Generate new token (classic)
- Select scopes: `repo` (full control)
- Copy the token
- Use it as password when pushing

## Step 5: Verify Upload

```bash
# Check remote is set
git remote -v

# View commit
git log --oneline -1

# After push, verify on GitHub
# https://github.com/YOUR_USERNAME/molasses-2k-tablet
```

## What's Being Uploaded

✅ **scripts/optimize-for-termux.sh** - Main optimizer tool  
✅ **scripts/init-remotion-project.sh** - Project initializer  
✅ **scripts/speedtest-tablet.sh** - Single frame test (with swangle)  
✅ **scripts/render-molasses-tablet.sh** - Full render script (with swangle + muted)  
✅ **.cline/** - AI skill and documentation  
✅ **docs/** - Technical guides  
✅ **.gitignore** - Excludes node_modules, out/, tmp files

## Quick Commands (All at Once)

Copy-paste this entire block:

```bash
cd ~/m2k
git init
git add .gitignore scripts/*.sh .cline/ docs/ README-TABLET.md
git commit -m "feat: Add Termux Remotion optimizer and tablet render setup"
echo ""
echo "Now create repo at: https://github.com/new"
echo "Name: molasses-2k-tablet"
echo ""
echo "Then run ONE of these:"
echo "  git remote add origin git@github.com:YOUR_USERNAME/molasses-2k-tablet.git"
echo "  git remote add origin https://github.com/YOUR_USERNAME/molasses-2k-tablet.git"
echo ""
echo "Finally: git branch -M main && git push -u origin main"
```

## Troubleshooting

### "Permission denied (publickey)"
Use HTTPS instead of SSH, or set up SSH keys:
```bash
pkg install openssh
ssh-keygen -t ed25519 -C "your_email@example.com"
cat ~/.ssh/id_ed25519.pub
# Add this key to GitHub: https://github.com/settings/keys
```

### "Authentication failed" 
Use Personal Access Token instead of password (see Step 4 notes)

### "Large files detected"
Our .gitignore already excludes large files (out/, node_modules/, etc.)

---

**Ready to go!** Just follow Steps 1-5 above.
