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
#   * --gl=angle-egl (ANGLE on EGL). The initial --gl=angle failed
#     with "Error creating WebGL context" on ARM Chromium; angle-egl
#     is the backend that initializes cleanly on this tablet.
#   * The memory gate uses `free` when available (setup installs
#     procps); if `free` is missing it warns and continues.
#   * This package INCLUDES audio/mix.wav, so the tablet does the
#     concat + mux itself and finishes with out/molasses-2k-final.mp4.
#
# WHAT IT DOES: renders MolassesShort (2602 frames, 1440x2560,
# 30 fps, ~87 s) in 8 chunks (h264 crf 16, --scale
# 1.3333333333333333, --gl=angle-egl --concurrency=$CONC
# --timeout=600000 --muted), then concats the chunks with the ffmpeg
# concat demuxer (-c copy) to out/molasses-2k.mp4 (picture only) and
# muxes audio/mix.wav to out/molasses-2k-final.mp4.
#
# CONCURRENCY: default 1. Concurrency 2 corrupted frames on the OLD
# swangle pipeline (tiled blue-blob pattern, proven on the VM) and is
# UNTESTED with angle-egl on this tablet — only try CONC=2 on a single
# chunk and eyeball the output first. The GPU is shared, so 2 tabs
# rarely doubles speed; it mostly doubles RAM use, and Android's low
# memory killer then drops frames mid-chunk.
# DO NOT CHANGE: --scale MUST stay exactly 1.3333333333333333 — 1.3333
# gives a non-integer height (2559.936) and the stitcher rejects it.
# --timeout 600000: the first frame needs ~2 minutes to load + compile
# shaders.
#
# RESUMABLE: a chunk whose mp4 already exists is skipped, so a
# relaunch after a stall, a throttle, a phantom-process kill or a
# closed terminal only re-renders the unfinished chunk. set -e stops
# on a failed chunk instead of blindly continuing. Ranges are
# inclusive and contiguous:
# 0-325, 326-651, 652-977, 978-1303, 1304-1629, 1630-1955,
# 1956-2281, 2282-2601 = 2602 frames.
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

# Concurrency: 1 is the only proven-safe value on this tablet.
# Set CONC=2 to EXPERIMENT on a single chunk after eyeballing output.
CONC="${CONC:-1}"
case "$CONC" in
  1) ;;
  2) echo "WARNING: CONC=2 is untested with --gl=angle-egl here. Watch for artifacts / OOM kills." ;;
  *) echo "ABORT: CONC must be 1 or 2 (got '$CONC')." >&2; exit 1 ;;
esac

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
  local need=2000
  [ "$CONC" = "2" ] && need=3500
  if [ "$avail" -lt "$need" ]; then
    echo "ABORT: need >= ${need} MB available for CONC=${CONC} (have ${avail} MB). Finished chunks are kept; close apps and re-run this script." >&2
    exit 1
  fi
}

render_chunk() {
  local name=$1 range=$2
  local out="out/render/$name.mp4"
  local want got
  want=$(( ${range##*-} - ${range%%-*} + 1 ))
  got=$(ffprobe -v error -select_streams v:0 -count_packets \
    -show_entries stream=nb_read_packets -of csv=p=0 "$out" 2>/dev/null || true)
  if [ -s "$out" ] && [ "$got" = "$want" ]; then
    echo "=== $name $range SKIPPED (already rendered: $out, $got frames) ===" | tee -a out/render/progress.log
    return 0
  fi
  if [ -s "$out" ]; then
    echo "=== $name exists but has ${got:-0}/$want frames — deleting and re-rendering ===" | tee -a out/render/progress.log
    rm -f "$out"
  fi
  need_mem
  echo "=== $name $range started $(date -Is) ===" | tee -a out/render/progress.log
  npx remotion render src/index.ts MolassesShort "$out" \
    --codec=h264 --crf=16 --scale=1.3333333333333333 --image-format=jpeg \
    --frames="$range" \
    --browser-executable="$CHROME" \
    --binaries-location="$BINARIES" \
    --gl=angle-egl --concurrency="$CONC" --timeout=600000 --muted --overwrite \
    > "out/render/$name.log" 2>&1
  echo "=== $name DONE $(date -Is) ===" | tee -a out/render/progress.log
}

render_chunk chunkS1 0-325
render_chunk chunkS2 326-651
render_chunk chunkS3 652-977
render_chunk chunkS4 978-1303
render_chunk chunkS5 1304-1629
render_chunk chunkS6 1630-1955
render_chunk chunkS7 1956-2281
render_chunk chunkS8 2282-2601
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
echo "Tell worker it is done — the VM will run the delivery checks (ffprobe ~87 s / 1440x2560 / 30 fps / h264+AAC, loudness, frame spot-checks across all 9 shots)."
