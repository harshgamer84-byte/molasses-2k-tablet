// Static scenery: merged batches (one mesh per material), box-section strands rebuilt along a path every frame
// (chains, rails), and the town on both banks: gabled houses with painted facades, church, mill + chimneys, quay,
// hills and CC0 Kenney props (trees, lanterns, stalls, hedges).
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { D0 } from "./story";
import { brick, rng, ctex, rep, facadeHD, roofHD, stoneHD, brickHD, cobbleStreetHD, woodHD, molassesHD } from "./paint";
import { twoTone } from "./shade";

export type Kit = Record<string, THREE.Object3D>;
export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---------------- materials (shared, cached) ----------------
const mats = new Map<string, THREE.Material>();
/** materials whose Strands are built as real interlocking chain links (MAT pass) instead of a textured box tube */
const CHAIN_MATS = new WeakSet<THREE.Material>();
export const lam = (key: string, make: () => THREE.MeshLambertMaterialParameters) => {
  let m = mats.get(key) as THREE.MeshLambertMaterial | undefined;
  if (!m) {
    if (key === "chainHD") {
      // MAT pass: the chain material (world.ts) becomes slate blue-grey iron with a soft painted-metal highlight;
      // its Strands switch to link geometry, so links read in close-ups (bank f1780, overhead f1650)
      const c = twoTone(new THREE.MeshPhongMaterial({ color: "#7a8490", specular: "#6c727b", shininess: 30 }));
      CHAIN_MATS.add(c);
      m = c as unknown as THREE.MeshLambertMaterial;
    } else m = twoTone(new THREE.MeshLambertMaterial(make()));
    mats.set(key, m);
  }
  return m;
};
const lamOf = new Map<string, THREE.MeshLambertMaterial>();
// the nature kit ships a teal palette; our valley wants storybook greens and browns
const GREENS = ["#62ae4c", "#56a447", "#72b853"];
const RECOLOR: Record<string, string> = { grass: "#6aab4f", leafsDark: "#4a9142", woodBark: "#8a5a3c", woodInner: "#e8cfa4", wood: "#a8724a",
  woodDark: "#7a4f33", dirt: "#8a6a4a", stone: "#b7b4ad" };
/** Kenney GLB materials -> Lambert, so the whole world shares one lighting model */
const toLambert = (m: THREE.Material) => {
  let l = lamOf.get(m.uuid);
  if (!l) {
    const s = m as THREE.MeshStandardMaterial;
    const col = m.name === "leafsGreen" ? GREENS[lamOf.size % 3] : RECOLOR[m.name];
    l = twoTone(new THREE.MeshLambertMaterial({ color: col ? new THREE.Color(col) : s.color?.clone() ?? new THREE.Color("#ffffff"), map: s.map ?? null, side: s.side, alphaTest: s.alphaTest }));
    lamOf.set(m.uuid, l);
  }
  return l;
};

// ---------------- geometry pieces ----------------
const f32 = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => {
  const out = new Float32Array(a.count * a.itemSize);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
  return new THREE.Float32BufferAttribute(out, a.itemSize);
};
/** quad a,b,c,d counter-clockwise seen from its front; uv (u0,v0) at a, (u1,v1) at c */
export const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, u1 = 1, v1 = 1, u0 = 0, v0 = 0) => {
  const g = new THREE.BufferGeometry();
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a)).normalize();
  g.setAttribute("position", new THREE.Float32BufferAttribute([a, b, c, a, c, d].flatMap((v) => [v.x, v.y, v.z]), 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 2, 3, 4, 5].flatMap(() => [n.x, n.y, n.z]), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1], 2));
  return g;
};
export const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
  const g = new THREE.BufferGeometry();
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
  g.setAttribute("position", new THREE.Float32BufferAttribute([a, b, c].flatMap((v) => [v.x, v.y, v.z]), 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 2].flatMap(() => [n.x, n.y, n.z]), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
  return g;
};
/** axis box from min to max, texture tiled every `tile` metres (0 = one image per face) */
export const boxGeo = (min: THREE.Vector3, max: THREE.Vector3, tile = 0, bottom = false) => {
  const [x0, y0, z0] = [min.x, min.y, min.z], [x1, y1, z1] = [max.x, max.y, max.z];
  const t = (a: number) => (tile ? a / tile : 1);
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  const faces = [
    quad(V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1), t(w), t(h)),
    quad(V(x1, y0, z0), V(x0, y0, z0), V(x0, y1, z0), V(x1, y1, z0), t(w), t(h)),
    quad(V(x0, y0, z0), V(x0, y0, z1), V(x0, y1, z1), V(x0, y1, z0), t(d), t(h)),
    quad(V(x1, y0, z1), V(x1, y0, z0), V(x1, y1, z0), V(x1, y1, z1), t(d), t(h)),
    quad(V(x0, y1, z1), V(x1, y1, z1), V(x1, y1, z0), V(x0, y1, z0), t(w), t(d)),
  ];
  if (bottom) faces.push(quad(V(x0, y0, z0), V(x1, y0, z0), V(x1, y0, z1), V(x0, y0, z1), t(w), t(d)));
  return mergeGeometries(faces, false);
};

/** collects pieces by material and merges them into one static mesh per material */
export class Batch {
  private g = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(geo: THREE.BufferGeometry, mat: THREE.Material, m?: THREE.Matrix4) {
    const src = geo.index ? geo.toNonIndexed() : geo;
    const x = new THREE.BufferGeometry();
    x.setAttribute("position", f32(src.attributes.position));
    if (src.attributes.normal) x.setAttribute("normal", f32(src.attributes.normal)); else x.computeVertexNormals();
    x.setAttribute("uv", src.attributes.uv ? f32(src.attributes.uv) : new THREE.Float32BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2));
    if (m) x.applyMatrix4(m);
    const l = this.g.get(mat);
    if (l) l.push(x); else this.g.set(mat, [x]);
  }
  addObject(o: THREE.Object3D, m: THREE.Matrix4) {
    o.updateMatrixWorld(true);
    o.traverse((c) => {
      const mesh = c as THREE.Mesh;
      if (!mesh.isMesh) return;
      this.add(mesh.geometry, toLambert(Array.isArray(mesh.material) ? mesh.material[0] : mesh.material), new THREE.Matrix4().multiplyMatrices(m, mesh.matrixWorld));
    });
  }
  build(parent: THREE.Object3D, cast = true) {
    for (const [mat, list] of this.g) {
      const mesh = new THREE.Mesh(mergeGeometries(list, false), mat);
      mesh.castShadow = cast; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
      parent.add(mesh);
    }
    this.g.clear();
  }
}

// ---------------- strands: box-section tube along a path, rebuilt in place ----------------
// chain-link template (MAT pass): a stadium-shaped ring tube in link space (x along the chain, y in the ring plane,
// z across), NS centre-line samples x NR tube sides, smooth normals (clean ink silhouettes, no facet creases)
const LNS = 16, LNR = 6;
type LinkT = { p: Float32Array; n: Float32Array; idx: number[]; pitch: number };
const linkTemplate = (h: number): LinkT => {
  const ow = h * 0.85, rb = ow * 0.14, ol = ow * 1.62, rc = ow / 2 - rb, hl = ol / 2 - rb - rc;
  const p = new Float32Array(LNS * LNR * 3), n = new Float32Array(LNS * LNR * 3), idx: number[] = [];
  for (let j = 0; j < LNS; j++) {
    const th = (2 * Math.PI * (j + 0.5)) / LNS, nx = Math.cos(th), ny = Math.sin(th);
    const cx = rc * nx + Math.sign(nx) * hl, cy = rc * ny;
    for (let k = 0; k < LNR; k++) {
      const ph = (2 * Math.PI * k) / LNR, cp = Math.cos(ph), sp = Math.sin(ph), o = (j * LNR + k) * 3;
      p[o] = cx + rb * cp * nx; p[o + 1] = cy + rb * cp * ny; p[o + 2] = rb * sp;
      n[o] = cp * nx; n[o + 1] = cp * ny; n[o + 2] = sp;
      const a = j * LNR + k, b = j * LNR + ((k + 1) % LNR), c = ((j + 1) % LNS) * LNR + ((k + 1) % LNR), d = ((j + 1) % LNS) * LNR + k;
      idx.push(a, d, c, a, c, b); // outward winding
    }
  }
  return { p, n, idx, pitch: ol - 4 * rb };
};

export class Strand {
  mesh: THREE.Mesh;
  private pos: Float32Array; private nor: Float32Array; private uv: Float32Array;
  private lt: LinkT | null = null; private maxLinks = 0;
  constructor(public n: number, public w: number, public h: number, mat: THREE.Material, public tile = 1, cast = true) {
    const g = new THREE.BufferGeometry();
    if (CHAIN_MATS.has(mat)) {
      // link mode: up to maxLinks interlocking links laid along the path every frame (draw range = links used)
      const lt = (this.lt = linkTemplate(h)), nv = LNS * LNR;
      this.maxLinks = 440;
      this.pos = new Float32Array(this.maxLinks * nv * 3); this.nor = new Float32Array(this.maxLinks * nv * 3); this.uv = new Float32Array(this.maxLinks * nv * 2);
      const idx = new Uint32Array(this.maxLinks * lt.idx.length);
      for (let l = 0; l < this.maxLinks; l++) for (let i = 0; i < lt.idx.length; i++) idx[l * lt.idx.length + i] = lt.idx[i] + l * nv;
      g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
      g.setAttribute("normal", new THREE.BufferAttribute(this.nor, 3));
      g.setAttribute("uv", new THREE.BufferAttribute(this.uv, 2));
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      g.setDrawRange(0, 0);
    } else {
      this.pos = new Float32Array(n * 12); this.nor = new Float32Array(n * 12); this.uv = new Float32Array(n * 8);
      g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
      g.setAttribute("normal", new THREE.BufferAttribute(this.nor, 3));
      g.setAttribute("uv", new THREE.BufferAttribute(this.uv, 2));
      const idx: number[] = [];
      for (let i = 0; i < n - 1; i++) for (let k = 0; k < 4; k++) {
        const a = i * 4 + k, b = i * 4 + ((k + 1) % 4), c = (i + 1) * 4 + ((k + 1) % 4), d = (i + 1) * 4 + k;
        idx.push(a, b, c, a, c, d);
      }
      g.setIndex(idx);
    }
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false; this.mesh.castShadow = cast; this.mesh.receiveShadow = true;
  }
  private T = new THREE.Vector3(); private S = new THREE.Vector3(); private N = new THREE.Vector3();
  /** link mode: links every `pitch` along the polyline, centred, alternating ring plane (vertical / horizontal) */
  private setLinks(pts: THREE.Vector3[], lt: LinkT) {
    const { T, S, N } = this, nv = LNS * LNR;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const total = cum[cum.length - 1], count = Math.max(0, Math.min(this.maxLinks, Math.floor(total / lt.pitch)));
    const s0 = (total - (count - 1) * lt.pitch) / 2;
    let seg = 1;
    for (let l = 0; l < count; l++) {
      const s = s0 + l * lt.pitch;
      while (seg < pts.length - 1 && cum[seg] < s) seg++;
      const a = pts[seg - 1], b = pts[seg], u = (s - cum[seg - 1]) / Math.max(1e-6, cum[seg] - cum[seg - 1]);
      const px = a.x + (b.x - a.x) * u, py = a.y + (b.y - a.y) * u, pz = a.z + (b.z - a.z) * u;
      T.subVectors(b, a).normalize();
      S.set(-T.z, 0, T.x); // T x up
      if (S.lengthSq() < 1e-6) S.set(1, 0, 0);
      S.normalize(); N.crossVectors(S, T).normalize();
      const odd = l % 2 === 1;
      // ring plane: (T, N) for even links, (T, S) for odd links; z (thickness) across it
      const yx = odd ? S.x : N.x, yy = odd ? S.y : N.y, yz = odd ? S.z : N.z;
      const zx = odd ? -N.x : S.x, zy = odd ? -N.y : S.y, zz = odd ? -N.z : S.z;
      const base = l * nv * 3;
      for (let v = 0; v < nv * 3; v += 3) {
        const x = lt.p[v], y = lt.p[v + 1], z = lt.p[v + 2], o = base + v;
        this.pos[o] = px + T.x * x + yx * y + zx * z;
        this.pos[o + 1] = py + T.y * x + yy * y + zy * z;
        this.pos[o + 2] = pz + T.z * x + yz * y + zz * z;
        const nx = lt.n[v], ny = lt.n[v + 1], nz = lt.n[v + 2];
        this.nor[o] = T.x * nx + yx * ny + zx * nz;
        this.nor[o + 1] = T.y * nx + yy * ny + zy * nz;
        this.nor[o + 2] = T.z * nx + yz * ny + zz * nz;
      }
    }
    const g = this.mesh.geometry;
    g.setDrawRange(0, count * lt.idx.length);
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
  }
  set(pts: THREE.Vector3[]) {
    if (this.lt) { this.setLinks(pts, this.lt); return; }
    const { T, S, N } = this;
    let len = 0;
    for (let i = 0; i < this.n; i++) {
      const p = pts[Math.min(i, pts.length - 1)];
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      T.subVectors(b, a).normalize();
      S.crossVectors(T, V(0, 1, 0));
      if (S.lengthSq() < 1e-6) S.set(1, 0, 0);
      S.normalize(); N.crossVectors(S, T).normalize();
      if (i) len += p.distanceTo(pts[Math.min(i - 1, pts.length - 1)]);
      for (let k = 0; k < 4; k++) {
        const sx = k === 0 || k === 3 ? -1 : 1, sy = k < 2 ? -1 : 1, j = (i * 4 + k) * 3;
        this.pos[j] = p.x + S.x * sx * this.w / 2 + N.x * sy * this.h / 2;
        this.pos[j + 1] = p.y + S.y * sx * this.w / 2 + N.y * sy * this.h / 2;
        this.pos[j + 2] = p.z + S.z * sx * this.w / 2 + N.z * sy * this.h / 2;
        const nx = S.x * sx + N.x * sy, ny = S.y * sx + N.y * sy, nz = S.z * sx + N.z * sy, nl = Math.hypot(nx, ny, nz);
        this.nor[j] = nx / nl; this.nor[j + 1] = ny / nl; this.nor[j + 2] = nz / nl;
        this.uv[(i * 4 + k) * 2] = k / 4; this.uv[(i * 4 + k) * 2 + 1] = len / this.tile;
      }
    }
    const g = this.mesh.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true; g.attributes.uv.needsUpdate = true;
  }
}

// ---------------- set dressing around the lens ----------------
/** a sight line of the film: from the lens toward the shot's subject, `len` along d (d has unit forward component) */
export type Ray = { o: THREE.Vector3; d: THREE.Vector3; len: number; core: boolean };
let sight: Ray[] = [];
/** does any sight line pass through this box? (centre lines only for small props, so they can still frame a shot) */
const inTheWay = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, coreOnly = false, near = Infinity) => {
  for (const { o, d, len, core } of sight) {
    if (coreOnly && !core) continue;
    let t0 = 0, t1 = len;
    for (const [oo, dd, a, b] of [[o.x, d.x, x0, x1], [o.y, d.y, y0, y1], [o.z, d.z, z0, z1]]) {
      if (Math.abs(dd) < 1e-9) { if (oo < a || oo > b) t0 = Infinity; continue; }
      const ta = (a - oo) / dd, tb = (b - oo) / dd;
      t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb));
    }
    // near: only count intersections close to the lens (a house the camera is inside / right against).
    // A tenement the camera legitimately looks AT or PAST must not be culled (look-check round 1:
    // the old any-ray rule culled nearly the whole street, so shots 2/8b showed no tenements at all).
    if (t0 <= t1 && t0 < near) return true;
  }
  return false;
};

// ---------------- cartoon vegetation (MAT pass) ----------------
// Kenney's faceted low-poly trees and box hedges -> rounded storybook shapes: clustered smooth spheres for canopies
// (the two-tone sun term gives each lobe a lit cap and a cool belly), tapered trunks, rounded-box hedges. Smooth
// normals mean the world ink draws clean silhouettes and lobe-to-lobe folds instead of a crease on every facet.
type VegKind = "round" | "fat" | "tall" | "cone" | "bush" | "hedge";
const VEG: Record<string, VegKind> = {
  tree_oak: "round", tree_default: "round", tree_detailed: "round", tree_fat: "fat", "tree-high-round": "tall", tree: "tall",
  tree_cone: "cone", plant_bushLarge: "bush", plant_bushDetailed: "bush", plant_bush: "bush", hedge: "hedge",
};
const LEAF = ["#5aa83c", "#4c9a37", "#69b545", "#55a243", "#3f8f3c"];
/** canopy paint (equal px per metre on a unit sphere: 256 around x 128 pole to pole): light crown, darker belly,
 *  soft leaf-clump dabs (kept low contrast: the two-tone sun term does the main modelling) */
const leafTex = (i: number) => ctex("leafHD" + i, 256, 128, (g, r) => {
  const base = new THREE.Color(LEAF[i]), top = base.clone().offsetHSL(0.012, 0.03, 0.08), bot = base.clone().offsetHSL(-0.015, 0.0, -0.08);
  const gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, "#" + top.getHexString()); gr.addColorStop(0.42, "#" + base.getHexString()); gr.addColorStop(1, "#" + bot.getHexString());
  g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
  for (let k = 0; k < 46; k++) {
    const x = r() * 256, y = 10 + r() * 108, rad = 5 + r() * 9, light = y < 64 ? r() < 0.7 : r() < 0.25;
    for (const ox of [-256, 0, 256]) {
      g.strokeStyle = light ? "rgba(225,255,170,0.22)" : "rgba(20,70,30,0.2)"; g.lineWidth = 2.5; g.lineCap = "round";
      g.beginPath(); g.arc(x + ox, y + rad * 0.6, rad, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    }
  }
});
const leafMat = (i: number) => lam("leafHD" + i, () => ({ map: leafTex(i) }));
const barkMat = () => lam("barkHD", () => ({ color: "#8f5d3b" }));
const vegGeo = new Map<string, THREE.BufferGeometry>();
const lobeGeo = (q: number) => {
  const k = "lobe" + q;
  let g = vegGeo.get(k);
  if (!g) { g = new THREE.SphereGeometry(1, [20, 14, 10][q], [14, 10, 7][q]); vegGeo.set(k, g); }
  return g;
};
const trunkGeo = () => {
  let g = vegGeo.get("trunk");
  if (!g) { g = new THREE.CylinderGeometry(0.6, 1, 1, 10, 1, true).translate(0, 0.5, 0); vegGeo.set("trunk", g); }
  return g;
};
/** rounded box (exact: inner box + radius), unit size along x, smooth normals; used for hedges */
const hedgeGeo = () => {
  let g = vegGeo.get("hedge");
  if (!g) {
    g = new THREE.BoxGeometry(1, 1, 1, 18, 10, 10);
    const p = g.attributes.position as THREE.BufferAttribute, n = g.attributes.normal as THREE.BufferAttribute;
    // per-axis rounding radii in unit space (~0.35 m at the ends, ~0.45 m on top / sides at 3.3 x 1.56 x 1.17 m);
    // flat bottom (it sits on the lawn)
    const R = [0.106, 0.29, 0.385], v = new THREE.Vector3(), e = new THREE.Vector3(), q = [0, 0, 0];
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      for (let a = 0; a < 3; a++) {
        const c = v.getComponent(a), lim = a === 1 && c < 0 ? 0.5 : 0.5 - R[a];
        q[a] = THREE.MathUtils.clamp(c, -lim, lim); e.setComponent(a, (c - q[a]) / R[a]);
      }
      const L = e.length();
      if (L < 1e-6) continue;
      e.divideScalar(L);
      p.setXYZ(i, q[0] + e.x * R[0], q[1] + e.y * R[1], q[2] + e.z * R[2]);
      const nn = new THREE.Vector3(e.x / R[0], e.y / R[1], e.z / R[2]).normalize();
      n.setXYZ(i, nn.x, nn.y, nn.z);
    }
    g.translate(0, 0.5, 0);
    vegGeo.set("hedge", g);
  }
  return g;
};
const yawQ = (a: number) => new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), a);
/** half-width of a cartoon plant of kind k and height h (for the sight-line test) */
const vegRad = (k: VegKind, h: number) => (k === "hedge" ? 1.7 : k === "bush" ? 0.85 * h : k === "tall" ? 0.2 * h : k === "cone" ? 0.27 * h : k === "fat" ? 0.44 * h : 0.39 * h);
/** add one cartoon plant to a batch: base at (x, y, z), height h, q = lobe detail (0 near .. 2 far) */
const addVeg = (b: Batch, k: VegKind, x: number, y: number, z: number, h: number, seed: number, q = 0) => {
  const r = rng(Math.abs(Math.floor(seed)) % 200000 + 7), U = (a: number, c: number) => a + (c - a) * r();
  const leaf = leafMat(k === "cone" ? 4 : k === "hedge" ? 1 : Math.floor(r() * 4)), lobe = lobeGeo(q), yaw = r() * 6.28;
  const put = (px: number, py: number, pz: number, rad: number, sy = 0.9) =>
    b.add(lobe, leaf, new THREE.Matrix4().compose(V(x + px, y + py, z + pz), yawQ(r() * 6.28), V(rad, rad * sy, rad)));
  const trunk = (th: number, tr: number) =>
    b.add(trunkGeo(), barkMat(), new THREE.Matrix4().compose(V(x, y - 0.15, z), yawQ(yaw), V(tr, th + 0.15, tr)));
  const ring = (n: number, dist: number, r0: number, r1: number, cy: number, dy: number) => {
    const a0 = r() * 6.28;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i * 6.28) / n + U(-0.35, 0.35), dd = dist * U(0.85, 1.12);
      put(Math.cos(a) * dd, cy + U(-dy, dy), Math.sin(a) * dd, U(r0, r1));
    }
  };
  if (k === "round" || k === "fat") {
    const f = k === "fat";
    trunk((f ? 0.4 : 0.48) * h, 0.055 * h);
    const cy = (f ? 0.58 : 0.64) * h;
    put(0, cy, 0, (f ? 0.29 : 0.26) * h);
    ring(f ? 5 : 4, (f ? 0.22 : 0.18) * h, (f ? 0.19 : 0.17) * h, (f ? 0.23 : 0.21) * h, cy - 0.05 * h, 0.04 * h);
    put(U(-0.05, 0.05) * h, cy + (f ? 0.15 : 0.17) * h, U(-0.05, 0.05) * h, (f ? 0.19 : 0.17) * h);
  } else if (k === "tall") {
    trunk(0.34 * h, 0.045 * h);
    put(0, 0.47 * h, 0, 0.17 * h, 1.3);
    put(U(-0.03, 0.03) * h, 0.65 * h, U(-0.03, 0.03) * h, 0.15 * h, 1.3);
    put(0, 0.82 * h, 0, 0.11 * h, 1.25);
    ring(3, 0.1 * h, 0.1 * h, 0.12 * h, 0.55 * h, 0.06 * h);
  } else if (k === "cone") {
    trunk(0.2 * h, 0.05 * h);
    put(0, 0.3 * h, 0, 0.26 * h, 0.62);
    put(0, 0.5 * h, 0, 0.2 * h, 0.66);
    put(0, 0.68 * h, 0, 0.14 * h, 0.75);
    put(0, 0.84 * h, 0, 0.08 * h, 1.0);
  } else if (k === "bush") {
    put(0, 0.46 * h, 0, 0.5 * h);
    ring(3, 0.42 * h, 0.32 * h, 0.38 * h, 0.32 * h, 0.04 * h);
  } else { // hedge segment, 3.3 m along local x
    b.add(hedgeGeo(), leaf, new THREE.Matrix4().compose(V(x, y - 0.06, z), new THREE.Quaternion(), V(3.3, h + 0.06, Math.max(0.9, h * 0.78))));
  }
};

// ---------------- painted cloth banner (MAT round 3) ----------------
// The Kenney banner is one flat face of the saturated colour atlas: in golden light it kept a uniform, hot red and
// read as pasted on. Ours is a hanging cloth with real folds (smooth normals, so the two-tone light rolls across
// them), a swallow-tail hem, a muted crimson (sat ~-25 %) with an ochre border and a diamond like the tower flags.
const BANNER_COL: Record<string, string> = { "banner-red": "#b8553a", "banner-green": "#4f8a5a" }; // warm red: no purple in shade
const FOLD = 0.27, CLOTH_W = 1.1, CLOTH_H = 2.6; // fold period across the cloth, cloth size (m)
const bannerTex = (col: string) => ctex("bannerHD" + col, 256, 700, (g) => {
  const W = 256, H = 700, base = new THREE.Color(col);
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, "#" + base.clone().offsetHSL(0, 0, 0.04).getHexString()); gr.addColorStop(1, "#" + base.clone().offsetHSL(0, 0, -0.06).getHexString());
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x++) { // painted fold shading, in phase with the geometry folds
    const s = Math.sin((x / W) * (CLOTH_W / FOLD) * Math.PI * 2);
    g.fillStyle = s > 0 ? `rgba(255,235,215,${0.1 * s})` : `rgba(60,15,15,${-0.12 * s})`; g.fillRect(x, 0, 1, H);
  }
  g.fillStyle = "#" + base.clone().offsetHSL(0, -0.05, -0.12).getHexString(); g.fillRect(0, 0, W, 54); // top hem
  g.strokeStyle = "#d1aa5c"; g.lineWidth = 9; g.strokeRect(20, 66, W - 40, H - 86);                 // ochre border
  g.strokeStyle = "rgba(60,30,20,0.45)"; g.lineWidth = 2; g.strokeRect(14, 60, W - 28, H - 74); g.strokeRect(26, 72, W - 52, H - 98);
  g.fillStyle = "#d1aa5c"; g.fillRect(0, 46, W, 8);
  const cx = W / 2, cy = 250; // emblem: diamond (the tower flags' motif) on a light disc
  g.fillStyle = "#efe2c2"; g.beginPath(); g.arc(cx, cy, 62, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(60,30,20,0.55)"; g.lineWidth = 3; g.stroke();
  g.fillStyle = "#d1aa5c"; g.beginPath(); g.moveTo(cx, cy - 46); g.lineTo(cx + 34, cy); g.lineTo(cx, cy + 46); g.lineTo(cx - 34, cy); g.closePath(); g.fill();
  g.strokeStyle = "rgba(60,30,20,0.6)"; g.lineWidth = 2.5; g.stroke();
});
const bannerGeo = () => {
  let geo = vegGeo.get("banner");
  if (!geo) {
    const w = CLOTH_W, hh = CLOTH_H, notch = 0.42;
    geo = new THREE.PlaneGeometry(w, hh, 16, 20).translate(0, -hh / 2, 0); // top edge at y = 0
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), t = -y / hh; // 0 top .. 1 bottom
      p.setY(i, y + notch * (1 - Math.abs(x) / (w / 2)) * t * t);                              // swallow-tail hem
      p.setZ(i, (0.025 + 0.055 * t) * Math.sin((x / FOLD) * Math.PI * 2 + 0.6) + 0.04 * t * t); // folds deepen downwards
    }
    geo.computeVertexNormals();
    vegGeo.set("banner", geo);
  }
  return geo;
};
/** gonfalon on a pole where the Kenney banner plate stood: its plate hung 0.4 x scale beside the placement point,
 *  facing local +-x, so the pole goes there (same framing) and the cloth faces that way */
const bannerProp = (b: Batch, name: string, x0: number, y: number, z0: number, h: number, yaw0: number) => {
  const off = 0.4 * (h / 0.84), x = x0 + Math.cos(yaw0) * off, z = z0 - Math.sin(yaw0) * off, yaw = yaw0 + Math.PI / 2;
  if (inTheWay(x - 0.7, x + 0.7, y, y + h, z - 0.7, z + 0.7, true)) return;
  const col = BANNER_COL[name] ?? "#b4524b";
  const M = (px: number, py: number, pz: number) => new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z).multiply(new THREE.Matrix4().makeTranslation(px, py, pz));
  const pole = lam("bannerPole", () => ({ color: "#6e4b33" })), gold = lam("bannerGold", () => ({ color: "#c9a24e" }));
  b.add(new THREE.CylinderGeometry(0.045, 0.06, h, 10).translate(0, h / 2, 0), pole, M(0, 0, 0));
  b.add(new THREE.SphereGeometry(0.1, 14, 10), gold, M(0, h + 0.06, 0));
  b.add(new THREE.CylinderGeometry(0.03, 0.03, CLOTH_W + 0.2, 8).rotateZ(Math.PI / 2), pole, M(0, h - 0.18, 0.06));
  for (const s of [-1, 1]) b.add(new THREE.SphereGeometry(0.045, 10, 8), gold, M(s * (CLOTH_W / 2 + 0.12), h - 0.18, 0.06));
  b.add(bannerGeo(), lam("bannerHD" + col, () => ({ map: bannerTex(col), side: THREE.DoubleSide })), M(0, h - 0.2, 0.1));
};

// ---------------- procedural street props (MAT pass, molasses) ----------------
// The kit is EMPTY (no Kenney GLBs exist), so these props are built in code: firewood piles, buckets,
// lampposts, wagon wheels, a wagon and picket fences. One parts list feeds both prop() (merged into the
// town batch) and kitClone() (its own object, e.g. the CAM agent's FOREGROUND framing objects).
type ProcPart = { geo: THREE.BufferGeometry; mat: THREE.Material; m: THREE.Matrix4 };
const PP = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0): ProcPart => ({
  geo, mat,
  m: new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(1, 1, 1)),
});
const procBark = () => lam("procBark", () => ({ color: "#8f5d3b" }));
const procWoodEnd = () => lam("procWoodEnd", () => ({ color: "#d9b98a" }));
const procWood = () => lam("procWoodHD", () => ({ map: woodHD() }));
const procRim = () => lam("procRim", () => ({ color: "#6e4b33" }));
const procIron = () => lam("procIron", () => ({ color: "#3a3d44" }));
const procIronLight = () => lam("procIronLight", () => ({ color: "#6a6e76" }));
const procBucketM = () => lam("procBucket", () => ({ color: "#6f6252" }));
const procGlass = () => lam("procGlass", () => ({ color: "#ffe2a0" }));
const procMolasses = () => lam("procMolasses", () => ({ map: molassesHD() }));
const procFenceM = () => lam("procFence", () => ({ color: "#ddd5c2" }));
/** half-width of a procedural prop of height h (for the sight-line test) */
const PROC_RAD: Record<string, number> = { firewood: 0.8, bucket: 0.35, lamppost: 0.12, wagonWheel: 0.55, wagon: 1.5, fence: 1.3 };

/** one wagon wheel (plane XY, axle along Z), centred at (ox, oy, oz), diameter h */
const wheelParts = (h: number, ox: number, oy: number, oz: number): ProcPart[] => {
  const out: ProcPart[] = [
    PP(new THREE.TorusGeometry(0.46 * h, 0.05 * h, 8, 24), procRim(), ox, oy, oz),
    PP(new THREE.TorusGeometry(0.51 * h, 0.018 * h, 6, 24), procIron(), ox, oy, oz),
    PP(new THREE.CylinderGeometry(0.09 * h, 0.09 * h, 0.12 * h, 10).rotateX(Math.PI / 2), procRim(), ox, oy, oz),
  ];
  for (let k = 0; k < 8; k++)
    out.push(PP(new THREE.BoxGeometry(0.045 * h, 0.42 * h, 0.03 * h).translate(0, 0.24 * h, 0), procWoodEnd(), ox, oy, oz, 0, 0, (k * Math.PI) / 4));
  return out;
};

const procParts = (name: string, h: number, seed: number): ProcPart[] => {
  const r = rng(Math.abs(Math.floor(seed)) % 200000 + 7), U = (a: number, c: number) => a + (c - a) * r();
  if (name === "firewood") { // pyramid of logs: 3 + 2 + 1, cut ends showing
    const out: ProcPart[] = [], rad = 0.12 * h, L = 1.4 * h;
    const log = (y: number, z: number) => {
      const yaw = U(-0.07, 0.07), dx = U(-0.05, 0.05) * h;
      out.push(PP(new THREE.CylinderGeometry(rad, rad, L, 10).rotateZ(Math.PI / 2), procBark(), dx, y, z, yaw));
      out.push(PP(new THREE.CircleGeometry(rad * 0.98, 10).rotateY(Math.PI / 2), procWoodEnd(), dx + (L / 2) * Math.cos(yaw), y, z - (L / 2) * Math.sin(yaw), yaw));
      out.push(PP(new THREE.CircleGeometry(rad * 0.98, 10).rotateY(-Math.PI / 2), procWoodEnd(), dx - (L / 2) * Math.cos(yaw), y, z + (L / 2) * Math.sin(yaw), yaw));
    };
    for (const z of [-2 * rad, 0, 2 * rad]) log(rad, z);
    for (const z of [-rad, rad]) log(2.7 * rad, z);
    log(4.4 * rad, 0);
    return out;
  }
  if (name === "bucket") { // tin bucket, molasses inside (a kid's drip bucket)
    return [
      PP(new THREE.CylinderGeometry(0.54 * h, 0.44 * h, h, 14), procBucketM(), 0, h / 2, 0),
      PP(new THREE.TorusGeometry(0.54 * h, 0.045 * h, 6, 20).rotateX(Math.PI / 2), procIron(), 0, h, 0),
      PP(new THREE.TorusGeometry(0.5 * h, 0.03 * h, 6, 16, Math.PI), procIronLight(), 0, h, 0, 0, 0, 0.25),
      PP(new THREE.CircleGeometry(0.47 * h, 14).rotateX(-Math.PI / 2), procMolasses(), 0, 0.82 * h, 0),
    ];
  }
  if (name === "lamppost") { // 1919 gas lamppost: flared base, post, collar, glass lantern + cap + finial
    return [
      PP(new THREE.CylinderGeometry(0.035 * h, 0.05 * h, 0.12 * h, 10), procIron(), 0, 0.06 * h, 0),
      PP(new THREE.CylinderGeometry(0.016 * h, 0.02 * h, 0.74 * h, 8), procIron(), 0, 0.49 * h, 0),
      PP(new THREE.TorusGeometry(0.028 * h, 0.008 * h, 6, 12).rotateX(Math.PI / 2), procIronLight(), 0, 0.8 * h, 0),
      PP(new THREE.BoxGeometry(0.085 * h, 0.1 * h, 0.085 * h), procGlass(), 0, 0.87 * h, 0),
      PP(new THREE.BoxGeometry(0.1 * h, 0.015 * h, 0.1 * h), procIron(), 0, 0.815 * h, 0),
      PP(new THREE.BoxGeometry(0.1 * h, 0.015 * h, 0.1 * h), procIron(), 0, 0.925 * h, 0),
      PP(new THREE.ConeGeometry(0.075 * h, 0.05 * h, 4).rotateY(Math.PI / 4), procIron(), 0, 0.955 * h, 0),
      PP(new THREE.SphereGeometry(0.018 * h, 8, 6), procIronLight(), 0, 0.99 * h, 0),
    ];
  }
  if (name === "wagonWheel") return wheelParts(h, 0, 0, 0);
  if (name === "wagon") { // horse wagon: woodHD bed + rails, four wheels, axles, shafts
    const out: ProcPart[] = [
      PP(new THREE.BoxGeometry(2.6 * h, 0.22 * h, 1.3 * h), procWood(), 0, 0.98 * h, 0),
      PP(new THREE.BoxGeometry(2.6 * h, 0.3 * h, 0.07 * h), procWood(), 0, 1.2 * h, 0.615 * h),
      PP(new THREE.BoxGeometry(2.6 * h, 0.3 * h, 0.07 * h), procWood(), 0, 1.2 * h, -0.615 * h),
      PP(new THREE.BoxGeometry(0.07 * h, 0.3 * h, 1.3 * h), procWood(), 1.265 * h, 1.2 * h, 0),
      PP(new THREE.BoxGeometry(0.07 * h, 0.3 * h, 1.3 * h), procWood(), -1.265 * h, 1.2 * h, 0),
      PP(new THREE.BoxGeometry(0.5 * h, 0.12 * h, 1.1 * h), procWood(), 0.95 * h, 1.25 * h, 0),
      PP(new THREE.CylinderGeometry(0.05 * h, 0.05 * h, 1.5 * h, 8).rotateX(Math.PI / 2), procIron(), 0.85 * h, 0.5 * h, 0),
      PP(new THREE.CylinderGeometry(0.05 * h, 0.05 * h, 1.5 * h, 8).rotateX(Math.PI / 2), procIron(), -0.85 * h, 0.5 * h, 0),
      PP(new THREE.BoxGeometry(1.3 * h, 0.07 * h, 0.07 * h), procWood(), 1.9 * h, 0.75 * h, 0.45 * h, 0, 0, -0.3),
      PP(new THREE.BoxGeometry(1.3 * h, 0.07 * h, 0.07 * h), procWood(), 1.9 * h, 0.75 * h, -0.45 * h, 0, 0, -0.3),
    ];
    for (const wx of [0.85 * h, -0.85 * h]) for (const wz of [0.66 * h, -0.66 * h]) out.push(...wheelParts(h, wx, 0.5 * h, wz));
    return out;
  }
  if (name === "fence") { // picket fence segment, 2.4 m long along local x
    const out: ProcPart[] = [];
    for (const px of [-1.2 * h, 1.2 * h]) {
      out.push(PP(new THREE.BoxGeometry(0.12 * h, h, 0.12 * h), procFenceM(), px, h / 2, 0));
      out.push(PP(new THREE.ConeGeometry(0.09 * h, 0.1 * h, 4).rotateY(Math.PI / 4), procFenceM(), px, h + 0.05 * h, 0));
    }
    for (const ry of [0.35 * h, 0.72 * h]) out.push(PP(new THREE.BoxGeometry(2.4 * h, 0.09 * h, 0.05 * h), procFenceM(), 0, ry, 0));
    for (let k = 0; k < 9; k++) {
      const px = -1.08 * h + k * 0.27 * h;
      out.push(PP(new THREE.BoxGeometry(0.09 * h, 0.8 * h, 0.04 * h), procFenceM(), px, 0.4 * h, 0));
      out.push(PP(new THREE.ConeGeometry(0.065 * h, 0.1 * h, 4).rotateY(Math.PI / 4), procFenceM(), px, 0.85 * h, 0));
    }
    return out;
  }
  return [];
};
const PROC: Record<string, true> = { firewood: true, bucket: true, lamppost: true, wagonWheel: true, wagon: true, fence: true };
/** add one procedural prop to a batch (left out when it would stand in front of the lens) */
const addProc = (b: Batch, name: string, x: number, y: number, z: number, h: number, yaw = 0, seed = 0) => {
  const rad = (PROC_RAD[name] ?? 0.5) * h;
  if (inTheWay(x - rad, x + rad, y, y + h, z - rad, z + rad, true)) return;
  const place = new THREE.Matrix4().compose(V(x, y, z), yawQ(yaw), V(1, 1, 1));
  for (const p of procParts(name, h, seed)) b.add(p.geo, p.mat, place.clone().multiply(p.m));
};
/** a procedural prop as its own object, base at y = 0, scaled to height h (no sight-line test) */
const procGroup = (name: string, h: number) => {
  const grp = new THREE.Group();
  for (const p of procParts(name, h, name.length * 977 + h * 131)) {
    const mesh = new THREE.Mesh(p.geo, p.mat);
    mesh.applyMatrix4(p.m);
    mesh.castShadow = false; mesh.receiveShadow = true;
    grp.add(mesh);
  }
  return grp;
};

// ---------------- Kenney props ----------------
const boxes = new Map<THREE.Object3D, THREE.Box3>();
/** place a Kenney model with its base on y, scaled to height h (left out when it would stand in front of the lens).
 *  Trees, bushes and hedges are drawn as cartoon vegetation, banners as painted cloth instead (MAT pass). */
export const prop = (b: Batch, kit: Kit, name: string, x: number, y: number, z: number, h: number, yaw = 0) => {
  if (name.startsWith("banner")) { bannerProp(b, name, x, y, z, h, yaw); return; }
  const vk = VEG[name];
  if (vk) {
    const rad = vegRad(vk, h);
    if (inTheWay(x - rad, x + rad, y, y + h, z - rad, z + rad, true)) return;
    const d = Math.hypot(x, z);
    addVeg(b, vk, x, y, z, h, x * 92.7 + z * 31.3 + yaw * 1000, d > 200 ? 2 : Math.abs(z) > 45 && d > 60 ? 1 : 0);
    return;
  }
  if (PROC[name]) { addProc(b, name, x, y, z, h, yaw, x * 92.7 + z * 31.3 + yaw * 1000); return; }
  const o = kit[name];
  if (!o) return;
  let box = boxes.get(o);
  if (!box) { box = new THREE.Box3().setFromObject(o); boxes.set(o, box); }
  const s = h / Math.max(0.01, box.max.y - box.min.y), r = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * s * 0.5;
  if (inTheWay(x - r, x + r, y, y + h, z - r, z + r, true)) return;
  b.addObject(o, new THREE.Matrix4().compose(V(x, y - box.min.y * s, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(s, s, s)));
};

/** a Kenney model as its own object (two-tone materials), base at y = 0, scaled to height h (no sight-line test:
 *  used for the CAM agent's FOREGROUND framing objects, which are meant to stand in front of the lens) */
export const kitClone = (kit: Kit, name: string, h: number): THREE.Object3D | null => {
  const vk = VEG[name];
  if (vk) { // cartoon plant as its own object (MAT pass), base at y = 0
    const vb = new Batch(), grp = new THREE.Group();
    addVeg(vb, vk, 0, 0, 0, h, name.length * 977 + h * 131, 0);
    vb.build(grp, false);
    grp.traverse((x) => { const m = x as THREE.Mesh; if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; m.matrixAutoUpdate = true; } });
    return grp;
  }
  if (PROC[name]) return procGroup(name, h); // procedural street prop (the kit is empty: never null for these)
  const o = kit[name];
  if (!o) return null;
  let box = boxes.get(o);
  if (!box) { box = new THREE.Box3().setFromObject(o); boxes.set(o, box); }
  const c = o.clone(true), s = h / Math.max(0.01, box.max.y - box.min.y);
  c.traverse((x) => {
    const m = x as THREE.Mesh;
    if (m.isMesh) { m.material = toLambert(Array.isArray(m.material) ? m.material[0] : m.material); m.castShadow = false; m.receiveShadow = true; }
  });
  const g = new THREE.Group();
  c.position.y = -box.min.y * s; c.scale.setScalar(s);
  g.add(c);
  return g;
};

// ---------------- houses ----------------
type Style = { wall: string; shutter: string; roof: string; timber?: boolean; brick?: boolean };
// MAT pass: warm ochre / cream / sandstone / salmon walls + one blue-grey (the old pinks, whites and grey-blues read
// lavender: the two-tone shade multiplies by a blue-violet, so a near-neutral albedo turns lilac on every shaded face)
// round 3: saturation -35 % on every wall (neutral warm grey / beige; the salmon became a warm greige)
// round 4: the pale greiges still read lavender-grey in shade -> a muted brick / cream / ochre / terracotta spread
const STYLES: Style[] = [
  { wall: "#ecdab2", shutter: "#3f6fb5", roof: "#d27a62" },              // cream
  { wall: "#d8a95f", shutter: "#2f6a43", roof: "#b8644f" },              // ochre
  { wall: "#c47a5c", shutter: "#2f5f6a", roof: "#8f97a8" },              // muted brick-red plaster
  { wall: "#efdcb8", shutter: "#2f5f6a", roof: "#c9775a", timber: true }, // cream timber frame
  { wall: "#ddbd78", shutter: "#5a3b2a", roof: "#d27a62" },              // straw ochre
  { wall: "#cc9a6c", shutter: "#3f6fb5", roof: "#8e7aa0" },              // terracotta sand
  { wall: "#e2c49a", shutter: "#8c3b4a", roof: "#c9775a" },              // warm sandstone
  { wall: "#e3d2b8", shutter: "#2f6a43", roof: "#8f97a8", brick: true },
];
const roofMat = (col: string) => lam("roof" + col, () => ({ map: roofHD(col, col === "#8f97a8"), side: THREE.DoubleSide }));

/** gabled house: front facade (local +z) at width w, depth d, wall height h, ridge along local x (left out if it blocks a shot) */
export const house = (b: Batch, x: number, z: number, yaw: number, w: number, d: number, h: number, si: number, y = D0) => {
  const across = Math.abs(Math.sin(yaw)) > 0.5, hx = (across ? d : w) / 2 + 0.6, hz = (across ? w : d) / 2 + 0.6;
  if (inTheWay(x - hx, x + hx, y, y + h + d * 0.42 + 1.2, z - hz, z + hz)) return;
  const st = STYLES[si % STYLES.length];
  const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z);
  const front = lam(`hf${si}_${w}_${h}`, () => ({ map: facadeHD(`hf${si}_${w}_${h}`, w, h, { ...st, door: true }) }));
  const side = lam(`hs${si}_${h}`, () => ({ map: facadeHD(`hs${si}_${h}`, 8, h, st) }));
  const wall = lam("wall" + st.wall, () => ({ color: st.brick ? "#c8643f" : st.wall }));
  const hw = w / 2, hd = d / 2, rh = d * 0.42, o = 0.35;
  b.add(quad(V(-hw, 0, hd), V(hw, 0, hd), V(hw, h, hd), V(-hw, h, hd)), front, m);
  b.add(quad(V(hw, 0, -hd), V(-hw, 0, -hd), V(-hw, h, -hd), V(hw, h, -hd)), side, m);
  b.add(quad(V(-hw, 0, -hd), V(-hw, 0, hd), V(-hw, h, hd), V(-hw, h, -hd)), side, m);
  b.add(quad(V(hw, 0, hd), V(hw, 0, -hd), V(hw, h, -hd), V(hw, h, hd)), side, m);
  b.add(tri(V(-hw, h, -hd), V(-hw, h, hd), V(-hw, h + rh, 0)), wall, m);
  b.add(tri(V(hw, h, hd), V(hw, h, -hd), V(hw, h + rh, 0)), wall, m);
  const ru = (w + 2 * o) / 4, rv = Math.hypot(hd + o, rh) / 4, rm = roofMat(st.roof);
  b.add(quad(V(-hw - o, h - 0.25, hd + o), V(hw + o, h - 0.25, hd + o), V(hw + o, h + rh, 0), V(-hw - o, h + rh, 0), ru, rv), rm, m);
  b.add(quad(V(hw + o, h - 0.25, -hd - o), V(-hw - o, h - 0.25, -hd - o), V(-hw - o, h + rh, 0), V(hw + o, h + rh, 0), ru, rv), rm, m);
  const cx = hw * 0.45 * (si % 2 ? 1 : -1);
  b.add(boxGeo(V(cx - 0.4, h + rh * 0.3, -hd * 0.35 - 0.4), V(cx + 0.4, h + rh + 1.1, -hd * 0.35 + 0.4), 2), lam("chim", () => ({ map: rep(brick(), 1, 1) })), m);
  houseDetail(b, m, w, d, h, rh, cx);
};

// round 4: real 3D relief on every house (was a flat window-textured box): stone plinth, cornice under the eaves,
// window sills + lintel hoods matching facadeHD's window layout, front door step + door hood, chimney cap and pot
const UB = new THREE.BoxGeometry(1, 1, 1);
const trimM = () => lam("trimStone", () => ({ color: "#efe3c8" }));
const capM = () => lam("chimCap", () => ({ color: "#9a8778" }));
const plinthM = () => lam("plinthHD", () => ({ map: stoneHD("copeHD") }));
const ub = (b: Batch, mat: THREE.Material, m: THREE.Matrix4, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
  b.add(UB, mat, m.clone().multiply(new THREE.Matrix4().compose(V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), new THREE.Quaternion(), V(x1 - x0, y1 - y0, z1 - z0))));
const houseDetail = (b: Batch, m: THREE.Matrix4, w: number, d: number, h: number, rh: number, chx: number) => {
  const hw = w / 2, hd = d / 2, tm = trimM(), floors = Math.max(1, Math.floor(h / 2.8));
  b.add(boxGeo(V(-hw - 0.07, -0.05, -hd - 0.07), V(hw + 0.07, 0.45, hd + 0.07), 2), plinthM(), m);          // plinth
  ub(b, tm, m, -hw - 0.12, hw + 0.12, h - 0.52, h - 0.25, hd, hd + 0.17);                                   // cornice front
  ub(b, tm, m, -hw - 0.12, hw + 0.12, h - 0.52, h - 0.25, -hd - 0.17, -hd);                                 // cornice back
  for (const s of [-1, 1]) ub(b, tm, m, s < 0 ? -hw - 0.17 : hw, s < 0 ? -hw : hw + 0.17, h - 0.52, h - 0.25, -hd - 0.12, hd + 0.12);
  // windows: facadeHD puts nWin = floor(width / 2.2) per floor at (i + 0.5) / nWin, sill line fl * 2.8 + 0.9 m
  const wins = (len: number, door: boolean, at: (u: number) => [number, number], out: [number, number]) => {
    const n = Math.max(1, Math.floor(len / 2.2));
    for (let fl = 0; fl < floors; fl++) for (let i = 0; i < n; i++) {
      const [px, pz] = at((i + 0.5) / n), yb = fl * 2.8 + 0.9;
      if (door && fl === 0 && i === Math.floor(n / 2)) {
        const along = (k: number) => [px + out[1] * k, pz - out[0] * k] as const; // along the wall (perpendicular to out)
        const [ax, az] = along(-0.82), [bx, bz] = along(0.82), [cx2, cz2] = along(-0.78), [dx2, dz2] = along(0.78);
        ub(b, plinthM(), m, Math.min(ax, bx, ax + out[0] * 0.5), Math.max(ax, bx, ax + out[0] * 0.5), 0, 0.2, Math.min(az, bz, az + out[1] * 0.5), Math.max(az, bz, az + out[1] * 0.5)); // step
        ub(b, tm, m, Math.min(cx2, dx2, cx2 + out[0] * 0.34), Math.max(cx2, dx2, cx2 + out[0] * 0.34), 2.3, 2.44, Math.min(cz2, dz2, cz2 + out[1] * 0.34), Math.max(cz2, dz2, cz2 + out[1] * 0.34)); // hood
        continue;
      }
      for (const [y0, y1, dep, half] of [[yb - 0.2, yb - 0.08, 0.14, 0.6], [yb + 1.33, yb + 1.43, 0.08, 0.55]] as const) {
        const ax = px - out[1] * half, az = pz + out[0] * half, bx = px + out[1] * half, bz = pz - out[0] * half;
        ub(b, tm, m, Math.min(ax, bx, ax + out[0] * dep), Math.max(ax, bx, ax + out[0] * dep), y0, y1, Math.min(az, bz, az + out[1] * dep), Math.max(az, bz, az + out[1] * dep));
      }
    }
  };
  wins(w, true, (u) => [-hw + u * w, hd], [0, 1]);            // front (+z), u from -x to +x
  wins(8, false, (u) => [hw - u * w, -hd], [0, -1]);          // back: side texture (8 m layout) stretched over w
  wins(8, false, (u) => [-hw, -hd + u * d], [-1, 0]);         // left side (-x): side texture is always the 8 m layout
  wins(8, false, (u) => [hw, hd - u * d], [1, 0]);            // right side (+x)
  // chimney cap + pot
  const cz = -hd * 0.35, top = h + rh + 1.1;
  ub(b, capM(), m, chx - 0.52, chx + 0.52, top, top + 0.16, cz - 0.52, cz + 0.52);
  b.add(new THREE.CylinderGeometry(0.13, 0.16, 0.42, 10).translate(0, 0.21, 0), lam("chimPot", () => ({ color: "#b8684a" })), m.clone().multiply(new THREE.Matrix4().makeTranslation(chx, top + 0.16, cz)));
};

// ---------------- 1919 Boston North End tenements (MAT pass, molasses) ----------------
// Flat-roofed brick rows (not the bridge's gabled cottages): painted brick / cream / ochre / terracotta
// facades, stone plinth, cornice band, parapet with stone coping, window sills + lintel hoods matching
// facadeHD's window layout, front door step + hood, chimneys with caps and pots.
const TEN_STYLES: Style[] = [
  { wall: "#c0583a", shutter: "#2f5f6a", roof: "#6a6f78", brick: true },  // muted brick
  { wall: "#a94a33", shutter: "#3f6fb5", roof: "#6a6f78", brick: true },  // deep brick
  { wall: "#ecdab2", shutter: "#2f6a43", roof: "#6a6f78" },               // cream plaster
  { wall: "#d8a95f", shutter: "#5a3b2a", roof: "#6a6f78" },               // ochre plaster
  { wall: "#b0805e", shutter: "#2f5f6a", roof: "#6a6f78" },               // terracotta plaster, muted (was #c47a5c, read salmon-pink in shade)
  { wall: "#cc9a6c", shutter: "#3f6fb5", roof: "#6a6f78", brick: true },  // terracotta brick
  { wall: "#e2c49a", shutter: "#8c3b4a", roof: "#6a6f78" },               // warm sandstone
  { wall: "#b9603f", shutter: "#2f6a43", roof: "#6a6f78", brick: true },  // brick red
];

/** flat-roofed tenement: front facade (local +z) at width w, depth d, wall height h (left out if it blocks a shot) */
export const tenement = (b: Batch, x: number, z: number, yaw: number, w: number, d: number, h: number, si: number, y = D0) => {
  const across = Math.abs(Math.sin(yaw)) > 0.5, hx = (across ? d : w) / 2 + 0.6, hz = (across ? w : d) / 2 + 0.6;
  if (inTheWay(x - hx, x + hx, y, y + h + 2.4, z - hz, z + hz, false, 4)) return; // cull only if right at a lens
  const st = TEN_STYLES[si % TEN_STYLES.length];
  const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z);
  const front = lam(`tenF${si}_${w}_${h}`, () => ({ map: facadeHD(`tenF${si}_${w}_${h}`, w, h, { ...st, door: true }) }));
  const back = lam(`tenB${si}_${w}_${h}`, () => ({ map: facadeHD(`tenB${si}_${w}_${h}`, w, h, st) }));
  const side = lam(`tenS${si}_${d}_${h}`, () => ({ map: facadeHD(`tenS${si}_${d}_${h}`, d, h, st) }));
  const roof = lam("tenRoof", () => ({ color: "#54575e" }));
  const hw = w / 2, hd = d / 2;
  b.add(quad(V(-hw, 0, hd), V(hw, 0, hd), V(hw, h, hd), V(-hw, h, hd)), front, m);
  b.add(quad(V(hw, 0, -hd), V(-hw, 0, -hd), V(-hw, h, -hd), V(hw, h, -hd)), back, m);
  b.add(quad(V(-hw, 0, -hd), V(-hw, 0, hd), V(-hw, h, hd), V(-hw, h, -hd)), side, m);
  b.add(quad(V(hw, 0, hd), V(hw, 0, -hd), V(hw, h, -hd), V(hw, h, hd)), side, m);
  b.add(quad(V(-hw, h, hd), V(hw, h, hd), V(hw, h, -hd), V(-hw, h, -hd)), roof, m);
  tenementDetail(b, m, w, d, h);
};

// real 3D relief on every tenement: stone plinth, cornice band under the parapet, brick parapet with stone
// coping, window sills + lintel hoods matching facadeHD's window layout, front door step + door hood,
// chimney(s) with cap and pot
const tenementDetail = (b: Batch, m: THREE.Matrix4, w: number, d: number, h: number) => {
  const hw = w / 2, hd = d / 2, tm = trimM(), floors = Math.max(1, Math.floor(h / 2.8));
  b.add(boxGeo(V(-hw - 0.07, -0.05, -hd - 0.07), V(hw + 0.07, 0.45, hd + 0.07), 2), plinthM(), m);          // plinth
  ub(b, tm, m, -hw - 0.12, hw + 0.12, h - 0.55, h - 0.28, hd, hd + 0.15);                                   // cornice front
  ub(b, tm, m, -hw - 0.12, hw + 0.12, h - 0.55, h - 0.28, -hd - 0.15, -hd);                                 // cornice back
  for (const s of [-1, 1]) ub(b, tm, m, s < 0 ? -hw - 0.15 : hw, s < 0 ? -hw : hw + 0.15, h - 0.55, h - 0.28, -hd - 0.12, hd + 0.12);
  const par = lam("tenPar", () => ({ color: "#a34a32" }));                                                 // parapet
  ub(b, par, m, -hw - 0.09, hw + 0.09, h, h + 0.55, hd - 0.09, hd + 0.09);
  ub(b, par, m, -hw - 0.09, hw + 0.09, h, h + 0.55, -hd - 0.09, -hd + 0.09);
  ub(b, par, m, -hw - 0.09, -hw + 0.09, h, h + 0.55, -hd, hd);
  ub(b, par, m, hw - 0.09, hw + 0.09, h, h + 0.55, -hd, hd);
  ub(b, tm, m, -hw - 0.12, hw + 0.12, h + 0.55, h + 0.63, hd - 0.12, hd + 0.12);                           // coping front
  ub(b, tm, m, -hw - 0.12, hw + 0.12, h + 0.55, h + 0.63, -hd - 0.12, -hd + 0.12);                         // coping back
  ub(b, tm, m, -hw - 0.12, -hw + 0.12, h + 0.55, h + 0.63, -hd, hd);
  ub(b, tm, m, hw - 0.12, hw + 0.12, h + 0.55, h + 0.63, -hd, hd);
  // windows: facadeHD puts nWin = floor(len / 2.2) per floor at (i + 0.5) / nWin, sill line fl * 2.8 + 0.9 m
  const wins = (len: number, door: boolean, at: (u: number) => [number, number], out: [number, number]) => {
    const n = Math.max(1, Math.floor(len / 2.2));
    for (let fl = 0; fl < floors; fl++) for (let i = 0; i < n; i++) {
      const [px, pz] = at((i + 0.5) / n), yb = fl * 2.8 + 0.9;
      if (door && fl === 0 && i === Math.floor(n / 2)) {
        const along = (k: number) => [px + out[1] * k, pz - out[0] * k] as const; // along the wall (perpendicular to out)
        const [ax, az] = along(-0.82), [bx, bz] = along(0.82), [cx2, cz2] = along(-0.78), [dx2, dz2] = along(0.78);
        ub(b, plinthM(), m, Math.min(ax, bx, ax + out[0] * 0.5), Math.max(ax, bx, ax + out[0] * 0.5), 0, 0.2, Math.min(az, bz, az + out[1] * 0.5), Math.max(az, bz, az + out[1] * 0.5)); // step
        ub(b, tm, m, Math.min(cx2, dx2, cx2 + out[0] * 0.34), Math.max(cx2, dx2, cx2 + out[0] * 0.34), 2.3, 2.44, Math.min(cz2, dz2, cz2 + out[1] * 0.34), Math.max(cz2, dz2, cz2 + out[1] * 0.34)); // hood
        continue;
      }
      for (const [y0, y1, dep, half] of [[yb - 0.2, yb - 0.08, 0.14, 0.6], [yb + 1.33, yb + 1.43, 0.08, 0.55]] as const) {
        const ax = px - out[1] * half, az = pz + out[0] * half, bx = px + out[1] * half, bz = pz - out[0] * half;
        ub(b, tm, m, Math.min(ax, bx, ax + out[0] * dep), Math.max(ax, bx, ax + out[0] * dep), y0, y1, Math.min(az, bz, az + out[1] * dep), Math.max(az, bz, az + out[1] * dep));
      }
    }
  };
  wins(w, true, (u) => [-hw + u * w, hd], [0, 1]);            // front (+z), u from -x to +x
  wins(w, false, (u) => [hw - u * w, -hd], [0, -1]);          // back
  wins(d, false, (u) => [-hw, -hd + u * d], [-1, 0]);         // left side (-x)
  wins(d, false, (u) => [hw, hd - u * d], [1, 0]);            // right side (+x)
  // chimney(s) at the back of the roof, cap + pot each
  const chimM = lam("tenChim", () => ({ map: rep(brickHD(), 1, 1) }));
  for (const cx of w >= 9 ? [-w * 0.28, w * 0.28] : [0]) {
    const cz = -hd * 0.4, top = h + 1.5;
    b.add(boxGeo(V(cx - 0.4, h, cz - 0.4), V(cx + 0.4, top, cz + 0.4), 4), chimM, m);
    ub(b, capM(), m, cx - 0.52, cx + 0.52, top, top + 0.16, cz - 0.52, cz + 0.52);
    b.add(new THREE.CylinderGeometry(0.13, 0.16, 0.42, 10).translate(0, 0.21, 0), lam("chimPot", () => ({ color: "#b8684a" })), m.clone().multiply(new THREE.Matrix4().makeTranslation(cx, top + 0.16, cz)));
  }
};

// ---------------- painted extras ----------------
const chapelTex = () => ctex("chapel", 512, 512, (g) => {
  g.fillStyle = "#e9e0cc"; g.fillRect(0, 0, 512, 512);
  g.fillStyle = "rgba(0,0,0,.06)"; for (let y = 0; y < 512; y += 32) g.fillRect(0, y, 512, 2);
  for (const cx of [128, 384]) {
    g.fillStyle = "#33406b"; g.strokeStyle = "rgba(40,30,40,.85)"; g.lineWidth = 6;
    g.beginPath(); g.moveTo(cx - 40, 430); g.lineTo(cx - 40, 190); g.arc(cx, 190, 40, Math.PI, 0); g.lineTo(cx + 40, 430); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "rgba(160,200,255,.35)"; g.fillRect(cx - 30, 200, 16, 220);
    g.strokeStyle = "#d9c9a0"; g.lineWidth = 4; g.beginPath(); g.moveTo(cx, 160); g.lineTo(cx, 430); g.moveTo(cx - 40, 300); g.lineTo(cx + 40, 300); g.stroke();
  }
});
const clockTex = () => ctex("clock", 256, 256, (g) => {
  g.fillStyle = "#f7f1e1"; g.strokeStyle = "#221f2e"; g.lineWidth = 12;
  g.beginPath(); g.arc(128, 128, 112, 0, 7); g.fill(); g.stroke();
  g.lineCap = "round";
  for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6; g.lineWidth = 8; g.beginPath(); g.moveTo(128 + 80 * Math.cos(a), 128 + 80 * Math.sin(a)); g.lineTo(128 + 96 * Math.cos(a), 128 + 96 * Math.sin(a)); g.stroke(); }
  g.lineWidth = 12; g.beginPath(); g.moveTo(128, 128); g.lineTo(128, 62); g.stroke();
  g.lineWidth = 9; g.beginPath(); g.moveTo(128, 128); g.lineTo(178, 150); g.stroke();
});
/** round 4: St George's cross (England, 1831): white field, red cross (the old red + yellow diamond read as Vietnam's flag) */
export const flagTex = () => ctex("flagStGeorge", 256, 160, (g) => {
  g.fillStyle = "#f4f0e6"; g.fillRect(0, 0, 256, 160);
  g.fillStyle = "#c8323a"; g.fillRect(0, 62, 256, 36); g.fillRect(110, 0, 36, 160);
  g.fillStyle = "rgba(120,100,90,0.10)"; g.fillRect(0, 150, 256, 10); // soft hem shade
});

// ---------------- town: 1919 Boston North End, Commercial Street ----------------
// Shared set layout (all owners use these exact numbers): ground y = D0, street centreline x = 0 running
// z -55..+15, cobbles x -7..7, sidewalks to x ±10, tank centre (0, 6, -30) r 13.7 (NOT built here —
// the world owner builds the tank, the wave, the honey jar, the blueprint table and the ballpark).
// Tenement rows at |x| 15..28, heights 7 / 8.4 / 9.8 m; elevated railway west side x ≈ -22, deck y ≈ 14.
// West front row is shallower (depth 5, 15..20) so the el deck clears it; the west back row is skipped
// (the el band occupies it). Every house / el bay / prop is left out when it blocks a camera ray.

/** box beam between two points (thickness th), for the el cross-bracing */
const beamBetween = (a: THREE.Vector3, b: THREE.Vector3, th: number) => {
  const g = new THREE.BoxGeometry(th, a.distanceTo(b), th);
  const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5),
    new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()), V(1, 1, 1));
  return g.applyMatrix4(m);
};

export const buildTown = (root: THREE.Object3D, kit: Kit, rays: Ray[] = []) => {
  const b = new Batch(), r = rng(11);
  sight = rays;
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length) % a.length];

  // ---- ground: packed-earth base, cobbled street, raised stone sidewalks ----
  const earth = lam("streetEarth", () => ({ color: "#8f7d62" }));
  b.add(boxGeo(V(-32, D0 - 0.1, -56), V(32, D0, 16), 0), earth);
  const street = lam("cobbleStreetHD", () => ({ map: cobbleStreetHD() }));
  b.add(boxGeo(V(-7, D0, -55), V(7, D0 + 0.03, 15), 4), street);
  const walk = lam("sidewalkHD", () => ({ map: stoneHD("wallHD") }));
  b.add(boxGeo(V(7, D0, -55), V(10, D0 + 0.15, 15), 2), walk);
  b.add(boxGeo(V(-10, D0, -55), V(-7, D0 + 0.15, 15), 2), walk);

  // ---- brick tenement rows, fronts at |x| = 15 facing the street ----
  for (const sx of [-1, 1]) {
    const yaw = sx < 0 ? Math.PI / 2 : -Math.PI / 2; // local +z (front) faces the street
    const d = sx < 0 ? 5 : 8; // west row shallower: the el runs at x -22
    let z = -55;
    while (z < 15) {
      const w = pick([7, 9]), h = pick([7, 8.4, 9.8]);
      tenement(b, sx * (15 + d / 2), z + w / 2, yaw, w, d, h, Math.floor(r() * 8));
      z += w + (r() < 0.2 ? 2.5 : 0.3);
    }
    // back row, fronts at |x| = 24, depth 4 (east side only — the west band is the el)
    if (sx > 0) {
      let z2 = -55;
      while (z2 < 15) {
        const w = pick([7, 9]), h = pick([7, 8.4]);
        if (r() > 0.35) tenement(b, 24 + 2, z2 + w / 2, yaw, w, 4, h, Math.floor(r() * 8));
        z2 += w + 1 + r() * 4;
      }
    }
  }

  // ---- elevated railway, west side x ≈ -22, deck top y = 14, z -55..+15 ----
  // Two steel columns per bent, cross beam, twin plate girders, deck slab, two rails, diagonal bracing
  // on the street-facing line. Built bay by bay (6 m) so a bay blocking a lens is left out whole.
  const elIron = lam("elIron", () => ({ color: "#4b4f58" }));
  const elSteel = lam("elSteel", () => ({ color: "#6a6e76" }));
  const EL_X = -22, DECK_TOP = 14;
  for (let z = -54; z < 14; z += 6) {
    const z1 = Math.min(z + 6, 15);
    if (inTheWay(EL_X - 1.9, EL_X + 1.9, D0, DECK_TOP + 0.5, z - 0.3, z1 + 0.3, true)) continue;
    for (const px of [EL_X - 1.2, EL_X + 1.2]) {
      b.add(boxGeo(V(px - 0.26, D0, z - 0.26), V(px + 0.26, DECK_TOP - 0.35, z + 0.26), 2), elIron);
      b.add(boxGeo(V(px - 0.32, D0, z - 0.32), V(px + 0.32, D0 + 0.5, z + 0.32), 2), elIron); // footing
    }
    b.add(boxGeo(V(EL_X - 1.7, DECK_TOP - 0.85, z - 0.25), V(EL_X + 1.7, DECK_TOP - 0.5, z + 0.25), 2), elIron); // cross beam
    for (const gx of [EL_X - 1.35, EL_X + 1.35])
      b.add(boxGeo(V(gx - 0.22, DECK_TOP - 1.25, z), V(gx + 0.22, DECK_TOP - 0.35, z1), 2), elIron); // plate girders
    b.add(boxGeo(V(EL_X - 1.6, DECK_TOP - 0.35, z), V(EL_X + 1.6, DECK_TOP, z1), 2), elSteel); // deck slab
    for (const rx of [EL_X - 0.75, EL_X + 0.75])
      b.add(boxGeo(V(rx - 0.05, DECK_TOP, z), V(rx + 0.05, DECK_TOP + 0.15, z1), 0), elIron); // rails
    // diagonal bracing on the street-facing (east) line, between this bent and the next
    if (z1 - z > 4) {
      b.add(beamBetween(V(EL_X + 1.2, D0 + 0.6, z + 0.3), V(EL_X + 1.2, DECK_TOP - 1.0, z1 - 0.3), 0.16), elIron);
      b.add(beamBetween(V(EL_X + 1.2, DECK_TOP - 1.0, z + 0.3), V(EL_X + 1.2, D0 + 0.6, z1 - 0.3), 0.16), elIron);
    }
  }

  // ---- street furniture ----
  // gas lampposts along both sidewalks (left out where one would stand in front of the lens)
  for (const sx of [-1, 1]) for (const z of [-50, -38, -26, -14, -2, 10])
    prop(b, kit, "lamppost", sx * 9.3, D0 + 0.15, z, 3.2, sx < 0 ? Math.PI : 0);
  // firewood piles: the kids gather by the tank (shots 1-2), plus two on the sidewalks
  prop(b, kit, "firewood", 4.5, D0, -14.5, 0.7, 0.4);
  prop(b, kit, "firewood", -3.5, D0, -15.5, 0.7, 2.2);
  prop(b, kit, "firewood", 8.2, D0 + 0.15, 3, 0.6, 1.1);
  prop(b, kit, "firewood", -8.6, D0 + 0.15, -6, 0.6, 0.3);
  // buckets under the tank's near face, catching the drips (shot 3)
  prop(b, kit, "bucket", 1.6, D0, -16.9, 0.3);
  prop(b, kit, "bucket", -1.7, D0, -17.3, 0.3, 1);
  prop(b, kit, "bucket", 3.1, D0, -16.6, 0.3, 2);
  prop(b, kit, "bucket", 4.2, D0, -14.2, 0.3, 0.5);
  // a horse wagon on the street, and a spare wheel at the east kerb
  prop(b, kit, "wagon", -3.5, D0 + 0.03, 8, 0.8, 0.5);
  prop(b, kit, "wagonWheel", 9.6, D0 + 0.15, -20, 0.8, 1.2);
  // short picket-fence runs marking the front yards
  prop(b, kit, "fence", 10.4, D0, -27, 1.0, Math.PI / 2);
  prop(b, kit, "fence", 10.4, D0, -24.6, 1.0, Math.PI / 2);
  prop(b, kit, "fence", -10.4, D0, 6, 1.0, Math.PI / 2);
  prop(b, kit, "fence", -10.4, D0, 8.4, 1.0, Math.PI / 2);

  b.build(root);
  sight = [];
};
