#!/bin/bash
# Molasses short — full 2K render, TABLET (Termux) version.
# Based on scripts/render_2k_small_chunks.sh (the VM version), adapted
# 2026-11-12 after the tablet proved it can render Remotion end to end:
# the Minimalist v5 ad (1514 frames, 1080x1920) rendered on this tablet
# in 14 minutes on 2026-11-12.
#
# WHY THE TABLET, NOT THE VM: the VM measured ~30 s/frame at 2K
# (~17 h total) and this exact render died THREE times on the VM
# (memory balloon collapses, machine restarts). No finished chunks
# exist there — everything renders from frame 0 either way, so the
# tablet loses nothing and risks far less.
#
# TABLET DIFFERENCES from the VM script:
#   * TMPDIR is $PWD/remotion-tmp (short, inside the project).
#   * The render passes --browser-executable (Termux Chromium) and
#     --binaries-location=/data/data/com.termux/files/usr/bin (Termux
#     ffmpeg), exactly like the proven v5 tablet render.
#   * --gl=swangle (software WebGL via SwiftShader). The initial
#     --gl=angle failed with "Error creating WebGL context" on ARM
#     Chromium. swangle/swiftshader is the software fallback that
#     works reliably on this tablet.
#   * The memory gate uses `free` when available (setup installs
#     procps); if `free` is missing it warns and continues.
#   * This package INCLUDES audio/mix.wav, so the tablet does the
#     concat + mux itself and finishes with out/molasses-2k-final.mp4.
#
# WHAT IT DOES: renders MolassesShort (2010 frames, 1440x2560,
# 30 fps, 67 s) in 8 chunks (h264 crf 16, --scale
# 1.3333333333333333, --gl=swangle --concurrency=1 --timeout=600000
# --muted), then concats the chunks with the ffmpeg concat demuxer
# (-c copy) to out/molasses-2k.mp4 (picture only) and muxes
# audio/mix.wav to out/molasses-2k-final.mp4.
#
# DO NOT CHANGE: --concurrency MUST stay 1 — concurrency 2 corrupts
# every frame on this pipeline (tiled blue-blob pattern, proven in
# out/speedtest2k/ on the VM). --scale MUST stay exactly
# 1.3333333333333333 — 1.3333 gives a non-integer height (2559.936)
# and the stitcher rejects it. --timeout 600000: the first frame
# needs ~2 minutes to load + compile shaders.
#
# RESUMABLE: a chunk whose mp4 already exists is skipped, so a
# relaunch after a stall, a throttle, a phantom-process kill or a
# closed terminal only re-renders the unfinished chunk. set -e stops
# on a failed chunk instead of blindly continuing. Ranges are
# inclusive and contiguous:
# 0-250, 251-501, 502-752, 753-1003, 1004-1254, 1255-1505,
# 1506-1756, 1757-2009 = 2010 frames.
#
# RUN IT: plug the tablet in, run `termux-wake-lock` first so Android
# does not kill Termux with the screen off, close everything else,
# then: bash scripts/render-molasses-tablet.sh
# Leave it running. The rate is unknown on the tablet — run
# scripts/speedtest-tablet.sh first to time one 2K frame. On the VM
# it was ~30 s/frame (~17 h); if the tablet matches v5's pace it
# could be far faster. Overnight is the sane plan either way.
# Run only this render; nothing heavy alongside it.
set -e
cd "$(dirname "$0")/.."
export TMPDIR="$PWD/remotion-tmp"
export REMOTION_TMP="$PWD/remotion-tmp"
export TEMP="$PWD/remotion-tmp"
export TMP="$PWD/remotion-tmp"
mkdir -p "$TMPDIR" out/render

CHROME="$(command -v chromium-browser || command -v chromium || true)"
if [ -z "$CHROME" ]; then
  echo "ERROR: no chromium found. Run: pkg install tur-repo && pkg install chromium" >&2
  exit 1
fi
BINARIES="/data/data/com.termux/files/usr/bin"
if [ ! -x "$BINARIES/ffmpeg" ]; then
  echo "ERROR: ffmpeg not found in $BINARIES (pkg install ffmpeg)" >&2
  exit 1
fi
if [ ! -f node_modules/@remotion/compositor-linux-arm64-musl/index.js ]; then
  echo "ERROR: compositor workaround missing — run bash scripts/setup-tablet.sh first" >&2
  exit 1
fi
echo "chromium: $CHROME"
echo "binaries: $BINARIES"

need_mem() {
  if ! command -v free >/dev/null 2>&1; then
    echo "WARNING: 'free' not found — skipping memory check (pkg install procps to enable it)."
    return 0
  fi
  local avail
  avail=$(free -m | awk '/^Mem:/ {print $7}')
  echo "available=${avail} MB at $(date -u '+%F %T UTC')"
  if [ "$avail" -lt 2000 ]; then
    echo "ABORT: need >= 2000 MB available to start a chunk (have ${avail} MB). Finished chunks are kept; close apps and re-run this script." >&2
    exit 1
  fi
}

render_chunk() {
  local name=$1 range=$2
  local out="out/render/$name.mp4"
  if [ -s "$out" ]; then
    echo "=== $name $range SKIPPED (already rendered: $out) ===" | tee -a out/render/progress.log
    return 0
  fi
  need_mem
  echo "=== $name $range started $(date -Is) ===" | tee -a out/render/progress.log
  npx remotion render src/index.ts MolassesShort "$out" \
    --codec=h264 --crf=16 --scale=1.3333333333333333 --image-format=jpeg \
    --frames="$range" \
    --browser-executable="$CHROME" \
    --binaries-location="$BINARIES" \
    --gl=swangle --concurrency=1 --timeout=600000 --muted --overwrite \
    > "out/render/$name.log" 2>&1
  echo "=== $name DONE $(date -Is) ===" | tee -a out/render/progress.log
}

render_chunk chunkS1 0-250
render_chunk chunkS2 251-501
render_chunk chunkS3 502-752
render_chunk chunkS4 753-1003
render_chunk chunkS5 1004-1254
render_chunk chunkS6 1255-1505
render_chunk chunkS7 1506-1756
render_chunk chunkS8 1757-2009
echo "ALL CHUNKS DONE $(date -Is)" | tee -a out/render/progress.log

printf "file '%s'\n" \
  "$PWD/out/render/chunkS1.mp4" \
  "$PWD/out/render/chunkS2.mp4" \
  "$PWD/out/render/chunkS3.mp4" \
  "$PWD/out/render/chunkS4.mp4" \
  "$PWD/out/render/chunkS5.mp4" \
  "$PWD/out/render/chunkS6.mp4" \
  "$PWD/out/render/chunkS7.mp4" \
  "$PWD/out/render/chunkS8.mp4" \
  > out/render/concat.txt
ffmpeg -y -v error -f concat -safe 0 -i out/render/concat.txt \
  -c copy out/molasses-2k.mp4
ffmpeg -y -v error -i out/molasses-2k.mp4 -i audio/mix.wav \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest \
  out/molasses-2k-final.mp4
echo "CONCAT + MUX DONE $(date -Is) — out/molasses-2k-final.mp4" | tee -a out/render/progress.log
echo "Copy it somewhere safe: cp out/molasses-2k-final.mp4 /sdcard/Download/molasses-short-2k.mp4"
echo "Tell worker it is done — the VM will run the delivery checks (ffprobe ~67 s / 1440x2560 / 30 fps / h264+AAC, loudness, frame spot-checks across all 9 shots)."
