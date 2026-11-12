# Remotion Termux Rendering — Automatic Optimization

This document describes the automatic optimization tool for preparing Remotion projects for Android Termux tablet rendering.

## Quick Start

Run the optimizer on any Remotion project:

```bash
bash scripts/optimize-for-termux.sh [project-root]
```

## What It Does

The optimizer automatically applies all necessary patches for Termux/ARM Chromium rendering:

### 1. **WebGL Backend Fix** (`--gl=swangle`)
- Switches all `--gl=angle` to `--gl=swangle` in render scripts
- **Why:** ARM Chromium's ANGLE backend fails with "Error creating WebGL context"
- **Solution:** SwiftShader software WebGL (`swangle`) works reliably on tablets

### 2. **Audio Handling** (`--muted` flag)
- Adds `--muted` to all `npx remotion render` chunk commands
- **Why:** Termux FFmpeg rejects `-filter_script:a` during chunk encoding
- **Solution:** Render chunks muted, mux audio at the end with `ffmpeg -i video.mp4 -i audio.wav`

### 3. **WebGL Performance Optimization**
- Validates ThreeCanvas components have `antialias: false`
- **Why:** Software WebGL (SwiftShader) performs better without antialiasing
- **Additional:** Also recommends `stencil: false`, `powerPreference: "high-performance"`

### 4. **Termux Environment Setup**
- Validates Chromium and FFmpeg installation
- Checks TMPDIR configuration (`$PWD/remotion-tmp` for short paths)
- Ensures `--browser-executable` and `--binaries-location` point to Termux bins

### 5. **Validation & Summary**
- Reports all changes made
- Flags manual checks needed (complex ThreeCanvas patterns)
- Provides next steps for testing and rendering

## Usage Examples

### On This Project
```bash
cd ~/m2k
bash scripts/optimize-for-termux.sh
```

### On Any Other Project
```bash
cd ~/some-other-remotion-project
bash ~/m2k/scripts/optimize-for-termux.sh .
```

### Copy Tool to Global Location
```bash
cp ~/m2k/scripts/optimize-for-termux.sh ~/bin/remotion-optimize-termux
chmod +x ~/bin/remotion-optimize-termux
# Now run from anywhere:
cd ~/any-project && remotion-optimize-termux
```

## What Gets Changed

### Render Scripts (`scripts/*.sh`)
**Before:**
```bash
npx remotion render src/index.ts MyComp out.mp4 \
  --gl=angle --overwrite
```

**After:**
```bash
npx remotion render src/index.ts MyComp out.mp4 \
  --gl=swangle --muted --overwrite
```

### ThreeCanvas Components (`src/**/*.tsx`)
**Before:**
```tsx
<ThreeCanvas gl={{ powerPreference: "high-performance" }}>
```

**After (manual verification needed):**
```tsx
<ThreeCanvas gl={{ 
  antialias: false, 
  stencil: false, 
  powerPreference: "high-performance" 
}}>
```

## Prerequisites

The optimizer checks for:
- ✅ Chromium installed: `pkg install tur-repo && pkg install chromium`
- ✅ FFmpeg installed: `pkg install ffmpeg`
- ✅ Remotion project: `npm install` already run
- ✅ procps (optional): `pkg install procps` for memory checks

## Verification Workflow

After running the optimizer:

1. **Check the summary** — review all changes made
2. **Manual ThreeCanvas review** — verify `antialias: false` if flagged
3. **Run speedtest** — `bash scripts/speedtest-tablet.sh`
4. **Check the test frame** — open `out/speedtest/molasses-f100.jpg`
5. **Start full render** — `termux-wake-lock && bash scripts/render-molasses-tablet.sh`

## Common Issues & Solutions

### "Error creating WebGL context"
- **Cause:** Using `--gl=angle` on ARM Chromium
- **Fix:** Optimizer switches to `--gl=swangle` automatically

### FFmpeg audio filter errors during chunk render
- **Cause:** Termux FFmpeg rejects complex audio filter scripts
- **Fix:** Optimizer adds `--muted`, audio muxed at end

### Slow first frame (2-4 minutes)
- **Expected:** Bundling + shader compilation on first run
- **Normal:** Subsequent renders are much faster (cache)

### Out of memory during render
- **Cause:** Android kills background processes
- **Fix:** Run `termux-wake-lock`, close other apps, plug in charger

## Technical Details

### SwiftShader (SwANGLE)
- Software WebGL implementation (CPU-based)
- Slower than hardware GL but 100% compatible
- Essential for ARM Chromium without GPU passthrough

### Chunk + Mux Pattern
```bash
# Render 8 muted chunks
npx remotion render ... --frames=0-250 --muted out/chunk1.mp4
npx remotion render ... --frames=251-501 --muted out/chunk2.mp4
# ... (continue for all chunks)

# Concat chunks (video only)
ffmpeg -f concat -i concat.txt -c copy video.mp4

# Mux final audio
ffmpeg -i video.mp4 -i audio.wav -c:v copy -c:a aac final.mp4
```

## Integration as Cline Skill

This optimizer is now part of the Termux Remotion workflow. When handed a new Remotion project folder:

1. **Auto-detect Termux environment** (check for `/data/data/com.termux`)
2. **Run optimizer automatically** before any render commands
3. **Report changes** and flag manual checks
4. **Proceed with speedtest** if optimization succeeds

The tool is idempotent — safe to run multiple times (won't duplicate changes).

## Changelog

### 2026-11-12 — Initial Release
- Created automated optimizer for Termux Remotion projects
- Handles GL backend, audio muting, WebGL optimization
- Validates prerequisites and generates summary report
- Tested on `~/m2k` (Molasses 2K tablet render)

---

**Project:** Molasses Short 2K Tablet Render  
**Platform:** Android Termux (ARM64)  
**Status:** Optimizer deployed, speedtest running
