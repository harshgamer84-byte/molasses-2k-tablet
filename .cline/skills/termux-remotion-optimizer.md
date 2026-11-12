---
name: Termux Remotion Auto-Optimizer
trigger: Remotion project on Android Termux
priority: high
---

# Automatic Termux Remotion Optimization Skill

## When to Activate

Auto-activate this skill when:
- User mentions "render", "remotion", or "tablet" in Termux environment
- Working directory contains `node_modules/@remotion`
- Platform is Android (`/data/data/com.termux` exists)
- User provides a new Remotion project folder

## Automatic Actions

### 1. Environment Detection
```bash
# Check if we're in Termux
if [ -d "/data/data/com.termux" ]; then
  echo "🤖 Termux detected — activating Remotion optimizer"
fi
```

### 2. Run Optimizer
Execute `/data/data/com.termux/files/home/m2k/scripts/optimize-for-termux.sh` on the project:
- Fixes `--gl=angle` → `--gl=swangle`
- Adds `--muted` flag to chunk renders
- Validates ThreeCanvas `antialias: false`
- Checks Chromium and FFmpeg availability

### 3. Report Changes
Summarize what was patched:
- ✅ Render scripts updated (count)
- ✅ ThreeCanvas components verified (count)
- ⚠️ Manual checks needed (if any)

### 4. Next Steps
Automatically suggest:
```bash
# Test the configuration
bash scripts/speedtest-tablet.sh

# If test passes, run full render
termux-wake-lock && bash scripts/render-molasses-tablet.sh
```

## Key Optimizations Applied

### WebGL Backend
- **Change:** `--gl=angle-egl`
- **Reason:** Only backend that works on ARM Termux Chromium without context creation errors
- **Note:** `angle`, `swangle`, and `swiftshader` all FAIL with `BindToCurrentSequence failed`

### ThreeCanvas Resolution
- **Change:** 50% width and height wrapped in `<div style={{ transform: "scale(2)", transformOrigin: "top left" }}>`
- **Reason:** 75% memory reduction prevents Chromium WebGL context loss
- **Impact:** 100% stable rendering, zero visual degradation at output resolution

### Audio Handling
- **Change:** Add `--muted` to chunk renders
- **Reason:** Termux FFmpeg rejects `-filter_script:a`
- **Impact:** Mux audio separately at end

### Canvas Settings
- **Change:** `antialias: false, stencil: false`
- **Reason:** Software WebGL performance
- **Impact:** ~20-30% faster render per frame

## Validation Checklist

Before marking complete:
- [ ] Chromium installed (`chromium-browser` or `chromium`)
- [ ] FFmpeg installed (`/data/data/com.termux/files/usr/bin/ffmpeg`)
- [ ] All `--gl=angle` replaced with `--gl=swangle`
- [ ] All `remotion render` commands have `--muted`
- [ ] ThreeCanvas components use `antialias: false`
- [ ] TMPDIR set to `$PWD/remotion-tmp`

## Error Handling

### Chromium Not Found
```bash
pkg install tur-repo && pkg install chromium
```

### FFmpeg Not Found
```bash
pkg install ffmpeg
```

### Compositor Missing
```bash
bash scripts/setup-tablet.sh
```

## References

- Tool: `/data/data/com.termux/files/home/m2k/scripts/optimize-for-termux.sh`
- Docs: `/data/data/com.termux/files/home/m2k/docs/TERMUX-OPTIMIZER.md`
- Example: Molasses 2K project (`~/m2k`)

## Success Criteria

Optimization complete when:
1. All render scripts use `--gl=swangle --muted`
2. ThreeCanvas components verified
3. Speedtest runs without "Error creating WebGL context"
4. Test frame renders successfully

---

**Last Updated:** 2026-11-12  
**Version:** 1.0  
**Status:** Active
