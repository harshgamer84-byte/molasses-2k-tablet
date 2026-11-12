# Molasses short — 2K render, tablet package

'The Day a Wave of Molasses Crushed a City' — Boston, 15 Jan 1919.
67 seconds, 2010 frames, 1440x2560, 30 fps, 9 shots. Picture and audio
(voiceover + full mix, 67.000 s) are done and verified — this package is
only the final 2K render.

## Why the tablet

The VM measured ~30 s/frame at 2K (~17 h total) and this exact render
died **three times** on the VM (memory balloon collapses, machine
restarts). No finished chunks exist there, so nothing is lost by
moving: everything renders from frame 0 either way. The tablet just
rendered the Minimalist v5 ad (1514 frames) in **14 minutes**, so it is
the live render machine now.

## Steps

1. Copy this folder to the tablet (for example `~/molasses-2k`) and
   open Termux there. Everything else closed, tablet plugged in.
2. `bash scripts/setup-tablet.sh` — checks Node/Chromium/FFmpeg,
   installs dependencies, applies the compositor workaround, lists
   the composition. Must end with `MolassesShort` listed (2010f).
   If setup asks about the mount crash: Cline in VS Code fixed the
   same crash on the v5 project, point it at this folder.
3. `bash scripts/speedtest-tablet.sh` — renders ONE 2K still
   (frame 100) and times it. First run takes ~3–4 min (bundling +
   shader compile) and that is normal. Multiply its seconds by 2010
   for the rough full-render time. Open the still and check the
   picture is there.
4. `termux-wake-lock` — so Android does not kill Termux with the
   screen off. This matters: the first v5 overnight attempt died
   exactly this way (phantom-process killer, Termux reset, no
   progress). Keep the tablet plugged in.
5. `bash scripts/render-molasses-tablet.sh` — renders in 8 resumable
   chunks (0–250, 251–501, 502–752, 753–1003, 1004–1254, 1255–1505,
   1506–1756, 1757–2009), then concats and muxes the voiceover mix
   itself. If Termux gets reset mid-run, finished chunks are kept —
   just re-run the script and it skips them.
6. When it finishes: `cp out/molasses-2k-final.mp4 /sdcard/Download/molasses-short-2k.mp4`
   and send the file back. The VM will run delivery checks (67 s,
   1440x2560, h264+AAC, loudness, frame spot-checks across all
   9 shots).

## Do not change

- `--concurrency=1` — concurrency 2 corrupts every frame on this
  pipeline (tiled blue-blob pattern, proven on the VM).
- `--scale=1.3333333333333333` exactly — 1.3333 gives a non-integer
  height (2559.936) and the stitcher rejects it.
- `--gl=angle` — the v5 tablet render crashed on mount under
  `--gl=swangle`. If a chunk still crashes on mount, test one still
  with `--gl=swiftshader` and switch the script only if that works:
  `sed -i 's/--gl=angle/--gl=swiftshader/' scripts/render-molasses-tablet.sh`
- `--timeout=600000` — the first frame needs ~2 min to load and
  compile shaders.

## Files

- `src/` — the full build (camera, world, materials, characters,
  audio). `src/index.ts` registers `MolassesShort`.
- `audio/mix.wav` — final voiceover mix, 67.000 s (muxed at the end).
- `package.json` / `package-lock.json` — Remotion 4.0.484 range.
  The VM rendered 419 frames of chunk A with these exact versions,
  so they are proven for this project.
- `scripts/setup-tablet.sh`, `scripts/speedtest-tablet.sh`,
  `scripts/render-molasses-tablet.sh` — see above.
- `public/` — empty by design (no extra assets; everything is
  code-drawn or in `src/`).
