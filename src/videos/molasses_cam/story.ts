// Timeline of the molasses short: "The Day a Wave of Molasses Crushed a City" (Boston, 15 Jan 1919).
// Shots timed to the voice words (SCRIPT.md, ~3.12 words/s, 271 words, 2602 frames = 86.7 s), using the same
// camera grammar as the bridge short: continuous slow push-ins; symmetric smootherstep glides 18-40 f;
// big reframes are cuts; impacts are 7-frame kicks that flip sign every frame; no hand-held float.
// SCAFFOLD NOTE: the world (world.ts / build.ts) still builds the BRIDGE's river/town set, not a Boston
// street + 50 ft tank. The cameras below are staged in the BOSTON set's coordinates (ground y = D0 = 6;
// street centreline x = 0, z -55..+15, cobbles x -7..7; tank centre (0, 6, -30), r 13.7, top y 21.2,
// near face z -16.3; tenements |x| 15..28; elevated railway x ~ -22, deck y ~ 14; ballpark PARK = [70, 6, -75]).
// No camera sits inside the tank cylinder or a tenement row, and every look point lands on its beat's
// subject; the set rebuild is the main remaining work after script approval. Physics helpers
// (front/marchPhase/amp/deckY/bridgeState) are the bridge set's and are kept only so world.ts/cast.ts
// keep typechecking and rendering.
export const FPS = 30;
export const TOTAL = 2602;
export const D0 = 6.0; // bank top + deck height (m) of the bridge set
export const HALF = 27; // towers at z = +-27, span 54 m
export const FILES = [-1.65, -0.55, 0.55, 1.65];
export const ROW_GAP = 1.3;
export const COUNT = 74;
export const PARK: V3 = [70, D0, -75]; // Langone Park ballpark centre (x, ground y, z)
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
const lin = (pts: [number, number][], x: number) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return pts[pts.length - 1][1];
};

// ---------------- story physics (tau = story time in seconds; bridge set only) ----------------
export const front = (tau: number) => 26 - 1.6 * (tau - 4.4); // z of the front row, marching toward -z
export const marchPhase = (tau: number) => ((tau % 1) + 1) % 1; // 1 Hz cycle = 2 steps/s, footfalls at 0 and 0.5
export const SNAP = 35.574, DROP0 = 36.756, DROP1 = 37.651; // SNAP = f 1067, the tank bursts
export const amp = (tau: number) =>
  lin([[21.469, 0], [24.255, 0.07], [27.772, 0.13], [36.027, 0.26], [43.942, 0.46], [SNAP, 0.55], [SNAP + 0.35, 0.0]], tau);
export const stomp = (tau: number) => lin([[27.772, 1.0], [36.027, 1.35], [43.942, 1.5]], tau); // "a little harder every step"
export const shapeZ = (z: number) => (Math.abs(z) < HALF ? Math.cos((Math.PI * z) / (2 * HALF)) : 0);
export const dropW = (z: number) => smooth((20 - z) / 26); // 1 on the near half, 0 at the far tower
export const dropU = (tau: number) => (tau < DROP0 ? 0 : Math.min(1, ((tau - DROP0) / (DROP1 - DROP0)) ** 2));
export const DROP_H = 6.6;

export type BridgeState = { bounce: number; drop: number; snap: number; collapsed: boolean };
export const deckY = (z: number, b: BridgeState) => D0 + b.bounce * shapeZ(z) - b.drop * DROP_H * dropW(z);

// ---------------- shots ----------------
export type Light = "day" | "golden";
// "street" = North End street crowd (kids, neighbours); "flee" = crowd running from the wave;
// "trapped" = people stuck in the cooled molasses (shot 6); "park" = ballpark kids (shot 9).
export type Crowd = "march" | "fall" | "water" | "bank" | "tourists" | "none" | "street" | "flee" | "trapped" | "park";
export type ShotDef = { id: number; a: number; b: number; light: Light; crowd: Crowd; tau: (t: number) => number; towns?: boolean };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 231, light: "day", crowd: "street", tau: (t) => t }, // HOOK: Antonio + sister gathering firewood, tank looming
  { id: 2, a: 231, b: 550, light: "day", crowd: "street", tau: (t) => t, towns: true }, // SETTING: 50 ft tank over the tenements
  { id: 3, a: 550, b: 778, light: "day", crowd: "street", tau: (t) => t }, // ACTION 1: leaks, kid's bucket catching a drip
  { id: 4, a: 778, b: 1067, light: "day", crowd: "street", tau: (t) => t }, // ACTION 2: warm day, camera creeps up the tank
  { id: 5, a: 1067, b: 1357, light: "day", crowd: "flee", tau: (t) => t }, // SNAP: tank bursts, molasses wall, crowd flees
  { id: 6, a: 1357, b: 1488, light: "day", crowd: "trapped", tau: (t) => t }, // DEADPAN: drowned street, tilted train car
  { id: 7, a: 1488, b: 1939, light: "day", crowd: "none", tau: (t) => t }, // EXPLANATION: cold honey (a) / warm pour + wave (b)
  { id: 8, a: 1939, b: 2372, light: "day", crowd: "none", tau: (t) => t }, // CONSEQUENCE: stamp "APPROVED" / rebuilt street
  { id: 9, a: 2372, b: TOTAL, light: "golden", crowd: "park", tau: (t) => t }, // CALLBACK: Langone Park ballpark, golden hour
];
/** crossfades (frames) at place/time changes; a white 4-frame flash after the hook */
export const XFADE: Record<number, number> = { 7: 8, 8: 8 };
export const FLASH_AT = 231;
/** shot 7 beat boundary (f 1740): cold-honey close-up -> warm pour + wave slamming a wall, a hard cut
 *  (the skill allows cuts on big jumps, and jar-CU -> wave-slam is one). Word timing (SCRIPT.md,
 *  ~3.12 words/s from f 1488): "But" ~f 1740, "warm" ~f 1747, so the cut lands 3 f before "warm"
 *  (the old midpoint value 1305 landed ~21 f early, mid "it set like glue").
 *  TODO: layersAt only crossfades at shot starts, so a mid-shot beat crossfade needs a ShotView that
 *  can render two framings of one shot (world-rebuild step). */
export const BEAT_XFADE_AT = 1740;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
/** layers to draw at frame f: base shot, plus the next shot fading in during a crossfade */
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

export const bridgeState = (id: number, t: number): BridgeState => {
  const s = SHOTS[id - 1];
  const tau = s.tau(t);
  const bounce = -amp(tau) * Math.cos(4 * Math.PI * marchPhase(tau));
  if (id === 5) return { bounce, drop: 0, snap: clamp01((tau - SNAP) / 0.7), collapsed: false };
  return { bounce: id <= 4 ? bounce : 0, drop: 0, snap: 0, collapsed: false };
};

// ---------------- camera ----------------
// Grammar (motion.md): every move is a symmetric smootherstep glide of 18-40 f (peak speed = 1.875 x distance / dur,
// so dur >= 0.075 x the move in 720p px keeps the peak near the reference 14-25 px/f); a reframe bigger than about
// half a frame width or 40 % zoom is a hard cut on its key frame. Glides are centred on the old key frame (the
// whoosh in the sound mix peaks there), so a glide key starts dur/2 earlier. Holds push in (dolly toward the look
// point or a fov zoom near walls/towers): 0.15-0.35 %/f, ~0.6 %/f for ~35 f on the punch words. Rolls of 4-8 deg
// over >= 18 f on emphasis beats, held tilt <= 0.07 rad.
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
/** reference camera ease: symmetric smootherstep (attack = release, ~10 f each on a 23 f move) */
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const T = (f: number) => f / FPS;
/** push-in factor since f0: the subject grows ~rate per frame; `punch` raises it (with 8 f soft edges) for the first n frames */
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
/** dolly push: camera slides toward the look point by factor k */
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
/** zoom push (camera stays put, for lenses next to towers / houses): tan(fov/2) shrinks by k */
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });
/** a roll-only move on top of an existing framing */
const rolled = (s: (f: number) => Shot, roll: number) => (f: number): Shot => ({ ...s(f), roll });

// rivet / drip point on the tank's NEAR face (z -16.3), 1 m above the street: the shot 3 close-up
// and the DOF focus. (world.ts still imports this; the world owner is dropping bridge references.)
export const ANCHOR: V3 = [0, D0 + 1.0, -16.3];
export const snapEnd = (snap: number): V3 => {
  const u = easeOut(snap);
  return [ANCHOR[0] - 0.6 * u, ANCHOR[1] + 5.5 * u - 2.0 * u * u, ANCHOR[2] + 4.5 * u];
};

// ---- framings (f -> camera); each pushes in from the frame its key starts ----
// All positions are in the Boston set (see the CAM PASS note above). Cameras stand on the street
// SOUTH of the tank's near face (z > -16.3) looking north at it, except shot 1 (south of the kids,
// the tank looming behind them to the north) and shots 7a/8a (close-ups on the street at z ~ 0).
// Shot 1 (hook): street-level close-up of the kids, tank looming behind -> closer MS, slow push-in.
// The scaffold had the camera NORTH of the kids (z -12/-6.5) looking south, so the tank sat behind
// the lens; flipped to the south side (z 11/6.5) looking north.
const S1a = (f: number) => dolly([6.5, D0 + 1.8, 11], [0, D0 + 1.6, 0.5], pushK(f, 0, 0.0025), { fov: 42 });
const S1b = (f: number) => dolly([2.0, D0 + 1.5, 6.5], [0, D0 + 1.6, 0.5], pushK(f, 114, 0.002), { fov: 38, roll: -0.03 });
// shot 2 (setting): wide establishing from the SOUTH-EAST corner of the street, looking diagonally
// north-west: the tank sits right-of-centre, the elevated railway and the west tenements read on the
// left, the street leads in below. A head-on wide from the north end cannot work — the tank is a 27 m
// wall across a 20 m street, so from the north end it fills the whole 25 deg horizontal fov and hides
// everything south of it; the diagonal (43 m from the tank centre, camera pulled back to the street's
// south end and up to y D0+8) is what lets the wide read as tank + tenements + railway. The scaffold's
// S2a [17, 13, -52] stood inside the east tenement row (|x| 15..28) and its S2b [8, 11, -40] inside
// the tank. S2b is a CUT, not a glide: the ~15 m push-in is a big jump per the camera grammar, and it
// keeps the same diagonal composition, closer (tank right 2/3, railway + tenements left 1/3).
const S2a = (f: number) => zoom([12, D0 + 10, 16], [-16, D0 + 6, -28], 44, pushK(f, 231, 0.002)); // pulled back: the 27 m tank filled the whole frame at 22 m
const S2b = (f: number) => zoom([10, D0 + 6, 2], [-6, D0 + 5, -20], 42, pushK(f, 354, 0.002));
// shot 3 (action 1, leaks): close-up of the rivets / drips on the tank's near face, bucket catching
// a drip. The scaffold's ANCHOR [-2.7, D0+0.62, -37] was inside the tank; the drip is now on the
// near face and both cameras sit just south of it, ~3 m off the wall.
const S3a = (f: number) => dolly([-1.6, D0 + 1.6, -10.5], [0.4, D0 + 1.4, -16.3], pushK(f, 550, 0.0025), { fov: 40 }); // aimed at the centre bucket kid (0.4, -14.2) so kid + bucket are in frame (was aimed between kids, the kid was cut off at the edge)
const S3b = (f: number) => dolly([-0.8, D0 + 1.3, -10.2], [0.4, D0 + 1.1, -16.3], pushK(f, 668, 0.002), { fov: 38 });
// shot 4 (action 2, warm day): camera creeps up the tank as the sun warms. The scaffold looked west
// along the street (look z 7/2), so the tank was never in frame; both keys now look at the tank face,
// the look rising from y D0+2.5 to D0+9 over the 40 f glide.
const S4a = (f: number) => dolly([10, D0 + 2.5, 6], [0, D0 + 7, -16.3], pushK(f, 778, 0.002), { fov: 44 }); // further back + lower: street at the bottom, full face, sky at the top (was still a flat brown wall at 17-23 m)
const S4b = (f: number) => dolly([9, D0 + 3, 10], [0, D0 + 9, -16.3], pushK(f, 881, 0.0015), { fov: 46 });
// shot 5 (snap): tank bursts -> fast pull-back with a 4-5 deg dutch roll as the wave surges down the
// street toward the camera. Both burst cameras stand SOUTH of the tank (z +5 / +10), looking north at
// the bursting tank and the wave surging toward the lens; the pull-back (8.8 m in 36 f, rising 4 m)
// starts at f 834, just as the wave reaches the S5a position. The scaffold's S5a [4.5, 15, -45] sat
// 1.3 m off the tank's south face with its view ray passing through the tank, and S5b [10, 12, -55]
// stood north of the tank looking south through it.
const S5a = (f: number) => dolly([6, D0 + 5, 10], [0, D0 + 2, -14], pushK(f, 1067, 0.0025), { fov: 42 }); // further south + higher: the falling panel no longer fills the frame
const S5b = (f: number) => dolly([12, D0 + 9, 15], [0, D0 + 1.5, -14], pushK(f, 1095, 0.002), { fov: 46, roll: 0.08 });
// shot 6 (deadpan): still aftermath, street drowned in brown, tilted train car toward the elevated
// railway, slow push-in. The scaffold's S6a [7.5, 2.4, -25] was inside the tank AND 3.6 m below
// ground; the camera now stands on the street at eye level, looking north-west at the drowned street.
const S6a = (f: number) => dolly([5, D0 + 1.8, 2], [-1, D0 + 1.1, -6], pushK(f, 1357, 0.0018), { fov: 44, roll: -0.04 }); // low, close, eye-level: the waist-deep figures are 4-14 m away and read as people, not dots (was [6, 8.2, 8]: the heads were 2% of the frame)
// shot 7 (explanation): (a) cold honey barely moving from a jar, close-up; (b) warm pour + wave slamming a wall
const S7a = (f: number) => dolly([0.9, D0 + 1.75, -3.1], [0.55, D0 + 1.5, 0], pushK(f, 1488, 0.0025), { fov: 34 }); // pulled back, look on the jar's middle (was half out of the bottom of the frame)
const S7b = (f: number) => dolly([7, D0 + 9, -14], [0, D0 + 1.5, 7], pushK(f, 1740, 0.002), { fov: 52, roll: -0.03 }); // south of the tank's near face (a camera at z -24 would be INSIDE the tank), wide enough to show the 10 m surge + the 26 m wall above/beside it
// shot 8 (consequence): (a) engineer's hand stamping a blueprint "APPROVED" on a table on the street
// (stamp point [2, D0+1, 0]); (b) wide of the rebuilt street. The scaffold's S8a [1.3, D0+1.6, -36.6]
// and its look [2.9, D0+1.3, -31.2] were both inside the tank, and S8b [1.7, D0+1.75, -15.5] stood
// 0.8 m off the tank face; both moved onto the street at z ~ 0 / -6.
const S8a = (f: number) => zoom([0.6, D0 + 1.7, -2.5], [2.0, D0 + 1.0, 0], 42, pushK(f, 1939, 0.0025), { fov: 42 });
const S8b = (f: number) => dolly([3, D0 + 2.5, 14], [0, D0 + 6, -30], pushK(f, 2151, 0.0008), { fov: 44 }); // from the street's south end looking north: cobbles lead to the ruin + tenements both sides (was 18 m from the ruin, which filled the whole frame)
// shot 9 (callback): golden-hour ballpark where the tank stood, kids playing, warm haze, slow push-in to the end
const S9a = (f: number) => dolly([PARK[0] + 0.55, D0 + 1.5, PARK[2] - 8], [PARK[0] + 0.55, D0 + 1.75, PARK[2]], pushK(f, 2372, 0.001), { fov: 40 });
const S9b = (f: number) => dolly([PARK[0] - 1.6, D0 + 1.9, PARK[2] - 9.5], [PARK[0] + 0.4, D0 + 1.95, PARK[2]], pushK(f, 2488, 0.0015), { fov: 42 });

const CAMS: Record<number, Key[]> = {
  1: [
    { f: 0, s: S1a },
    { f: 114, dur: 30, s: S1b }, // centred on 133 ("wave of syrup"), roll in
  ],
  2: [
    { f: 231, s: S2a },
    { f: 354, cut: true, s: S2b }, // cut, not a glide: the ~15 m push-in is a big jump (see S2b)
  ],
  3: [
    { f: 550, s: S3a }, // cut on "The tank had leaked"
    { f: 668, dur: 30, s: S3b }, // centred on 682 ("buckets for the drips")
  ],
  4: [
    { f: 778, s: S4a }, // cut on "The day before, it was two degrees"
    { f: 881, dur: 40, s: S4b }, // creep up the tank on "fermented"
  ],
  5: [
    { f: 1067, s: S5a }, // cut on the burst (+ big kick)
    { f: 1095, dur: 36, s: S5b }, // fast pull-back, dutch roll 0.08 rad (~4.6 deg)
  ],
  6: [{ f: 1357, s: S6a }], // cut to the still aftermath; slow push-in only
  7: [
    { f: 1488, s: S7a }, // cut on "molasses is honey's slow cousin"
    { f: 1740, cut: true, s: S7b }, // beat change (see BEAT_XFADE_AT): warm pour + wave slams the wall
  ],
  8: [
    { f: 1939, s: S8a }, // XFADE in on "The company blamed anarchists"
    { f: 2151, cut: true, s: S8b }, // cut to the rebuilt street on "Boston made a new rule"
  ],
  9: [
    { f: 2372, s: S9a },
    { f: 2488, dur: 28, s: S9b }, // centred on 2502 ("you can still smell the molasses")
  ],
};

// impact kicks: the image offset flips sign every frame (~3 px at 720p per unit), decays to 0 in 7 f,
// roll +-0.23 deg per unit; they start on the first frame at/after the event. No hand-held float.
// Rivet pops at f 983/1012/1041 (t 32.772/33.723/34.712 s); the tank burst at f 1067 (t 35.574 s, big).
const KICKS: [number, number][] = [[35.574, 1.6], [32.772, 0.4], [33.723, 0.45], [34.712, 0.5]];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(T(f));
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a; // metres at the look distance for 3 px x a
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};
/** frame at which the current key's move has finished (for picking billboard views per key, not per frame) */
export const keyEnd = (id: number, f: number) => {
  let e = 0;
  for (const k of CAMS[id]) if (f >= k.f) e = k.f + (k.cut ? 0 : k.dur ?? 24);
  return Math.max(f, e);
};

// ---------------- lens: depth of field + foreground framing ----------------
/** Lens blur per shot (thin lens). cInf = blur-disc radius in px at 1080x1920 for things at infinity; 0 = all sharp.
 *  Entries switch on cuts (no dur) or ramp with the camera glide they share f/dur with. focus = world point (else the
 *  camera look point). */
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 12 }, // hook CU: kids sharp, tank soft behind
  { f: 231, cInf: 0 }, // wide establishing, sharp
  { f: 550, cInf: 13, focus: () => ANCHOR }, // drip CU (12-14), focus on the drip on the near face
  { f: 778, cInf: 0 }, // tank creep, sharp
  { f: 1067, cInf: 0 }, // snap wide, sharp
  { f: 1357, cInf: 11, focus: () => [-1, D0 + 1.1, -6] }, // deadpan aftermath (10-12), focus on the trapped figures / train car
  { f: 1488, cInf: 15, focus: () => [0.55, D0 + 1.5, 0] }, // cold honey jar CU (15-16)
  { f: 1740, cInf: 0 }, // warm pour + wave slam, sharp
  { f: 1939, cInf: 12, focus: () => [2.0, D0 + 1.0, 0] }, // stamp CU, focus on the blueprint on the street table
  { f: 2151, cInf: 0 }, // rebuilt street wide, sharp
  { f: 2372, cInf: 7 }, // golden park, mild
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
/** what the lens focuses on (DOF): the DOF table's focus point, else the camera look point */
export const focusAt = (id: number, f: number): V3 => {
  const d = dofAt(f);
  return d.focus ? d.focus(f) : camAt(id, f).look;
};

/** near framing objects: visible while a <= f < b; kit = a GLB name accepted by build.ts prop() */
// pos = base point (prop()'s x, y, z: the model's base sits on y), s = height in metres (prop()'s h), yaw in radians.
// They sit at 0.3-0.5 x the focus distance and cover 10-25 % of one frame edge, never a face; they are meant to be
// in front of the lens, so build them outside prop()'s sight-line test.
export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [
  // ranges stay inside one shot (world.ts shows an entry only inside its own shot, so crossfade layers never see it).
  // All kit names are procedural props from build.ts (the Kenney kit is empty).
  // hook (S1a, focus ~11.9 m): a firewood pile in the bottom-right corner at ~3.6 m.
  { a: 0, b: 231, kit: "firewood", pos: [5.3, D0, 7.5], s: 1.0, yaw: 0.4 },
  // setting wide (S2a, focus ~51 m): a lamppost at the right edge, ~17 m out, on the cobbles.
  { a: 231, b: 550, kit: "lamppost", pos: [2.0, D0, -3.6], s: 3.5, yaw: 0 },
  // deadpan aftermath (S6a, focus ~10 m): a wagon wheel in the bottom-right corner at ~5 m, so the DOF blur keeps it a soft frame, not a blob.
  { a: 1357, b: 1488, kit: "wagonWheel", pos: [2.8, D0, -2.5], s: 0.8, yaw: 0.6 },
  // golden park (S9a/b, focus 7-9.5 m): a ballpark fence in the bottom-right corner, below the kids' play.
  { a: 2372, b: 2602, kit: "fence", pos: [69.65, D0, -79.4], s: 1.2, yaw: 0.4 },
];
