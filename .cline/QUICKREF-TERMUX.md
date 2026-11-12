# Termux Remotion Optimization — Quick Reference

## For Cline/AI Assistant

When a user provides a Remotion project folder on Termux, **automatically run**:

```bash
bash ~/m2k/scripts/init-remotion-project.sh [project-path]
```

This will:
1. ✅ Detect Termux environment
2. ✅ Apply all necessary patches (GL backend, audio, canvas)
3. ✅ Validate prerequisites
4. ✅ Report what was changed

## Manual Usage

### Initialize Any Remotion Project
```bash
cd ~/some-remotion-project
bash ~/m2k/scripts/init-remotion-project.sh
```

### Direct Optimizer Call
```bash
cd ~/project
bash ~/m2k/scripts/optimize-for-termux.sh
```

### Install Globally (Optional)
```bash
mkdir -p ~/bin
cp ~/m2k/scripts/init-remotion-project.sh ~/bin/init-remotion
cp ~/m2k/scripts/optimize-for-termux.sh ~/bin/remotion-optimize
chmod +x ~/bin/init-remotion ~/bin/remotion-optimize

# Add to PATH if needed
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc
```

## What Gets Fixed

| Issue | Fix | Why |
|-------|-----|-----|
| `Error creating WebGL context` | `--gl=angle-egl` | `angle`, `swangle`, `swiftshader` fail on ARM Chromium |
| WebGL context loss / OOM | Half-res ThreeCanvas + CSS `scale(2)` | 75% memory reduction |
| FFmpeg audio filter errors | `--muted` on chunks | Termux FFmpeg rejects `-filter_script:a` |
| Long socket paths | `TMPDIR=$PWD/remotion-tmp` | Chromium 108-char UNIX socket limit |

## Verification

After optimization, always:
1. **Run speedtest** → `bash scripts/speedtest-tablet.sh`
2. **Check output** → `ls -lh out/speedtest/*.jpg`
3. **Visual verify** → Open the image, ensure scene rendered
4. **Start render** → `termux-wake-lock && bash scripts/render-*-tablet.sh`

## Integration Status

✅ **Script Created:** `scripts/optimize-for-termux.sh`  
✅ **Init Script:** `scripts/init-remotion-project.sh`  
✅ **Documentation:** `docs/TERMUX-OPTIMIZER.md`  
✅ **Cline Skill:** `.cline/skills/termux-remotion-optimizer.md`

---

**Tested on:** Molasses 2K (`~/m2k`)  
**Date:** 2026-11-12  
**Status:** Active, speedtest running with `--gl=swangle`
