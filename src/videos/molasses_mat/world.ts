// The whole place as one three.js scene: 1919 Boston North End, Commercial Street — sky, fog, clouds,
// the Purity Distilling tank (riveted brown steel, leaking, bursts at f 810), the molasses wave + flood,
// the Langone Park ballpark where the tank stood, honey-jar / blueprint inserts, chimney smoke and the cast.
// update(id, f, camera) poses everything for shot `id` at frame f (pure function of id + f).
// WORLD owner: world.ts, lights.ts, shade.ts, grade.ts in the molasses_world sandbox.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Batch, boxGeo, quad, V, lam, buildTown, prop, Kit, Ray, kitClone } from "./build";
import { beam, cobbleHD, grassHD, stoneHD, cloudHD, brickHD, ctex, rng } from "./paint";
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
const BURST_F = 810; // shot 5: the tank rips open (t = 27.0 s)
const WAVE_END_F = 1020; // the wave's leading edge reaches z = +15 at the end of shot 5
const FLOOD_F = 1020; // settled flood from shot 6 on
/** flood ends at f 1640: shot 8b (f 1640-1785) is the rebuilt street and must not be flooded */
const FLOOD_END_F = 1640;
/** shot 7b surge window (f 1305-1500): warm pour + wave slamming the south brick wall */
const SURGE_A_F = 1326, SURGE_B_F = 1500; // shot-7 beat cut moved 1305 -> 1326 by CAM (lands 3 f before "warm")
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
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();
  // ---- the tank ----
  private tankFull: THREE.Mesh; private rivets: THREE.InstancedMesh; private streaks: THREE.Group;
  private backShell: THREE.Mesh; private panelA: THREE.Group; private panelB: THREE.Group; private panelC: THREE.Group;
  private panelBAxis = new THREE.Vector3(); private panelCAxis = new THREE.Vector3();
  private spray: { m: THREE.Mesh; v: THREE.Vector3; s: number }[] = [];
  private sprayMat: THREE.MeshPhongMaterial;
  // ---- wave + flood ----
  private molassesMat: THREE.Material;
  private waveFront: THREE.Mesh; private crest: THREE.Mesh; private crestBlobs: THREE.Mesh[] = [];
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

    // ---- the molasses: glossy dark brown (MeshPhongMaterial, shininess ~80), a WALL not water ----
    // Created up here (before the tank) because the drip streaks on the tank face use it too.
    this.molassesMat = twoTone(new THREE.MeshPhongMaterial({ color: "#4a2c14", specular: "#9a7a4a", shininess: 80, side: THREE.DoubleSide }));
    { // per-material shade override: the global two-tone shade is blue-violet and the additive shade
      // lift is blue-leaning (day lift [0.05, 0.06, 0.11]); on molasses's near-black albedo the lift
      // dominates and the whole shadowed flood read as a flat purple sheet (round 3, shot 6).
      // Molasses in shadow stays warm dark brown. (Uniform values, not shader code, so the shared program is fine.)
      const molShade = new THREE.Vector3(0.85, 0.5, 0.22);
      const molLift = new THREE.Vector3(0.06, 0.03, 0.01);
      const molOBC = this.molassesMat.onBeforeCompile;
      this.molassesMat.onBeforeCompile = (sh, renderer) => {
        molOBC(sh, renderer);
        sh.uniforms.uShadeCol = { value: molShade };
        sh.uniforms.uShadeLift = { value: molLift };
      };
    }

    // ---- the tank (hero object): brown-painted steel, rivet bands, drip streaks on the near face ----
    // Warm albedo + low two-tone lift (0.3): the two-tone shade is blue-violet, and the tank's camera-facing
    // side is at grazing sun in most shots — with the stock lift the brown went mauve-grey (still f200).
    const tankMat = twoTone(new THREE.MeshLambertMaterial({ color: "#8a5a30" }), 0.3);
    const tankDS = twoTone(new THREE.MeshLambertMaterial({ color: "#8a5a30", side: THREE.DoubleSide }), 0.3);
    const tankDark = twoTone(new THREE.MeshLambertMaterial({ color: "#5a3a20" }), 0.3);
    const tankGroup = new THREE.Group();
    tankGroup.position.set(TANK.x, D0, TANK.z);
    R.add(tankGroup);
    this.tankFull = new THREE.Mesh(new THREE.CylinderGeometry(TANK.r, TANK.r, TANK.h, 48, 1, false), tankMat);
    this.tankFull.position.y = TANK.h / 2;
    this.tankFull.castShadow = true; this.tankFull.receiveShadow = true;
    tankGroup.add(this.tankFull);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(TANK.r, 0.18, 8, 48), tankDark);
    rim.rotation.x = Math.PI / 2; rim.position.y = TANK.h; rim.castShadow = true;
    tankGroup.add(rim);
    for (const y of [5, 10]) { // steel banding round the shell
      const band = new THREE.Mesh(new THREE.TorusGeometry(TANK.r + 0.02, 0.12, 8, 48), tankDark);
      band.rotation.x = Math.PI / 2; band.position.y = y;
      tankGroup.add(band);
    }
    // rivet bands: instanced studs in horizontal rows round the shell
    const rows = [1.2, 3.9, 6.6, 9.3, 12.0, 14.7], per = 56;
    this.rivets = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 6, 5), tankDark, rows.length * per);
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
    for (const [x, len] of [[-6.5, 2.2], [-4.2, 1.4], [-2.4, 2.8], [-0.9, 1.8], [0.8, 2.4], [2.6, 1.5], [4.4, 2.6], [6.2, 1.7]] as const) {
      const z = Math.sqrt(TANK.r * TANK.r - x * x) + 0.03;
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.14, len, 0.05), dripMat);
      s.position.set(x, 3.9 - len / 2, z);
      this.streaks.add(s);
    }
    for (const x of [-2.4, 0.8, 4.4]) { // a fat drip blob at the bottom of three streaks
      const z = Math.sqrt(TANK.r * TANK.r - x * x) + 0.05;
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), dripMat);
      d.scale.set(1, 1.7, 0.7); d.position.set(x, 1.15, z);
      this.streaks.add(d);
    }
    tankGroup.add(this.streaks);
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
    const waveParts = [
      quad(V(-9, 0, 1), V(9, 0, 1), V(9, 4.5, 1), V(-9, 4.5, 1)), // front face (+z)
      quad(V(9, 0, 0), V(-9, 0, 0), V(-9, 1, 0), V(9, 1, 0)), // back face (-z)
      quad(V(-9, 4.5, 1), V(9, 4.5, 1), V(9, 1, 0), V(-9, 1, 0)), // top slope (faces up/back)
      quad(V(-9, 0, 0), V(-9, 0, 1), V(-9, 4.5, 1), V(-9, 1, 0)), // left flank
      quad(V(9, 0, 1), V(9, 0, 0), V(9, 1, 0), V(9, 4.5, 1)), // right flank
    ];
    this.waveFront = new THREE.Mesh(mergeGeometries(waveParts, false), this.molassesMat);
    this.waveFront.castShadow = true; this.waveFront.receiveShadow = true; this.waveFront.visible = false;
    R.add(this.waveFront);
    this.crest = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 18.5, 12), this.molassesMat);
    this.crest.rotation.z = Math.PI / 2; this.crest.castShadow = true; this.crest.visible = false;
    R.add(this.crest);
    for (let i = 0; i < 5; i++) { // lumpy crest blobs riding the front
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), this.molassesMat);
      b.scale.set(1, 0.75, 1); b.castShadow = true; b.visible = false;
      this.crestBlobs.push(b); R.add(b);
    }
    // ---- shot 7b surge (f 1305-1500 only): the same wave wedge + crest, re-surging against a
    // brick wall at the south end of the street (z = +7); the shot-5 wave above is untouched ----
    this.surgeWave = new THREE.Mesh(this.waveFront.geometry, this.molassesMat);
    this.surgeWave.castShadow = true; this.surgeWave.receiveShadow = true; this.surgeWave.visible = false;
    R.add(this.surgeWave);
    this.surgeCrest = new THREE.Mesh(this.crest.geometry, this.molassesMat);
    this.surgeCrest.rotation.z = Math.PI / 2; this.surgeCrest.scale.set(1, 0.55, 1); // shorter than the shot-5 crest (10 m, not 18.5 m): the wall shows on both sides. NB: length is local Y after the z-rotation.
    this.surgeCrest.castShadow = true; this.surgeCrest.visible = false;
    R.add(this.surgeCrest);
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
    this.flood = new THREE.Group();
    const sheet = new THREE.Mesh(boxGeo(V(-12, D0 - 0.1, -18), V(12, D0 + 0.75, 15)), this.molassesMat);
    sheet.receiveShadow = true;
    this.flood.add(sheet);
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
    const dipper = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), M.wood);
    dipper.position.set(-0.2, 1.15, 0.12); dipper.rotation.z = 0.35; dipper.rotation.x = -0.2;
    this.honeyTable.add(dipper);
    this.honeyDrip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), honeyMat); // cold honey oozing over the rim
    this.honeyDrip.position.set(0, 1.24, -0.17);
    this.honeyTable.add(this.honeyDrip);
    this.honeyPool = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), honeyMat);
    this.honeyPool.scale.set(1, 0.25, 1); this.honeyPool.position.set(0.24, 0.96, 0.1);
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
    if (!burst) {
      for (const s of this.spray) s.m.visible = false;
      return;
    }
    const u = smooth((f - BURST_F) / 30); // panels hinge out and fall over 1 s, then lie still (was /75: at f 850 the front panel still filled the frame mid-fall)
    this.panelA.rotation.x = u * 1.5; // front panel falls forward onto the street (top lands near z = -1)
    // The fallen front panel sinks under the flood as the molasses settles (f 900-1020): its 1.1 m
    // crown would otherwise hide the trapped figures behind it in shot 6 (round 4). Sunk 0.6 m, the
    // crown sits at D0+0.55, under the flood top (D0+0.75), so the figures read again.
    this.panelA.position.y = -0.6 * smooth((f - 900) / 120);
    this.panelB.quaternion.setFromAxisAngle(this.panelBAxis, u * 1.35); // east panel tips outward to the side
    this.panelC.quaternion.setFromAxisAngle(this.panelCAxis, u * 1.35); // west panel tips outward to the side
    const dt = (f - BURST_F) / FPS;
    this.sprayMat.opacity = f < 840 ? 1 : 1 - smooth((f - 840) / 60);
    for (const s of this.spray) {
      s.m.visible = f < 900;
      if (!s.m.visible) continue;
      s.m.position.set(s.v.x * dt, D0 + Math.max(0.4, 5 + s.v.y * dt - 4.9 * dt * dt), -18 + s.v.z * dt);
      s.m.scale.setScalar(s.s * (1 + Math.min(1, dt * 2)));
    }
  }

  /** wave: leading edge advances z -16 -> +15 over shot 5 (f 810-1020), 4.5 m tall at the front, tapering behind */
  private poseWave(f: number) {
    const on = f >= BURST_F && f < WAVE_END_F;
    this.waveFront.visible = on; this.crest.visible = on;
    for (const b of this.crestBlobs) b.visible = on;
    if (on) {
      const u = smooth((f - BURST_F) / (WAVE_END_F - BURST_F));
      const frontZ = -16 + 31 * u, backZ = -16 - 1.5 * u;
      this.waveFront.scale.z = Math.max(0.01, frontZ - backZ);
      this.waveFront.position.set(0, D0, backZ);
      this.crest.position.set(0, D0 + 4.4, frontZ - 0.4);
      this.crestBlobs.forEach((b, i) => {
        b.position.set(-7 + i * 3.5, D0 + 4.55 + 0.15 * Math.sin(f * 0.12 + i * 1.7), frontZ - 0.7);
      });
    }
    // shot 7b surge only: the wedge re-surges south and slams the brick wall at z = +7 —
    // front advances z -2 -> +7 over f 1305-1500, piling up ~25% taller as it hits the wall
    const on7b = f >= SURGE_A_F && f < SURGE_B_F;
    this.surgeWave.visible = on7b; this.surgeCrest.visible = on7b; this.surgeWall.visible = on7b;
    if (on7b) {
      const u = smooth((f - SURGE_A_F) / (SURGE_B_F - SURGE_A_F));
      const frontZ = -2 + 9 * u, backZ = frontZ - (3 + 6 * u), lift = 1 + 0.25 * u;
      this.surgeWave.scale.set(0.55, lift, Math.max(0.01, frontZ - backZ)); // 10 m wide, not 18 m: the brick wall shows on both sides of the surge
      this.surgeWave.position.set(0, D0, backZ);
      this.surgeCrest.position.set(0, D0 + 4.5 * lift - 0.1, frontZ - 0.4);
    }
  }

  /** inserts: honey jar only in shot 7a, blueprint only in shot 8a; the drip/pool ooze slowly during 7a */
  private poseProps(f: number) {
    this.flood.visible = f >= FLOOD_F && f < FLOOD_END_F; // shots 6, 7, 8a only — hidden for 8b/9
    this.honeyTable.visible = f >= 1110 && f < 1305;
    if (this.honeyTable.visible) {
      const u = smooth((f - 1110) / 195);
      this.honeyDrip.scale.set(1, 1 + 1.4 * u, 1);
      this.honeyDrip.position.y = 1.24 - 0.07 * u;
      this.honeyPool.scale.set(0.6 + 0.7 * u, 0.25, 0.6 + 0.7 * u);
    }
    this.blueTable.visible = f >= 1500 && f < 1640;
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
