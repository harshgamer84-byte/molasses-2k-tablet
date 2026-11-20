// The whole place as one three.js scene: 1919 Boston North End, Commercial Street — sky, fog, clouds,
// the Purity Distilling tank (riveted brown steel, leaking, bursts at f 810), the molasses wave + flood,
// the Langone Park ballpark where the tank stood, honey-jar / blueprint inserts, chimney smoke and the cast.
// update(id, f, camera) poses everything for shot `id` at frame f (pure function of id + f).
// WORLD owner: world.ts, lights.ts, shade.ts, grade.ts in the molasses_world sandbox.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Batch, boxGeo, quad, V, lam, buildTown, prop, Kit, Ray, kitClone } from "./build";
import { beam, cobbleHD, grassHD, stoneHD, cloudHD, brickHD, ctex, rng, tankSteelHD, molassesHD, rep } from "./paint";
import { Pen } from "./toon";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, twoTone, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage, SU_SWING } from "./cast";
import { FPS, D0, SHOTS, PARK, camAt, smooth, FOREGROUND, V3, ShotDef } from "./story";
import type { BridgeState } from "./story";

// ---------------- assets ----------------
// KENNEY KIT STUB (molasses scaffold): world.ts used to load 26 Kenney CC0 kit GLBs
// (public/bridge/kenney/<name>.glb) via GLTFLoader + staticFile. No public/ folder ships with the skill
// templates and no GLB was ever downloaded, so there is nothing to load. loadKit therefore resolves
// immediately to an EMPTY kit: kitClone() in build.ts returns null for every GLB prop name and prop()
// skips it, so the world renders with procedural geometry only (painted houses, tank, ballpark, VEG cartoon
// plants, which are drawn in code and do not need the kit). When a Kenney kit is sourced later, restore
// the GLTFLoader version of loadKit and drop the GLBs into public/molasses/kenney/.
export const loadKit = (): Promise<Kit> => Promise.resolve({});

// ---------------- Boston set constants (shared layout) ----------------
// Tank: centre (0, D0, -30), 27.4 m diameter, 15.2 m tall (top y = D0 + 15.2). Near face at z = -16.3.
// Street centreline x = 0, z -55..+15; cobbles x -7..7, sidewalks to x +-10.
// Ballpark: centre PARK = [70, D0, -75].
const TANK = { x: 0, z: -30, r: 13.7, h: 15.2 };
const BURST_F = 1067; // shot 5: the tank rips open (t = 35.574 s, matching SNAP in story.ts)
const WAVE_END_F = 1357; // the wave reaches z = +15 at the end of shot 5
const FLOOD_F = 1357; // settled flood from shot 6 on
/** flood ends at f 2151: shot 8b (f 2151-2372) is the rebuilt street and must not be flooded */
const FLOOD_END_F = 2151;
/** shot 7b surge window (f 1740-1939): warm pour + wave slamming the south brick wall */
const SURGE_A_F = 1740, SURGE_B_F = 1939; // shot-7 beat cut: warm pour + wave slams the wall
/** cast.ts stage() still takes the bridge set's BridgeState; molasses crowds never use it — pass a zero one. */
const ZERO_B: BridgeState = { bounce: 0, drop: 0, snap: 0, collapsed: false };

/** sun disc (solid, soft rim) and the flat golden halo (lighting.md 6 / depth.md 6.4: r50 13-26 % of the frame width) */
const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const haloTex = () => ctex("sunHalo", 256, 256, (g) => {
  const im = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = Math.hypot(x - 127.5, y - 127.5) / 128;
    const a = (0.55 * Math.exp(-((u / 0.25) ** 2)) + 0.35 * Math.exp(-((u / 0.6) ** 2))) * (1 - Math.min(1, Math.max(0, (u - 0.8) / 0.2)));
    const i = (y * 256 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  g.putImageData(im, 0, 0);
});
/** per-shot sun override (lighting.md 9.1 notes: front-light the town wide); story.ts ShotDef sunAz/sunEl win if present */
// shot 2: az 135 (was 120) so the tank's camera-facing north side is lit in the establishing wide
const SUN_SHOT: Record<number, { az?: number; el?: number }> = { 2: { az: 135 } };
/** shot 4's "warmer day": a small sun-colour shift only (SHOT_PLAN.md) */
const WARM4 = new THREE.Color(1.05, 0.97, 0.88);
const smokeTex = () => ctex("smoke", 256, 256, (g) => {
  const p = new Pen(g);
  for (const [x, y, r, c] of [[90, 150, 60, "#8f8d96"], [150, 120, 70, "#a3a1aa"], [170, 165, 55, "#8f8d96"], [120, 100, 50, "#b4b2ba"]] as const) p.ell(x, y, r, r * 0.85, c, 0);
});

/** blueprint paper for the shot-8a stamp insert: blue sheet, tank elevation, title block, red APPROVED stamp */
const blueprintTex = () => ctex("blueprint", 512, 384, (g) => {
  g.fillStyle = "#2a4d8f"; g.fillRect(0, 0, 512, 384);
  g.strokeStyle = "rgba(255,255,255,0.14)"; g.lineWidth = 1;
  for (let x = 0; x <= 512; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 384); g.stroke(); }
  for (let y = 0; y <= 384; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
  g.strokeStyle = "#e8f0ff"; g.lineWidth = 3;
  g.strokeRect(70, 60, 300, 180); // tank elevation: shell + roof line
  g.beginPath(); g.arc(220, 150, 62, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(70, 240); g.lineTo(370, 240); g.stroke();
  for (let x = 90; x < 370; x += 28) { g.beginPath(); g.moveTo(x, 66); g.lineTo(x, 234); g.stroke(); } // rivet rows
  g.fillStyle = "#e8f0ff"; g.font = "bold 22px sans-serif";
  g.fillText("PURITY DISTILLING Co.", 70, 40);
  g.font = "16px sans-serif"; g.fillText("MOLASSES TANK — 90 FT DIA.", 70, 300);
  g.strokeStyle = "#e8f0ff"; g.lineWidth = 2; g.strokeRect(330, 296, 160, 68); // title block
  g.font = "13px sans-serif"; g.fillText("DRAWN 1915", 340, 320); g.fillText("SCALE 1:96", 340, 344);
  // the stamp: red ring + APPROVED, tilted, as if just pressed
  g.save(); g.translate(400, 130); g.rotate(-0.22);
  g.strokeStyle = "#d23b2e"; g.lineWidth = 6;
  g.beginPath(); g.arc(0, 0, 58, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 48, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#d23b2e"; g.font = "bold 21px sans-serif"; g.textAlign = "center";
  g.fillText("APPROVED", 0, 6);
  g.restore();
});

/** every lens position of the film looking at its subject: centre, sides and top of frame (houses there are left out) */
const sightLines = (): Ray[] => {
  const out: Ray[] = [];
  for (const s of SHOTS) for (let f = s.a - 8; f < s.b + 8; f += 2) {
    const c = camAt(s.id, Math.max(0, f)), o = V(...c.pos), look = V(...c.look);
    const fw = look.clone().sub(o), len = fw.length();
    fw.normalize();
    const rt = fw.clone().cross(V(0, 1, 0)).normalize(), up = rt.clone().cross(fw);
    const ty = Math.tan((c.fov * Math.PI) / 360), tx = ty * (9 / 16);
    for (const [sx, sy] of [[0, 0], [-0.6, 0], [0.6, 0], [0, 0.6], [0, -0.4]])
      out.push({ o, d: fw.clone().addScaledVector(rt, sx * tx).addScaledVector(up, sy * ty), len, core: sx === 0 && sy === 0 });
  }
  return out;
};

type Mats = Record<string, THREE.Material>;

/** small wooden table (top at local y 0.92): shared by the honey-jar and blueprint inserts */
const makeTable = (w: number, d: number, wood: THREE.Material) => {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), wood);
  top.position.y = 0.92; top.castShadow = true; top.receiveShadow = true; g.add(top);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.06), wood);
    leg.position.set(sx * (w / 2 - 0.06), 0.45, sz * (d / 2 - 0.06)); leg.castShadow = true; g.add(leg);
  }
  return g;
};

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private swing: Actor;
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight; private fill: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private sunDisc: THREE.Sprite; private sunHalo: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden", THREE.Texture[]>;
  private fgs: { o: THREE.Object3D; a: number; b: number }[] = [];
  private smoke: { m: THREE.Mesh; mat: THREE.MeshLambertMaterial; top: V3; k: number }[] = [];
  private clouds: THREE.Mesh[] = [];
  private southClouds: THREE.Sprite[] = [];
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();
  // ---- the tank ----
  private tankFull: THREE.Mesh; private rivets: THREE.InstancedMesh; private streaks: THREE.Group;
  private backShell: THREE.Mesh; private panelA: THREE.Group; private panelB: THREE.Group; private panelC: THREE.Group;
  private panelBAxis = new THREE.Vector3(); private panelCAxis = new THREE.Vector3();
  private spray: { m: THREE.Mesh; v: THREE.Vector3; s: number }[] = [];
  private sprayMat: THREE.MeshPhongMaterial;
  private popRivets: { mesh: THREE.Mesh; jet: THREE.Mesh; startF: number; origin: THREE.Vector3; vel: THREE.Vector3 }[] = [];
  // ---- wave + flood ----
  private molassesMat: THREE.Material;
  private waveFront: THREE.Mesh; private crest: THREE.Mesh; private crestBlobs: THREE.Mesh[] = [];
  private crestGlint: THREE.Mesh; private surgeGlint: THREE.Mesh; private waveDrips: THREE.Mesh[] = [];
  private surgeWave: THREE.Mesh; private surgeCrest: THREE.Mesh; private surgeWall: THREE.Mesh;
  private flood: THREE.Group;
  // ---- inserts + ballpark ----
  private honeyTable: THREE.Group; private honeyDrip: THREE.Mesh; private honeyPool: THREE.Mesh;
  private blueTable: THREE.Group;

  constructor(kit: Kit) {
    const R = this.root, M: Mats = {};
    // ---- sky + light ----
    // sky: 5 colour stops by elevation (textures.md 5.2 #5 + depth.md 2/6.5), written as tone-map-inverted linear values
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(1, 1, 1), fog: false, depthWrite: false, depthTest: true,
      transparent: true, blending: THREE.AdditiveBlending }));
    this.sunDisc.renderOrder = -0.5; this.sunHalo.renderOrder = 5;
    for (const m of [this.sunDisc, this.sunHalo]) { m.frustumCulled = false; m.layers.set(NOINK); R.add(m); }
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.fill = new THREE.DirectionalLight("#9fb8ff", 0.35);
    R.add(this.hemi, this.sun, this.sun.target, this.fill, this.fill.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)) };
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 130 + (i % 4) * 30;
      m.position.set(Math.cos(a) * d, 120 + (i % 4) * 38, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }
    // v2: three low clouds due south, near the jar/blueprint cameras' view axis (x ~0, z +170..240,
    // y 40-55, elevation ~10 deg) — those cameras look south at a low elevation and the ring clouds
    // mostly miss their narrow horizontal fov, so the sky read as empty blue. They are SPRITES
    // (the Mesh+lookAt version rendered as a tiny sliver in the jar frame). NOTE 2026-11-13: the
    // sprites render in shot 7b (verified f1400-now.jpg, top-left cloud) but NOT in shot 7a under
    // SwiftShader (--gl=swangle) — in-frame by NDC yet invisible, same as the sky sphere itself,
    // which also rasterises as a tiny triangle there. Possibly a SwiftShader rasterisation quirk
    // (the tablet's real GPU may render them fine); harmless either way (invisible in 7a, a real
    // cloud in 7b). frustumCulled=false, as the sun sprites need it too.
    for (const [cx, cy, cz, w] of [[-5, 45, 200, 140], [25, 55, 240, 180], [8, 40, 170, 120]] as const) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.cloudMaps.day[0], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      m.position.set(cx, cy, cz); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK); m.frustumCulled = false;
      this.southClouds.push(m); R.add(m);
    }

    // ---- ground (base only: the MAT owner's buildTown builds the street surface, tenements and
    // elevated railway over this; this sits 4-6 cm below D0 so it never z-fights with their street) ----
    // Dusty packed-earth tan, NOT green grass: the bright grassHD plane read as a lime-green void on
    // every horizon (look-check round 1, shots 1/2/7a/8a/8b). The ballpark keeps its own green parkGrass.
    const b = new Batch();
    M.grass = lam("groundDust", () => ({ color: "#8f7f60" }));
    M.cobble = lam("cobbleHD", () => ({ map: cobbleHD() }));
    M.sidewalk = lam("copeHD", () => ({ map: stoneHD("copeHD") }));
    M.wood = lam("wood", () => ({ map: beam() }));
    b.add(quadUp(-220, 220, -220, 220, 110, 110, -0.06), M.grass);
    b.add(quadUp(-7, 7, -55, 15, 3.5, 17.5, -0.04), M.cobble);
    b.add(quadUp(-10, -7, -55, 15, 0.75, 17.5, -0.045), M.sidewalk);
    b.add(quadUp(7, 10, -55, 15, 0.75, 17.5, -0.045), M.sidewalk);
    b.build(R);
    buildTown(R, kit, sightLines());

    // ---- south skyline (v2, shot 7a/8a background): the jar and blueprint cameras look south down
    // the street, and beyond the flood there was only dusty ground + pale sky. Low rooftops with
    // pyramid roofs + chimneys break the horizon so no large area is one flat colour. (Shot 7b's
    // surge looks south too: the houses peek above the brick wall, adding depth there as well.)
    const skyline = new THREE.Group();
    const skyR = rng(1919);
    const skyWall = lam("skylineWall", () => ({ color: "#a87a5e" })); // light warm walls: the north faces are in shade and #8a6a58 read as flat purple-grey silhouettes
    const skyRoof = lam("skylineRoof", () => ({ color: "#6a5248" }));
    for (let i = 0; i < 6; i++) {
      const w = 6 + skyR() * 5, h = 6 + skyR() * 4, x = -22 + i * 8.5 + skyR() * 3, z = 26 + skyR() * 8;
      const house = new THREE.Mesh(new THREE.BoxGeometry(w, h, 5), skyWall);
      house.position.set(x, D0 + h / 2, z); house.castShadow = true; skyline.add(house);
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, w * 0.62, 2.2, 4), skyRoof); // pyramid roof
      roof.position.set(x, D0 + h + 1.1, z); roof.rotation.y = Math.PI / 4; skyline.add(roof);
      const chim = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.5), skyRoof);
      chim.position.set(x + w * 0.25, D0 + h + 1.6, z); skyline.add(chim);
    }
    R.add(skyline);

    // ---- the molasses: glossy dark brown (MeshPhongMaterial, shininess ~80), a WALL not water ----
    // Created up here (before the tank) because the drip streaks on the tank face use it too.
    // The HD swirl texture (paint.ts molassesHD: slow swirls, glossy amber streaks, bubbles) was
    // painted in an earlier round but never wired in — the wave and flood read as one flat brown wall.
    // Three variants, all with the same warm shade override (the global two-tone shade is blue-violet
    // and the additive shade lift is blue-leaning; on molasses's near-black albedo the lift dominates
    // and the whole shadowed flood read as a flat purple sheet, round 3 shot 6 — molasses in shadow
    // stays warm dark brown; uniform values, not shader code, so the shared program is fine):
    // plain for the tank drips, swirl-mapped for the wave (2 m tiles), swirl-mapped for the
    // settled sheet (2 m tiles on the 24 x 33 m top face).
    const molassesPhong = (map?: THREE.Texture) => {
      const m = twoTone(new THREE.MeshPhongMaterial({ color: "#4a2c14", specular: "#b08a50", shininess: 110, side: THREE.DoubleSide, ...(map ? { map } : {}) })); // v2: specular #9a7a4a -> #b08a50, shininess 80 -> 110 (stronger wet sheen); lift raised so the swirls read in shade
      const molOBC = m.onBeforeCompile;
      m.onBeforeCompile = (sh, renderer) => {
        molOBC(sh, renderer);
        sh.uniforms.uShadeCol = { value: new THREE.Vector3(0.85, 0.5, 0.22) };
        sh.uniforms.uShadeLift = { value: new THREE.Vector3(0.10, 0.05, 0.02) };
      };
      return m;
    };
    this.molassesMat = molassesPhong();
    const molWaveTex = rep(molassesHD(), 9, 2); // 2 m tiles on the 18 m front face / top slope
    molWaveTex.wrapS = molWaveTex.wrapT = THREE.RepeatWrapping;
    const molassesWaveMat = molassesPhong(molWaveTex);
    const molSheetTex = rep(molassesHD(), 12, 16); // 2 m tiles on the 24 x 33 m flood sheet
    molSheetTex.wrapS = molSheetTex.wrapT = THREE.RepeatWrapping;
    const molassesSheetMat = molassesPhong(molSheetTex);

    // ---- the tank (hero object): brown-painted steel, rivet bands, drip streaks on the near face ----
    // Warm albedo + low two-tone lift (0.3): the two-tone shade is blue-violet, and the tank's camera-facing
    // side is at grazing sun in most shots — with the stock lift the brown went mauve-grey (still f200).
    // tankSteelHD (paint.ts: 6 x 3 m tile — plate seams, painted rivets, drip streaks, rust weep) was
    // painted in an earlier round but never wired in: the shell was one flat #8a5a30 gradient filling
    // ~70% of the frame in shots 3-4. 86 m circumference / 6 m = 14 tiles around, 15.2 m / 3 m = 5 up.
    // The 3D rivet studs stay: they give real relief over the painted rows. The torn shell / panels
    // (tankDS) keep a flat rusty-interior colour — the inside was unpainted.
    const tankTex = rep(tankSteelHD(), 14, 5);
    tankTex.wrapS = tankTex.wrapT = THREE.RepeatWrapping;
    const tankMat = twoTone(new THREE.MeshLambertMaterial({ map: tankTex }), 0.3);
    const tankDS = twoTone(new THREE.MeshLambertMaterial({ color: "#6a4526", side: THREE.DoubleSide }), 0.3);
    const tankDark = twoTone(new THREE.MeshLambertMaterial({ color: "#22150e" }), 0.3);
    const tankGroup = new THREE.Group();
    tankGroup.position.set(TANK.x, D0, TANK.z);
    R.add(tankGroup);
    this.tankFull = new THREE.Mesh(new THREE.CylinderGeometry(TANK.r, TANK.r, TANK.h, 48, 1, false), tankMat);
    this.tankFull.position.y = TANK.h / 2;
    this.tankFull.castShadow = true; this.tankFull.receiveShadow = true;
    tankGroup.add(this.tankFull);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(TANK.r, 0.22, 8, 48), tankDark);
    rim.rotation.x = Math.PI / 2; rim.position.y = TANK.h; rim.castShadow = true;
    tankGroup.add(rim);
    for (const y of [5, 10]) { // steel banding round the shell: darker, high relief
      const band = new THREE.Mesh(new THREE.TorusGeometry(TANK.r + 0.03, 0.16, 8, 48), tankDark);
      band.rotation.x = Math.PI / 2; band.position.y = y;
      tankGroup.add(band);
    }
    // rivet bands: instanced studs in horizontal rows round the shell (larger r 0.12 so relief is crisp)
    const rows = [1.2, 3.9, 6.6, 9.3, 12.0, 14.7], per = 56;
    this.rivets = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 8, 6), tankDark, rows.length * per);
    this.rivets.frustumCulled = false;
    rows.forEach((y, ri) => {
      for (let k = 0; k < per; k++) {
        const a = (k / per) * Math.PI * 2;
        this.rivets.setMatrixAt(ri * per + k, this.m4.makeTranslation((TANK.r + 0.02) * Math.sin(a), y, (TANK.r + 0.02) * Math.cos(a)));
      }
    });
    tankGroup.add(this.rivets);
    // drip streaks: dark brown runs below rivets near the base on the near (+z) face.
    // They use the glossy molasses material (was a plain dark Lambert #2e1c0c/#4a2c14: the hemi sky
    // tint made them read as blue bars). Wet molasses, warm brown with a specular sheen.
    const dripMat = this.molassesMat;
    this.streaks = new THREE.Group();
    // v2: 8 -> 15 runs off the y = 3.9 rivet row (varied widths) + a second shorter row off the
    // y = 6.6 row — shot 3's leak close-up reads on these as well as the base row
    for (const [x, len, w] of [[-6.5, 2.2, 0.14], [-5.4, 3.1, 0.1], [-4.2, 1.4, 0.14], [-3.3, 2.0, 0.08], [-2.4, 2.8, 0.14], [-1.6, 1.2, 0.1], [-0.9, 1.8, 0.14], [0.2, 2.9, 0.09], [0.8, 2.4, 0.14], [1.9, 1.3, 0.1], [2.6, 1.5, 0.14], [3.5, 2.2, 0.08], [4.4, 2.6, 0.14], [5.6, 1.9, 0.1], [6.2, 1.7, 0.14]] as const) {
      const z = Math.sqrt(TANK.r * TANK.r - x * x) + 0.03;
      const s = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.05), dripMat);
      s.position.set(x, 3.9 - len / 2, z);
      this.streaks.add(s);
    }
    for (const [x, len] of [[-5.8, 1.6], [-3.0, 1.1], [-0.2, 1.9], [3.0, 1.2], [5.2, 1.7]] as const) {
      const z = Math.sqrt(TANK.r * TANK.r - x * x) + 0.03;
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.1, len, 0.05), dripMat);
      s.position.set(x, 6.6 - len / 2, z);
      this.streaks.add(s);
    }
    for (const x of [-5.4, -2.4, 0.2, 0.8, 4.4]) { // a fat drip blob at the bottom of five streaks
      const z = Math.sqrt(TANK.r * TANK.r - x * x) + 0.05;
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), dripMat);
      d.scale.set(1, 1.7, 0.7); d.position.set(x, 1.15, z);
      this.streaks.add(d);
    }
    tankGroup.add(this.streaks);
    // popping rivets (frames 983, 1012, 1041 in Shot 4, leading up to the burst at 1067)
    const jetMat = new THREE.MeshPhongMaterial({ color: "#2e1c0c", specular: "#9a7a4a", shininess: 90, transparent: true, opacity: 0.88 });
    this.popRivets = [
      { startF: 983, origin: new THREE.Vector3(-1.8, D0 + 6.6, -16.3 + 0.1), vel: new THREE.Vector3(-2.2, 5.5, 12.0) },
      { startF: 1012, origin: new THREE.Vector3(2.4, D0 + 3.9, -16.3 + 0.1), vel: new THREE.Vector3(3.0, 6.2, 14.0) },
      { startF: 1041, origin: new THREE.Vector3(0.2, D0 + 9.3, -16.3 + 0.1), vel: new THREE.Vector3(0.8, 7.0, 16.0) },
    ].map((cfg) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), tankDark);
      mesh.castShadow = true; mesh.visible = false; R.add(mesh);
      const jet = new THREE.Mesh(new THREE.ConeGeometry(0.24, 2.4, 8), jetMat);
      jet.geometry.rotateX(Math.PI / 2); // point forward (+z towards street)
      jet.castShadow = true; jet.visible = false; R.add(jet);
      return { ...cfg, mesh, jet };
    });
    // burst panels: after f 810 the closed cylinder is hidden and the shell is the torn back
    // (theta 2.4..5.43) plus three curved panels that hinge outward and fall. The front panel is
    // NARROW (theta -0.4..0.4, 11 m arc, ~1.1 m crown when flat) so that, once down, it lies low in
    // the flood instead of hiding the whole aftermath street behind a 6 m curved wall (look-check
    // round 2, shot 6). The wide east/west panels tip out to the sides instead of forward.
    this.backShell = new THREE.Mesh(new THREE.CylinderGeometry(TANK.r, TANK.r, TANK.h, 24, 1, true, 2.4, 3.03), tankDS);
    this.backShell.position.y = TANK.h / 2;
    this.backShell.castShadow = true; this.backShell.receiveShadow = true; this.backShell.visible = false;
    tankGroup.add(this.backShell);
    this.panelA = new THREE.Group(); // front panel (theta -0.4..0.4), hinge on its bottom front edge
    this.panelA.position.set(0, 0, TANK.r);
    const geoA = new THREE.CylinderGeometry(TANK.r, TANK.r, TANK.h, 12, 1, true, -0.4, 0.8);
    geoA.translate(0, TANK.h / 2, -TANK.r);
    const meshA = new THREE.Mesh(geoA, tankDS);
    meshA.castShadow = true;
    this.panelA.add(meshA); this.panelA.visible = false;
    tankGroup.add(this.panelA);
    const thc = 1.4, hx = TANK.r * Math.sin(thc), hz = TANK.r * Math.cos(thc); // east panel (theta 0.4..2.4)
    this.panelB = new THREE.Group();
    this.panelB.position.set(hx, 0, hz);
    const geoB = new THREE.CylinderGeometry(TANK.r, TANK.r, TANK.h, 10, 1, true, 0.4, 2.0);
    geoB.translate(-hx, TANK.h / 2, -hz);
    const meshB = new THREE.Mesh(geoB, tankDS);
    meshB.castShadow = true;
    this.panelB.add(meshB); this.panelB.visible = false;
    tankGroup.add(this.panelB);
    this.panelBAxis.set(Math.cos(thc), 0, -Math.sin(thc)).normalize(); // bottom-edge tangent: top falls outward
    const thcC = -0.625, hxC = TANK.r * Math.sin(thcC), hzC = TANK.r * Math.cos(thcC); // west panel (theta -0.85..-0.4)
    this.panelC = new THREE.Group();
    this.panelC.position.set(hxC, 0, hzC);
    const geoC = new THREE.CylinderGeometry(TANK.r, TANK.r, TANK.h, 6, 1, true, -0.85, 0.45);
    geoC.translate(-hxC, TANK.h / 2, -hzC);
    const meshC = new THREE.Mesh(geoC, tankDS);
    meshC.castShadow = true;
    this.panelC.add(meshC); this.panelC.visible = false;
    tankGroup.add(this.panelC);
    this.panelCAxis.set(Math.cos(thcC), 0, -Math.sin(thcC)).normalize(); // bottom-edge tangent: top falls outward (west)
    // burst spray: brown blobs flung toward the street, fading out over ~3 s. Plain Phong, NOT
    // twoTone: the blue-violet two-tone shade made the blobs read as purple bubbles (round 2, shot 5).
    this.sprayMat = new THREE.MeshPhongMaterial({ color: "#5a3a20", specular: "#8a6a44", shininess: 60, transparent: true });
    const sprayGeo = new THREE.SphereGeometry(1, 10, 8), sr = rng(810);
    for (let i = 0; i < 14; i++) {
      const a = (sr() - 0.5) * 1.9;
      const v = new THREE.Vector3(Math.sin(a) * (6 + sr() * 8), 4 + sr() * 9, Math.cos(a) * (8 + sr() * 9));
      const m = new THREE.Mesh(sprayGeo, this.sprayMat);
      m.visible = false; R.add(m);
      this.spray.push({ m, v, s: 0.35 + sr() * 0.5 });
    }

    // ---- the molasses wave + flood (material created above, before the tank, for the drip streaks) ----
    // wave: unit-z wedge (back 1.0 m tall, front 4.5 m), stretched along z every frame as the front advances
    // FIXED: Use proper amber/molasses color with transparency and proper wave physics
    this.molassesWaveMat = new THREE.MeshPhysicalMaterial({
      color: 0xC46210, // Brighter, more realistic molasses amber
      roughness: 0.25,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      transmission: 0.6,
      thickness: 0.8,
      ior: 1.45,
      attenuationDistance: 0.3,
      attenuationColor: new THREE.Color(0x8B4513),
      envMapIntensity: 1.2,
      specularIntensity: 0.8,
      specularColor: new THREE.Color(0xF5DEB3),
    });
    
    const waveParts = [
      quad(V(-9, 0, 1), V(9, 0, 1), V(9, 4.5, 1), V(-9, 4.5, 1)), // front face (+z)
      quad(V(9, 0, 0), V(-9, 0, 0), V(-9, 1, 0), V(9, 1, 0)), // back face (-z)
      quad(V(-9, 4.5, 1), V(9, 4.5, 1), V(9, 1, 0), V(-9, 1, 0)), // top slope (faces up/back)
      quad(V(-9, 0, 0), V(-9, 0, 1), V(-9, 4.5, 1), V(-9, 1, 0)), // left flank
      quad(V(9, 0, 1), V(9, 0, 0), V(9, 1, 0), V(9, 4.5, 1)), // right flank
    ];
    this.waveFront = new THREE.Mesh(mergeGeometries(waveParts, false), this.molassesWaveMat);
    this.waveFront.castShadow = true; this.waveFront.receiveShadow = true; this.waveFront.visible = false;
    R.add(this.waveFront);
    this.crest = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 18.5, 12), this.molassesWaveMat);
    this.crest.rotation.z = Math.PI / 2; this.crest.castShadow = true; this.crest.visible = false;
    R.add(this.crest);
    
    // Add foam/bubbles on crest - animated foam particles
    this.crestFoam = new THREE.Group();
    for (let i = 0; i < 40; i++) {
      const foam = new THREE.Mesh(
        new THREE.SphereGeometry(0.15 + Math.random() * 0.1, 8, 8),
        new THREE.MeshPhysicalMaterial({
          color: 0xF5F5DC, // foam color
          transparent: true,
          opacity: 0.7,
          roughness: 0.2,
          metalness: 0,
          clearcoat: 1.0,
          clearcoatRoughness: 0.1,
        })
      );
      foam.position.set(
        (Math.random() - 0.5) * 18,
        0.5 + Math.random() * 0.5,
        (Math.random() - 0.5) * 0.5
      );
      foam.scale.setScalar(0.3 + Math.random() * 0.5);
      foam.userData = {
        originalY: foam.position.y,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 0.5
      };
      this.crestFoam.add(foam);
    }
    this.crestFoam.visible = false;
    R.add(this.crestFoam);
    // lumpy crest blobs riding the front — irregular sizes (r 0.9-1.8 m) so the crest line breaks
    // instead of reading as one straight roll (the old five identical r 0.9 blobs barely poked
    // 0.13 m above the crest top). x offsets + radii ride in userData for poseWave.
    for (const [bx, br] of [[-8, 1.5], [-5.5, 1.0], [-2.5, 1.8], [0, 0.9], [2.5, 1.3], [5.5, 1.6], [8, 1.1]] as const) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), this.molassesWaveMat);
      b.scale.set(br, 0.75 * br, br); b.castShadow = true; b.visible = false;
      b.userData.bx = bx; b.userData.br = br;
      this.crestBlobs.push(b); R.add(b);
    }
    // glossy highlight band along the crest's sunlit lip + drips hanging off the leading edge:
    // the crest reads as wet syrup catching the sun, and the front edge is no longer one hard line
    const glintMat = new THREE.MeshPhysicalMaterial({ 
      color: "#c8862a", 
      metalness: 0.1,
      roughness: 0.15,
      emissive: "#2e1c06",
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    });
    this.crestGlint = new THREE.Mesh(new THREE.BoxGeometry(17.5, 0.22, 0.5), glintMat);
    this.crestGlint.castShadow = true; this.crestGlint.visible = false;
    R.add(this.crestGlint);
    for (const dx of [-8, -5, -2, 1.5, 4.5, 7.5] as const) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), this.molassesWaveMat);
      d.scale.set(1, 1.9, 0.8); d.castShadow = true; d.visible = false;
      d.userData.dx = dx;
      this.waveDrips.push(d); R.add(d);
    }
    // ---- shot 7b surge (f 1305-1500 only): the same wave wedge + crest, re-surging against a
    // brick wall at the south end of the street (z = +7); the shot-5 wave above is untouched ----
    this.surgeWave = new THREE.Mesh(this.waveFront.geometry, molassesWaveMat);
    this.surgeWave.castShadow = true; this.surgeWave.receiveShadow = true; this.surgeWave.visible = false;
    R.add(this.surgeWave);
    this.surgeCrest = new THREE.Mesh(this.crest.geometry, molassesWaveMat);
    this.surgeCrest.rotation.z = Math.PI / 2; this.surgeCrest.scale.set(1, 0.55, 1); // shorter than the shot-5 crest (10 m, not 18.5 m): the wall shows on both sides. NB: length is local Y after the z-rotation.
    this.surgeCrest.castShadow = true; this.surgeCrest.visible = false;
    R.add(this.surgeCrest);
    this.surgeGlint = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.22, 0.5), glintMat); // same wet lip on the surge crest
    this.surgeGlint.castShadow = true; this.surgeGlint.visible = false;
    R.add(this.surgeGlint);
    const wallTex = brickHD().clone(); // brick courses on the surge wall (a clone: its repeat must not touch the cached texture the tenements use)
    wallTex.needsUpdate = true; wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping; wallTex.repeat.set(6.5, 1.5); // ~0.25 m bricks on the 26 x 6 m wall
    const brickMat = twoTone(lam("brickWall", () => ({ map: wallTex }))); // warm brick (was flat #7a4636 plain Lambert: read as a purple slab in shade)
    { // same warm-shade override as the molasses: shaded brick stays warm, not blue-violet.
      const wallShade = new THREE.Vector3(0.9, 0.55, 0.3);
      const wallLift = new THREE.Vector3(0.06, 0.03, 0.01);
      const wallOBC = brickMat.onBeforeCompile;
      brickMat.onBeforeCompile = (sh, renderer) => {
        wallOBC(sh, renderer);
        sh.uniforms.uShadeCol = { value: wallShade };
        sh.uniforms.uShadeLift = { value: wallLift };
      };
    }
    this.surgeWall = new THREE.Mesh(new THREE.BoxGeometry(26, 6, 0.6), brickMat); // wider + taller than the wave, so its top and edges show above/beside the surge (was 20 x 4.2: hidden behind the wave)
    this.surgeWall.position.set(0, D0 + 3, 7.3); // front face at z = +7.0, spanning the street
    this.surgeWall.castShadow = true; this.surgeWall.receiveShadow = true; this.surgeWall.visible = false;
    R.add(this.surgeWall);
    // ---- settled flood (shots 6-9): 2-3 ft deep glossy sheet over the street, with debris ----
    // Improved flood material with proper molasses appearance
    this.molassesFloodMat = new THREE.MeshPhysicalMaterial({
      color: 0x8B4513,
      roughness: 0.15,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      transmission: 0.8,
      thickness: 1.0,
      ior: 1.47,
      attenuationDistance: 0.2,
      attenuationColor: new THREE.Color(0x8B4513),
      envMapIntensity: 1.3,
      specularIntensity: 1.0,
      specularColor: new THREE.Color(0xFFE4B5),
    });
    
    this.flood = new THREE.Group();
    const sheet = new THREE.Mesh(boxGeo(V(-12, D0 - 0.1, -18), V(12, D0 + 0.75, 15)), this.molassesFloodMat);
    sheet.receiveShadow = true;
    this.flood.add(sheet);
    
    // Add foam/bubble clusters on the settled flood surface
    this.floodFoam = new THREE.Group();
    for (let i = 0; i < 50; i++) {
      const foam = new THREE.Mesh(
        new THREE.SphereGeometry(0.08 + Math.random() * 0.06, 8, 8),
        new THREE.MeshPhysicalMaterial({
          color: 0xF5F5DC,
          transparent: true,
          opacity: 0.8,
          roughness: 0.1,
          metalness: 0,
          clearcoat: 1.0,
          clearcoatRoughness: 0.05,
        })
      );
      foam.position.set(
        (Math.random() - 0.5) * 20,
        D0 + 0.73,
        -16 + Math.random() * 30
      );
      foam.scale.setScalar(0.4 + Math.random() * 0.4);
      foam.userData = {
        originalY: foam.position.y,
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.4
      };
      this.floodFoam.add(foam);
    }
    this.floodFoam.visible = false;
    this.flood.add(this.floodFoam);
    
    // Add bubble clusters on the settled flood surface
    const bubR = rng(1640);
    for (let i = 0; i < 30; i++) {
      const r = 0.08 + bubR() * 0.18;
      const b = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), this.molassesWaveMat);
      b.scale.y = 0.4;
      b.position.set(-10 + bubR() * 20, D0 + 0.71, -16 + bubR() * 28);
      b.castShadow = true;
      this.flood.add(b);
    }
    const wheel = new THREE.Group(); // tilted wagon wheel, half-sunk
    const rimW = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.07, 8, 20), tankDark);
    wheel.add(rimW);
    for (let k = 0; k < 6; k++) {
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.04, 6), M.wood);
      sp.rotation.z = (k * Math.PI) / 6; wheel.add(sp);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 10), tankDark);
    hub.rotation.x = Math.PI / 2; wheel.add(hub);
    wheel.position.set(3.5, D0 + 0.85, -6); wheel.rotation.set(0.4, 0.3, 1.15);
    wheel.traverse((o) => { o.castShadow = true; });
    this.flood.add(wheel);
    const car = new THREE.Group(); // tipped train car (shot-6 landmark), rolled ~32 deg off the tracks
    const carBody = lam("carBody", () => ({ color: "#7a3a28" }));
    const carRoof = lam("carRoof", () => ({ color: "#4a2c20" }));
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.4, 6), carBody);
    body.position.y = 1.2; car.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.25, 6.2), carRoof);
    roof.position.y = 2.5; car.add(roof);
    for (const [sx, sz] of [[-1.15, -2], [1.15, -2], [-1.15, 2], [1.15, 2]] as const) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.2, 12), tankDark);
      w.rotation.z = Math.PI / 2; w.position.set(sx, 0.45, sz); car.add(w);
    }
    car.position.set(-6, D0 + 0.55, -12); car.rotation.set(0, 0.15, 0.55);
    car.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
    this.flood.add(car);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.9, 12), M.wood);
    barrel.position.set(-2, D0 + 0.85, -2); barrel.rotation.z = 0.5; barrel.castShadow = true;
    this.flood.add(barrel);
    for (const [x, z, yaw] of [[5, 3, 0.7], [-5.5, 8, -0.4]] as const) {
      const pl = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 0.3), M.wood);
      pl.position.set(x, D0 + 0.78, z); pl.rotation.y = yaw; pl.castShadow = true;
      this.flood.add(pl);
    }
    // bubble clusters on the settled flood: small glossy domes half-sunk in the sheet top, so the
    // flood surface catches the light instead of reading as one flat brown plane
    const bubR2 = rng(1640);
    for (let i = 0; i < 10; i++) {
      const r = 0.12 + bubR2() * 0.22;
      const b = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), molassesWaveMat);
      b.scale.y = 0.55;
      b.position.set(-10 + bubR2() * 20, D0 + 0.72, -16 + bubR2() * 28);
      b.castShadow = true;
      this.flood.add(b);
    }
    const hat = new THREE.Group(); // a lost bowler hat floating in the flood (shot-6 storytelling detail)
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 14), tankDark);
    hat.add(brim);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), tankDark);
    crown.position.y = 0.01; hat.add(crown);
    hat.position.set(1.5, D0 + 0.78, 6); hat.rotation.set(0.1, 0.7, 0.08);
    hat.traverse((o) => { o.castShadow = true; });
    this.flood.add(hat);
    this.flood.visible = false;
    R.add(this.flood);

    // ---- shot 7a insert: honey jar on a small table at the S7a focus (0.55, D0+1.85, 0) ----
    this.honeyTable = new THREE.Group();
    this.honeyTable.position.set(0.55, D0, 0);
    this.honeyTable.add(makeTable(0.9, 0.6, M.wood));
    const honeyMat = twoTone(new THREE.MeshPhongMaterial({ color: "#c8862a", specular: "#ffd88a", shininess: 90 }));
    const glassMat = new THREE.MeshPhongMaterial({ color: "#e8c86a", transparent: true, opacity: 0.38, shininess: 120, specular: "#ffffff" });
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.34, 20, 1, true), glassMat);
    jar.position.set(0, 0.95 + 0.17, 0); this.honeyTable.add(jar);
    const jarBottom = new THREE.Mesh(new THREE.CircleGeometry(0.17, 20), glassMat);
    jarBottom.rotation.x = -Math.PI / 2; jarBottom.position.set(0, 0.96, 0); this.honeyTable.add(jarBottom);
    const honeyBody = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.24, 20), honeyMat);
    honeyBody.position.set(0, 0.95 + 0.15, 0); this.honeyTable.add(honeyBody);
    const honeyTop = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.02, 20), honeyMat);
    honeyTop.position.set(0, 0.95 + 0.28, 0); this.honeyTable.add(honeyTop);
    // the dipper was a thin dark stick that read as floating purple against the sky: thicker,
    // warm honey-wood, leaning on the jar rim so its tip touches the table. Warm shade override:
    // a thin stick in the global blue-violet two-tone shade reads as a purple bar.
    const dipperMat = twoTone(new THREE.MeshLambertMaterial({ color: "#8a5a28" }));
    {
      const dOBC = dipperMat.onBeforeCompile;
      dipperMat.onBeforeCompile = (sh, renderer) => {
        dOBC(sh, renderer);
        sh.uniforms.uShadeCol = { value: new THREE.Vector3(0.85, 0.5, 0.22) };
        sh.uniforms.uShadeLift = { value: new THREE.Vector3(0.06, 0.03, 0.01) };
      };
    }
    const dipper = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), dipperMat);
    dipper.position.set(-0.22, 1.12, 0.1); dipper.rotation.z = 0.5; dipper.rotation.x = -0.2;
    this.honeyTable.add(dipper);
    // secondary detail so the table isn't one flat brown plane: a folded cloth under the jar,
    // a spoon, and a few crumbs
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.4), lam("clothCream", () => ({ color: "#e8ddc4" })));
    cloth.position.set(0, 0.955, 0); cloth.rotation.y = 0.15; this.honeyTable.add(cloth);
    const spoon = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.015, 0.22), lam("spoonSteel", () => ({ color: "#b8bcc4" })));
    spoon.position.set(0.32, 0.96, -0.18); spoon.rotation.y = 0.5; this.honeyTable.add(spoon);
    const crumbMat = lam("crumb", () => ({ color: "#5a3a20" }));
    const crumbR = rng(77);
    for (let i = 0; i < 5; i++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), crumbMat);
      c.position.set(-0.3 + crumbR() * 0.6, 0.958, -0.2 + crumbR() * 0.35);
      this.honeyTable.add(c);
    }
    this.honeyDrip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), honeyMat); // cold honey oozing over the rim
    this.honeyDrip.position.set(0, 1.24, -0.17);
    this.honeyTable.add(this.honeyDrip);
    this.honeyPool = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), honeyMat);
    this.honeyPool.scale.set(1, 0.25, 1); this.honeyPool.position.set(0.32, 0.96, 0.12); // off the cloth, on bare wood
    this.honeyTable.add(this.honeyPool);
    this.honeyTable.traverse((o) => { o.castShadow = true; });
    this.honeyTable.visible = false;
    R.add(this.honeyTable);

    // ---- shot 8a insert: blueprint + stamp on a table at (2, D0, 0), facing the shot-8 camera ----
    this.blueTable = new THREE.Group();
    this.blueTable.position.set(2, D0, 0);
    this.blueTable.add(makeTable(1.0, 0.7, M.wood));
    const bp = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.6), new THREE.MeshBasicMaterial({ map: blueprintTex() }));
    bp.rotation.x = -Math.PI / 2; bp.rotation.z = Math.PI; // in-plane 180 deg: the texture top points south (toward the shot-8 camera), so the title reads the right way up (was upside-down)
    bp.position.set(0, 0.96, 0);
    this.blueTable.add(bp);
    const stamp = new THREE.Group(); // the stamp, just pressed, lying tilted beside the blueprint
    const stampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 14), lam("stampRed", () => ({ color: "#a83226" })));
    stamp.add(stampBase);
    const stampHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.16, 10), M.wood);
    stampHandle.position.y = 0.1; stamp.add(stampHandle);
    stamp.position.set(0.62, 0.97, 0.18); stamp.rotation.z = 0.45; // resting tilted on the table, base touching (was 1.25 rad, floating)
    this.blueTable.add(stamp);
    // a second sheet askew under the blueprint + a pencil, so the table isn't one flat plane
    const bp2 = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.45), new THREE.MeshBasicMaterial({ map: blueprintTex() }));
    bp2.rotation.x = -Math.PI / 2; bp2.rotation.z = Math.PI + 0.35;
    bp2.position.set(-0.15, 0.955, -0.05);
    this.blueTable.add(bp2);
    const pencil = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 6), lam("pencilYellow", () => ({ color: "#e8a83a" })));
    pencil.rotation.z = Math.PI / 2; pencil.rotation.y = 0.4; pencil.position.set(0.1, 0.96, 0.32);
    this.blueTable.add(pencil);
    this.blueTable.traverse((o) => { o.castShadow = true; });
    this.blueTable.visible = false;
    R.add(this.blueTable);

    // ---- Langone Park ballpark (shot 9): grass diamond, backstop, bench, trees at the edges ----
    const parkGrass = lam("parkGrass", () => ({ map: grassHD() }));
    const dirt = lam("parkDirt", () => ({ color: "#b08a5a" }));
    const outfield = new THREE.Mesh(new THREE.CircleGeometry(28, 40), parkGrass);
    outfield.rotation.x = -Math.PI / 2; outfield.position.set(PARK[0], D0 + 0.02, PARK[2]);
    outfield.receiveShadow = true;
    R.add(outfield);
    const infieldGeo = new THREE.PlaneGeometry(10.6, 10.6);
    infieldGeo.rotateZ(Math.PI / 4); infieldGeo.rotateX(-Math.PI / 2);
    const infield = new THREE.Mesh(infieldGeo, dirt);
    infield.position.set(PARK[0], D0 + 0.03, PARK[2]); infield.receiveShadow = true;
    R.add(infield);
    const mound = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 10), dirt);
    mound.scale.set(1, 0.18, 1); // flatter: at 0.28 the violet-blue golden-hour shade made it read as a puddle mound.position.set(PARK[0], D0 + 0.03, PARK[2]);
    R.add(mound);
    const plateMat = lam("parkPlate", () => ({ color: "#f2eee2" }));
    const home = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 0.45), plateMat);
    home.position.set(PARK[0], D0 + 0.05, PARK[2] + 7.5);
    R.add(home);
    for (const [bx, bz] of [[7.5, 0], [0, -7.5], [-7.5, 0]] as const) {
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.4), plateMat);
      base.position.set(PARK[0] + bx, D0 + 0.05, PARK[2] + bz);
      R.add(base);
    }
    const fenceMat = new THREE.MeshLambertMaterial({ color: "#9aa0a8", transparent: true, opacity: 0.22, side: THREE.DoubleSide });
    const backstop = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 3, 16, 1, true, -0.9, 1.8), fenceMat);
    backstop.position.set(PARK[0], D0 + 1.5, PARK[2] + 7.5);
    R.add(backstop);
    for (let k = 0; k <= 4; k++) {
      const a = -0.9 + (k * 1.8) / 4;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 8), tankDark);
      post.position.set(PARK[0] + 7 * Math.sin(a), D0 + 1.5, PARK[2] + 7.5 + 7 * Math.cos(a));
      R.add(post);
    }
    const bench = new THREE.Group(); // wooden bench facing the diamond
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.45), M.wood);
    seat.position.y = 0.45; bench.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.06), M.wood);
    back.position.set(0, 0.8, -0.2); bench.add(back);
    for (const sx of [-0.8, 0.8] as const) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.4), M.wood);
      leg.position.set(sx, 0.22, 0); bench.add(leg);
    }
    bench.position.set(PARK[0] - 9, D0, PARK[2] + 5); bench.rotation.y = -Math.PI / 2;
    bench.traverse((o) => { o.castShadow = true; });
    R.add(bench);
    const pb = new Batch(); // trees + bushes ringing the park (procedural VEG, kit-independent)
    for (const [x, z, h, name] of [
      [PARK[0] - 30, PARK[2] - 18, 9, "tree_oak"], [PARK[0] + 28, PARK[2] - 20, 8, "tree_fat"],
      [PARK[0] - 26, PARK[2] + 16, 9.5, "tree_detailed"], [PARK[0] + 30, PARK[2] + 14, 8.5, "tree_default"],
      [PARK[0] + 6, PARK[2] - 32, 10, "tree_oak"], [PARK[0] - 8, PARK[2] + 30, 9, "tree-high-round"],
    ] as const) prop(pb, kit, name, x, D0, z, h, x);
    for (const [x, z] of [[PARK[0] + 12, PARK[2] + 10], [PARK[0] - 12, PARK[2] + 11], [PARK[0] + 16, PARK[2] - 6]] as const)
      prop(pb, kit, "plant_bushDetailed", x, D0, z, 1.2);
    pb.build(R);

    // chimney smoke over the tenement rows (positions are guesses at chimney tops: the MAT owner's
    // buildTown may move the chimneys; the columns are cheap to re-aim)
    const smokeT = smokeTex();
    for (const [top, n] of [[[-18, D0 + 10.5, -35], 7], [[19, D0 + 11, 8], 6]] as const)
      for (let k = 0; k < n; k++) {
        const mat = new THREE.MeshLambertMaterial({ map: smokeT, transparent: true, depthWrite: false });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
        m.layers.set(NOINK);
        this.smoke.push({ m, mat, top: top as unknown as V3, k: k / n }); R.add(m);
      }
    this.swing = new Actor(R, swingGeo);
    // the CAM agent's near framing objects: built once, never passed through the sight-line filter, toggled per frame
    for (const fg of FOREGROUND) {
      const o = kitClone(kit, fg.kit, fg.s ?? 1);
      if (!o) continue;
      o.position.set(...fg.pos); o.rotation.y = fg.yaw ?? 0; o.visible = false;
      this.fgs.push({ o, a: fg.a, b: fg.b }); R.add(o);
    }
  }

  /** camera-relative sun, frozen per shot: the shot's mean view direction turned by az toward screen right, lifted by el */
  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const ss = s as ShotDef & { sunAz?: number; sunEl?: number };
    const az = THREE.MathUtils.degToRad(ss.sunAz ?? SUN_SHOT[id]?.az ?? L.az), el = THREE.MathUtils.degToRad(ss.sunEl ?? SUN_SHOT[id]?.el ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az); // screen right = (-fz, fx)
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  /** tank: closed cylinder + rivets + drips before the burst; torn back shell + two falling panels + spray after */
  private poseTank(f: number) {
    const burst = f >= BURST_F;
    this.tankFull.visible = !burst;
    this.rivets.visible = !burst;
    this.streaks.visible = !burst;
    this.backShell.visible = burst;
    this.panelA.visible = burst;
    this.panelB.visible = burst;
    this.panelC.visible = burst;

    // animate popping rivets during Shot 4 (leading up to burst at BURST_F)
    for (const pop of this.popRivets) {
      if (f >= pop.startF && f < BURST_F + 30) {
        pop.mesh.visible = true;
        const dt = (f - pop.startF) / FPS;
        pop.mesh.position.set(
          pop.origin.x + pop.vel.x * dt,
          Math.max(D0 + 0.1, pop.origin.y + pop.vel.y * dt - 4.9 * dt * dt),
          pop.origin.z + pop.vel.z * dt
        );
        pop.mesh.rotation.x = f * 0.4; pop.mesh.rotation.y = f * 0.3;
        // molasses pressure jet shooting from hole
        pop.jet.visible = f < BURST_F;
        if (pop.jet.visible) {
          const jetLen = Math.min(2.5, 0.4 + dt * 5.0);
          pop.jet.position.set(pop.origin.x, pop.origin.y, pop.origin.z + jetLen * 0.4);
          pop.jet.scale.set(1 + Math.sin(f * 0.5) * 0.25, 1 + Math.sin(f * 0.5) * 0.25, jetLen / 2.4);
        }
      } else {
        pop.mesh.visible = false;
        pop.jet.visible = false;
      }
    }

    if (!burst) {
      for (const s of this.spray) s.m.visible = false;
      return;
    }
    const u = smooth((f - BURST_F) / 30); // panels hinge out and fall over 1 s, then lie still
    this.panelA.rotation.x = u * 1.5; // front panel falls forward onto the street (top lands near z = -1)
    // The fallen front panel sinks under the flood as the molasses settles (after burst):
    this.panelA.position.y = -0.6 * smooth((f - (BURST_F + 90)) / 120);
    this.panelB.quaternion.setFromAxisAngle(this.panelBAxis, u * 1.35); // east panel tips outward to the side
    this.panelC.quaternion.setFromAxisAngle(this.panelCAxis, u * 1.35); // west panel tips outward to the side
    const dt = (f - BURST_F) / FPS;
    this.sprayMat.opacity = f < BURST_F + 30 ? 1 : 1 - smooth((f - (BURST_F + 30)) / 60);
    for (const s of this.spray) {
      s.m.visible = f < BURST_F + 90;
      if (!s.m.visible) continue;
      s.m.position.set(s.v.x * dt, D0 + Math.max(0.4, 5 + s.v.y * dt - 4.9 * dt * dt), -18 + s.v.z * dt);
      s.m.scale.setScalar(s.s * (1 + Math.min(1, dt * 2)));
    }
  }

  /** wave: leading edge advances z -16 -> +15 over shot 5 (f 810-1020), 4.5 m tall at the front, tapering behind */
  private poseWave(f: number) {
    const on = f >= BURST_F && f < WAVE_END_F;
    this.waveFront.visible = on; this.crest.visible = on; this.crestGlint.visible = on;
    for (const b of this.crestBlobs) b.visible = on;
    for (const d of this.waveDrips) d.visible = on;
    if (on) {
      const u = smooth((f - BURST_F) / (WAVE_END_F - BURST_F));
      const frontZ = -16 + 31 * u, backZ = -16 - 1.5 * u;
      this.waveFront.scale.z = Math.max(0.01, frontZ - backZ);
      this.waveFront.position.set(0, D0, backZ);
      this.crest.position.set(0, D0 + 4.4, frontZ - 0.4);
      this.crestGlint.position.set(0, D0 + 4.95, frontZ + 0.05); // rides the crest's front-top edge
      this.crestBlobs.forEach((b, i) => {
        const br = (b.userData.br as number) ?? 1;
        b.position.set((b.userData.bx as number) ?? -7 + i * 3.5, D0 + 4.5 + 0.6 * br + 0.15 * Math.sin(f * 0.12 + i * 1.7), frontZ - 0.7);
      });
      this.waveDrips.forEach((d, i) => {
        d.position.set((d.userData.dx as number) ?? 0, D0 + 3.9 + 0.12 * Math.sin(f * 0.15 + i * 1.3), frontZ + 0.15);
      });
      
      // Animate crest foam
      if (this.crestFoam) {
        this.crestFoam.visible = on;
        this.crestFoam.children.forEach((foam) => {
          const ud = foam.userData;
          foam.position.y = ud.originalY + Math.sin(f * 0.08 * ud.speed + ud.phase) * 0.15;
          foam.rotation.y += 0.02 * ud.speed;
        });
      }
      
      // Animate flood foam
      if (this.floodFoam) {
        this.floodFoam.visible = f >= 1020;
        this.floodFoam.children.forEach((foam) => {
          const ud = foam.userData;
          foam.position.y = ud.originalY + Math.sin(f * 0.05 * ud.speed + ud.phase) * 0.08;
          foam.rotation.y += 0.015 * ud.speed;
        });
      }
    }

    // shot 7b surge only: the wedge re-surges south and slams the brick wall at z = +7 —
    // front advances z -2 -> +7 over f 1305-1500, piling up ~25% taller as it hits the wall
    const on7b = f >= SURGE_A_F && f < SURGE_B_F;
    this.surgeWave.visible = on7b; this.surgeCrest.visible = on7b; this.surgeWall.visible = on7b; this.surgeGlint.visible = on7b;
    if (on7b) {
      const u = smooth((f - SURGE_A_F) / (SURGE_B_F - SURGE_A_F));
      const frontZ = -2 + 9 * u, backZ = frontZ - (3 + 6 * u), lift = 1 + 0.25 * u;
      this.surgeWave.scale.set(0.55, lift, Math.max(0.01, frontZ - backZ)); // 10 m wide, not 18 m: the brick wall shows on both sides of the surge
      this.surgeWave.position.set(0, D0, backZ);
      this.surgeCrest.position.set(0, D0 + 4.5 * lift - 0.1, frontZ - 0.4);
      this.surgeGlint.position.set(0, D0 + 4.5 * lift + 0.45, frontZ + 0.05);
    }
  }

  /** inserts: honey jar only in shot 7a, blueprint only in shot 8a; the drip/pool ooze slowly during 7a */
  private poseProps(f: number) {
    this.flood.visible = f >= FLOOD_F && f < FLOOD_END_F; // shots 6, 7, 8a only — hidden for 8b/9
    this.honeyTable.visible = f >= 1488 && f < 1740;
    if (this.honeyTable.visible) {
      const u = smooth((f - 1488) / 252);
      this.honeyDrip.scale.set(1, 1 + 1.4 * u, 1);
      this.honeyDrip.position.y = 1.24 - 0.07 * u;
      this.honeyPool.scale.set(0.6 + 0.7 * u, 0.25, 0.6 + 0.7 * u);
    }
    this.blueTable.visible = f >= 1939 && f < 2151;
  }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light];
    // ---- camera ----
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.2; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK); // sky, clouds, smoke and sun sprites live on the no-ink layer but are still rendered
    // ---- light rig (lighting.md 9.4): camera-relative sun frozen per shot, two-tone uniforms, shadow fit ----
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    if (id === 4) this.sun.color.multiply(WARM4); // shot 4's warmer day
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 12, 95);
    if (s.light === "golden") Rr = Math.max(Rr, 30); // el 7: 2 m cards throw ~16 m shadows, houses much longer
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    this.fill.intensity = 0; // not used by the two-tone shading
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...LOOK[s.light].bounce); TONE.uSat.value = LOOK[s.light].sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- sky, fog (colour = horizon colour, linear fogNear -> fogFar), sun disc + halo, clouds ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;
    const showSun = s.light === "golden";
    this.sunDisc.visible = this.sunHalo.visible = showSun;
    if (showSun) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900);
      this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7)));
      this.sunHalo.position.copy(this.sunDisc.position); this.sunHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(24)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(1.3);
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i], mat = m.material as THREE.MeshBasicMaterial;
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      mat.map = this.cloudMaps[s.light][i % 4];
    }
    // south clouds are Sprites: they face the camera in-shader, no lookAt; only the map swaps per shot.
    for (let i = 0; i < this.southClouds.length; i++) {
      (this.southClouds[i].material as THREE.SpriteMaterial).map = this.cloudMaps[s.light][(i + 9) % 4];
    }
    // ---- foreground framing objects: inside their frames AND their own shot (so a crossfade layer never shows them) ----
    for (const g of this.fgs) g.o.visible = f >= g.a && f < g.b && g.a < s.b && g.b > s.a;
    // ---- Boston set ----
    this.poseTank(f);
    this.poseWave(f);
    this.poseProps(f);
    for (const sm of this.smoke) {
      const u = (t * 0.11 + sm.k) % 1, sz = 3 + u * 9;
      sm.m.position.set(sm.top[0] - u * 18, sm.top[1] + u * 13 + u * u * 4, sm.top[2] + u * 3);
      sm.m.scale.set(sz, sz, 1); sm.m.quaternion.copy(cam.quaternion);
      sm.mat.opacity = 0.85 * (1 - u) ** 1.2;
    }
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, t, ZERO_B, { pos: cam.position, right });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const tint = s.light === "golden" ? "#ffcf9e" : "#ffffff";
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (p.geo !== "swing" && !this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5))) continue;
      const a = p.geo === "swing" ? this.swing : this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      if (a.mat.emissiveMap) a.mat.emissive.set(tint); // legacy emissive card until the CHAR agent's cardShade lands
      a.mesh.castShadow = p.geo === "swing" ? true : L.actorShadow; // day: soft contact blobs instead (CHAR agent)
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    if (!used.includes(this.swing)) this.swing.mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const e = this.fx(fi++);
      e.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e.use(!!p.soft);
      e.mesh.visible = true;
      e.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { e.mesh.quaternion.copy(cam.quaternion); e.mesh.rotateZ(p.rot ?? 0); }
      e.mesh.scale.set(p.w, p.h, 1);
      fused.push(e);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e of fused) e.bind();
    return focus;
  }
}

const swingGeo = (() => { const g = new THREE.PlaneGeometry(700 * SU_SWING, 2300 * SU_SWING); g.translate(0, -(1150 - 20) * SU_SWING, 0); return g; })();
/** horizontal quad facing up at height D0 + dy covering x0..x1, z0..z1 (z0 < z1) */
function quadUp(x0: number, x1: number, z0: number, z1: number, u: number, v: number, dy = 0) {
  const y = D0 + dy, g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, 0, u, v, 0, v], 2));
  return g;
}
