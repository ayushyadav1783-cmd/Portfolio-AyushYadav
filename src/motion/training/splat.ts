// Drill #7/#11 Splat Lab: a real-time 3D Gaussian Splatting rasteriser (OGL / WebGL2).
// Per-splat 3D covariance → 2D screen covariance via the EWA Jacobian (as in Kerbl et al. 2023),
// front-to-back depth sorting, "under" blending. Procedural lab scene with semantic labels, a toy
// open-vocab matcher, training replay, depth + footprint debug views, fly-through, AR4 grasp target.
import { Renderer, Program, Geometry, Mesh } from 'ogl';
import { loop, pointer, rgba, seeded, gauss, mono, GOLD, RED, LIGHT, MUTED, type Drill, type DrillCtx } from './util';

const MAX = 30000;
const LABELS = ['floor', 'wall', 'table', 'mug', 'box', 'plant', 'banana'] as const;
type Label = (typeof LABELS)[number];

const QUIPS: Record<string, string> = {
  mug: 'Mug located. Coffee not included.',
  box: 'Gold box located. Contents unverified.',
  plant: 'Plant located. Someone should water it.',
  banana: 'Banana located. Scale reference acquired.',
  table: 'Table located. Holding everything up, as usual.',
  floor: 'Floor located. It was always there for you.',
};
const WORDS: Record<string, string[]> = {
  mug: ['mug', 'cup', 'coffee', 'tea', 'drink', 'red', 'sip', 'espresso', 'latte'],
  box: ['box', 'gold', 'package', 'parcel', 'cube', 'crate'],
  plant: ['plant', 'leaf', 'leaves', 'green', 'pot', 'flower', 'tree'],
  banana: ['banana', 'fruit', 'potassium', 'yellow'],
  table: ['table', 'desk', 'surface', 'bench'],
  floor: ['floor', 'ground', 'carpet'],
};

// ---- procedural scene ----------------------------------------------------------
type Splat = { p: [number, number, number]; s: [number, number, number]; yaw: number; tilt: number; c: [number, number, number, number]; label: number };

function buildScene(): Splat[] {
  const r = seeded(77);
  const out: Splat[] = [];
  const L = (n: Label) => LABELS.indexOf(n);
  const add = (p: Splat['p'], s: Splat['s'], c: [number, number, number], label: number, a = 0.9, yaw = r() * Math.PI, tilt = 0) =>
    out.push({ p, s, yaw, tilt, c: [c[0], c[1], c[2], a], label });
  const jitter = (c: [number, number, number], k = 0.06): [number, number, number] => [c[0] + gauss(r) * k, c[1] + gauss(r) * k, c[2] + gauss(r) * k];

  for (let i = 0; i < 6500; i++) { // floor: warm checker
    const x = (r() - 0.5) * 4, z = (r() - 0.5) * 3;
    const chk = (Math.floor(x * 2) + Math.floor(z * 2)) & 1;
    add([x, 0, z], [0.06, 0.004, 0.06], jitter(chk ? [0.16, 0.15, 0.17] : [0.21, 0.19, 0.2], 0.02), L('floor'));
  }
  for (let i = 0; i < 3200; i++) { // back wall with a soft floodlight glow
    const x = (r() - 0.5) * 4, y = r() * 2;
    const glow = Math.exp(-((x - 0.6) ** 2 + (y - 1.4) ** 2) / 0.5);
    add([x, y, -1.4], [0.07, 0.07, 0.004], jitter([0.1 + glow * 0.5, 0.1 + glow * 0.42, 0.13 + glow * 0.18], 0.015), L('wall'));
  }
  for (let i = 0; i < 4200; i++) { // table top
    const x = (r() - 0.5) * 1.6, z = (r() - 0.5) * 1.0;
    add([x, 0.62, z], [0.035, 0.006, 0.035], jitter([0.42, 0.3, 0.2], 0.03), L('table'));
  }
  for (const [lx, lz] of [[-0.72, -0.42], [0.72, -0.42], [-0.72, 0.42], [0.72, 0.42]]) for (let i = 0; i < 300; i++) {
    add([lx + gauss(r) * 0.015, r() * 0.62, lz + gauss(r) * 0.015], [0.02, 0.03, 0.02], jitter([0.32, 0.22, 0.15], 0.02), L('table'));
  }
  for (let i = 0; i < 2600; i++) { // mug body
    const a = r() * Math.PI * 2, y = r() * 0.24;
    add([0.28 + Math.cos(a) * 0.09, 0.63 + y, 0.12 + Math.sin(a) * 0.09], [0.012, 0.012, 0.012], jitter([0.85, 0.2, 0.17], 0.04), L('mug'));
  }
  for (let i = 0; i < 400; i++) { // mug handle
    const a = r() * Math.PI * 2, b = r() * Math.PI * 2;
    add([0.28 + 0.12 + Math.cos(a) * (0.05 + Math.cos(b) * 0.012), 0.75 + Math.sin(a) * (0.05 + Math.cos(b) * 0.012), 0.12 + Math.sin(b) * 0.012], [0.008, 0.008, 0.008], jitter([0.85, 0.2, 0.17], 0.04), L('mug'));
  }
  for (let i = 0; i < 300; i++) { const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 0.085; add([0.28 + Math.cos(a) * rr, 0.86, 0.12 + Math.sin(a) * rr], [0.012, 0.003, 0.012], jitter([0.18, 0.1, 0.06], 0.02), L('mug')); }
  for (let i = 0; i < 2200; i++) { // gold box (cuboid surface)
    const f = Math.floor(r() * 5), u = r() - 0.5, v = r() - 0.5, hx = 0.17, hy = 0.12, hz = 0.13;
    const p: Splat['p'] = f === 0 ? [u * 2 * hx, hy * 2, v * 2 * hz] : f === 1 ? [hx, (v + 0.5) * hy * 2, u * 2 * hz] : f === 2 ? [-hx, (v + 0.5) * hy * 2, u * 2 * hz] : f === 3 ? [u * 2 * hx, (v + 0.5) * hy * 2, hz] : [u * 2 * hx, (v + 0.5) * hy * 2, -hz];
    add([p[0] - 0.42, p[1] + 0.62, p[2] - 0.15], [0.015, 0.015, 0.015], jitter([0.96, 0.77, 0.26], 0.03), L('box'));
  }
  for (let i = 0; i < 1300; i++) { // plant pot
    const a = r() * Math.PI * 2, y = r() * 0.18;
    add([-0.15 + Math.cos(a) * (0.08 + y * 0.15), 0.63 + y, -0.3 + Math.sin(a) * (0.08 + y * 0.15)], [0.012, 0.012, 0.012], jitter([0.55, 0.32, 0.2], 0.03), L('plant'));
  }
  for (let i = 0; i < 3200; i++) { // leaves: elongated, tilted Gaussians
    const a = r() * Math.PI * 2, rr = 0.05 + r() * 0.22, y = 0.85 + r() * 0.35;
    add([-0.15 + Math.cos(a) * rr * 0.8, y - rr * 0.4, -0.3 + Math.sin(a) * rr * 0.8], [0.035, 0.006, 0.012], jitter([0.22, 0.52, 0.3], 0.05), L('plant'), 0.85, a, -0.6 + r() * 0.4);
  }
  for (let i = 0; i < 1200; i++) { // banana: a curved tube
    const t = r(), a = r() * Math.PI * 2, ang = -0.8 + t * 1.6;
    const cx = 0.05 + Math.sin(ang) * 0.17, cz = 0.32 + (1 - Math.cos(ang)) * 0.17 - 0.08;
    add([cx + Math.cos(a) * 0.025, 0.655 + Math.sin(a) * 0.025, cz], [0.01, 0.01, 0.01], jitter([0.92, 0.82, 0.35], 0.03), L('banana'));
  }
  // Stable shuffle so the budget slider removes splats evenly across the scene.
  for (let i = out.length - 1; i > 0; i--) { const k = Math.floor(r() * (i + 1)); [out[i], out[k]] = [out[k], out[i]]; }
  return out.slice(0, MAX);
}

/** Upper-triangular 3D covariance Σ = R S Sᵀ Rᵀ (R = Ry(yaw) Rx(tilt)). */
function covariance(s: Splat['s'], yaw: number, tilt: number) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(tilt), sx = Math.sin(tilt);
  const R = [cy, sy * sx, sy * cx, 0, cx, -sx, -sy, cy * sx, cy * cx];
  const M = [0, 1, 2].map((i) => [0, 1, 2].map((j) => R[i * 3 + j] * s[j]));
  const S = (i: number, j: number) => M[i][0] * M[j][0] + M[i][1] * M[j][1] + M[i][2] * M[j][2];
  return [S(0, 0), S(0, 1), S(0, 2), S(1, 1), S(1, 2), S(2, 2)];
}

const VERT = /* glsl */ `#version 300 es
precision highp float;
in vec2 position;
in vec3 center; in vec4 color; in vec3 covA; in vec3 covB; in float label;
uniform mat4 view; uniform mat4 proj; uniform vec2 focal; uniform vec2 viewport;
uniform float uHi; uniform float uTrain; uniform float uDepth;
out vec4 vColor; out vec2 vPos;
float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  float h = hash(center);
  // Training replay: few, large, grey, misplaced Gaussians densify into the final scene.
  if (h > mix(0.1, 1.0, uTrain)) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  vec3 jit = vec3(hash(center + 1.3), hash(center + 2.7), hash(center + 5.1)) - 0.5;
  vec3 c = center + jit * 0.35 * (1.0 - uTrain);
  float grow = mix(4.0, 1.0, uTrain);
  vec4 cam = view * vec4(c, 1.0);
  vec4 pos2d = proj * cam;
  float clip = 1.2 * pos2d.w;
  if (cam.z < 0.05 || pos2d.x < -clip || pos2d.x > clip || pos2d.y < -clip || pos2d.y > clip) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  mat3 Vrk = mat3(covA.x, covA.y, covA.z, covA.y, covB.x, covB.y, covA.z, covB.y, covB.z) * grow * grow;
  mat3 J = mat3(focal.x / cam.z, 0.0, -(focal.x * cam.x) / (cam.z * cam.z),
                0.0, -focal.y / cam.z, (focal.y * cam.y) / (cam.z * cam.z),
                0.0, 0.0, 0.0);
  mat3 T = transpose(mat3(view)) * J;
  mat3 cov2d = transpose(T) * Vrk * T;
  float mid = (cov2d[0][0] + cov2d[1][1]) / 2.0;
  float radius = length(vec2((cov2d[0][0] - cov2d[1][1]) / 2.0, cov2d[0][1]));
  float l1 = mid + radius, l2 = mid - radius;
  if (l2 < 0.0) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  vec2 diag = normalize(vec2(cov2d[0][1], l1 - cov2d[0][0]));
  vec2 major = min(sqrt(2.0 * l1), 1024.0) * diag;
  vec2 minor = min(sqrt(2.0 * l2), 1024.0) * vec2(diag.y, -diag.x);

  vec3 col = mix(vec3(dot(color.rgb, vec3(0.33))), color.rgb, uTrain);
  float a = color.a;
  if (uHi >= 0.0) {
    if (abs(label - uHi) < 0.5) { col = mix(col, vec3(0.96, 0.77, 0.26), 0.45) * 1.25; }
    else { col *= 0.28; }
  }
  if (uDepth > 0.5) { float d = clamp((cam.z - 1.2) / 3.0, 0.0, 1.0); col = mix(vec3(0.96, 0.77, 0.26), vec3(0.1, 0.1, 0.16), d); }
  vColor = vec4(col, a);
  vPos = position;
  vec2 ctr = pos2d.xy / pos2d.w;
  gl_Position = vec4(ctr + position.x * major / viewport + position.y * minor / viewport, 0.0, 1.0);
}`;

const FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec4 vColor; in vec2 vPos;
uniform float uDebug;
out vec4 fragColor;
void main() {
  float A = -dot(vPos, vPos);
  if (A < -4.0) discard;
  float B = exp(A) * vColor.a;
  if (uDebug > 0.5) B = (A > -4.0 && A < -3.4) ? 0.9 : B * 0.15;
  fragColor = vec4(B * vColor.rgb, B);
}`;

export function start(ctx: DrillCtx): Drill {
  const { stage, out } = ctx;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  stage.appendChild(canvas);
  const hud = document.createElement('canvas');
  hud.setAttribute('aria-hidden', 'true');
  stage.appendChild(hud);
  const hc = hud.getContext('2d')!;

  const renderer = new Renderer({ canvas, alpha: true, premultipliedAlpha: true, dpr: Math.min(1.5, window.devicePixelRatio || 1), antialias: false });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);

  const scene = buildScene();
  const N = scene.length;
  const cov = scene.map((s) => covariance(s.s, s.yaw, s.tilt));
  const buf = {
    center: new Float32Array(N * 3), color: new Float32Array(N * 4), covA: new Float32Array(N * 3), covB: new Float32Array(N * 3), label: new Float32Array(N),
  };
  const geometry = new Geometry(gl, {
    position: { size: 2, data: new Float32Array([-2, -2, 2, -2, -2, 2, 2, 2]) },
    center: { instanced: 1, size: 3, data: buf.center },
    color: { instanced: 1, size: 4, data: buf.color },
    covA: { instanced: 1, size: 3, data: buf.covA },
    covB: { instanced: 1, size: 3, data: buf.covB },
    label: { instanced: 1, size: 1, data: buf.label },
  });
  const uniforms = {
    view: { value: new Float32Array(16) }, proj: { value: new Float32Array(16) },
    focal: { value: [1, 1] }, viewport: { value: [1, 1] },
    uHi: { value: -1 }, uTrain: { value: 1 }, uDepth: { value: 0 }, uDebug: { value: 0 },
  };
  const program = new Program(gl, { vertex: VERT, fragment: FRAG, uniforms, transparent: true, depthTest: false, depthWrite: false, cullFace: false as unknown as number });
  program.setBlendFunc(gl.ONE_MINUS_DST_ALPHA, gl.ONE, gl.ONE_MINUS_DST_ALPHA, gl.ONE);
  const mesh = new Mesh(gl, { geometry, program, mode: gl.TRIANGLE_STRIP });

  const ui = {
    budget: ctx.ctl('budget')!, ellipses: ctx.ctl('ellipses')!, depth: ctx.ctl('depth')!, orbit: ctx.ctl('orbit')!,
    query: ctx.ctl('query')!, form: ctx.ctl<HTMLFormElement>('query-form')!,
  };

  // ---- camera ---------------------------------------------------------------
  const target: [number, number, number] = [0, 0.7, 0];
  let cam = { yaw: 0.5, pitch: 0.42, radius: 2.4 };
  let w = 1, h = 1, fx = 1;
  let viewDirty = true;
  const sub = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const nrm = (a: number[]) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const dotv = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  let basis = { r: [1, 0, 0], d: [0, -1, 0], f: [0, 0, 1], eye: [0, 0, 0] };

  function updateCamera() {
    const eye = [
      target[0] + cam.radius * Math.cos(cam.pitch) * Math.sin(cam.yaw),
      target[1] + cam.radius * Math.sin(cam.pitch),
      target[2] + cam.radius * Math.cos(cam.pitch) * Math.cos(cam.yaw),
    ];
    const f = nrm(sub(target, eye));
    const r = nrm(cross(f, [0, 1, 0]));
    const d = cross(f, r);
    basis = { r, d, f, eye };
    const V = uniforms.view.value;
    V.set([r[0], d[0], f[0], 0, r[1], d[1], f[1], 0, r[2], d[2], f[2], 0, -dotv(r, eye), -dotv(d, eye), -dotv(f, eye), 1]);
    const near = 0.05, far = 50;
    uniforms.proj.value.set([(2 * fx) / w, 0, 0, 0, 0, -(2 * fx) / h, 0, 0, 0, 0, far / (far - near), 1, 0, 0, -(far * near) / (far - near), 0]);
    uniforms.focal.value = [fx, fx];
    uniforms.viewport.value = [w, h];
  }
  function resize() {
    const rr = stage.getBoundingClientRect();
    w = rr.width; h = rr.height; fx = h * 0.95;
    renderer.setSize(w, h);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    hud.width = Math.round(w * dpr); hud.height = Math.round(h * dpr);
    hc.setTransform(dpr, 0, 0, dpr, 0, 0);
    viewDirty = true;
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  // ---- front-to-back depth sort (16-bit counting sort) ----------------------------
  const depths = new Float32Array(N), keys = new Uint32Array(N), order = new Uint32Array(N), counts = new Uint32Array(65536), starts = new Uint32Array(65536);
  function sort(M: number) {
    const { f, eye } = basis;
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < M; i++) {
      const p = scene[i].p;
      const z = f[0] * (p[0] - eye[0]) + f[1] * (p[1] - eye[1]) + f[2] * (p[2] - eye[2]);
      depths[i] = z; if (z < mn) mn = z; if (z > mx) mx = z;
    }
    const scale = 65535 / Math.max(1e-6, mx - mn);
    counts.fill(0);
    for (let i = 0; i < M; i++) { const k = ((depths[i] - mn) * scale) | 0; keys[i] = k; counts[k]++; }
    starts[0] = 0;
    for (let k = 1; k < 65536; k++) starts[k] = starts[k - 1] + counts[k - 1];
    for (let i = 0; i < M; i++) order[starts[keys[i]]++] = i;
    for (let n = 0; n < M; n++) {
      const s = scene[order[n]], cv = cov[order[n]];
      buf.center.set(s.p, n * 3); buf.color.set(s.c, n * 4);
      buf.covA[n * 3] = cv[0]; buf.covA[n * 3 + 1] = cv[1]; buf.covA[n * 3 + 2] = cv[2];
      buf.covB[n * 3] = cv[3]; buf.covB[n * 3 + 1] = cv[4]; buf.covB[n * 3 + 2] = cv[5];
      buf.label[n] = s.label;
    }
    for (const k of ['center', 'color', 'covA', 'covB', 'label'] as const) geometry.attributes[k].needsUpdate = true;
  }

  // ---- query, target, grasp -------------------------------------------------------
  let hiLabel = -1, quip = '', matched: string[] = [];
  let targetXYZ: number[] | null = null;
  let grasp = 0; // 0..1 animation
  function query(text: string) {
    const q = text.toLowerCase();
    let best = '', bestN = 0, hits: string[] = [];
    for (const [lab, words] of Object.entries(WORDS)) {
      const h2 = words.filter((wd) => q.includes(wd));
      if (h2.length > bestN) { bestN = h2.length; best = lab; hits = h2; }
    }
    // "banana" beats "yellow"-ish matches, "mug" beats "red": first specific noun wins ties.
    if (q.includes('banana')) { best = 'banana'; hits = ['banana']; }
    if (!best) { hiLabel = -1; targetXYZ = null; quip = 'No match. This toy matcher knows mugs, boxes, plants, bananas, tables and floors. The real CLIP knows far more.'; matched = []; return; }
    hiLabel = LABELS.indexOf(best as Label);
    matched = hits;
    quip = QUIPS[best] ?? '';
    const pts = scene.filter((s) => s.label === hiLabel);
    targetXYZ = [0, 1, 2].map((k) => pts.reduce((s, p) => s + p.p[k], 0) / pts.length);
    grasp = 0;
  }
  ui.form.addEventListener('submit', (e) => { e.preventDefault(); query(ui.query.value); });
  ctx.panel.querySelectorAll<HTMLButtonElement>('[data-q]').forEach((b) => b.addEventListener('click', () => { ui.query.value = b.dataset.q!; query(b.dataset.q!); }));

  let train = 1, training = false;
  ctx.ctl('train')?.addEventListener('click', () => { train = 0; training = true; });
  ctx.ctl('grasp')?.addEventListener('click', () => { if (!targetXYZ) query('red mug'); grasp = 0.0001; });
  let fly = 0;
  ctx.ctl('fly')?.addEventListener('click', () => { fly = 0.0001; });

  // ---- input --------------------------------------------------------------------
  let drag: { x: number; y: number; yaw: number; pitch: number } | null = null;
  stage.addEventListener('pointerdown', (e) => { const p = pointer(stage, e); drag = { ...p, yaw: cam.yaw, pitch: cam.pitch }; stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = pointer(stage, e);
    cam.yaw = drag.yaw - (p.x - drag.x) * 0.008;
    cam.pitch = Math.max(0.05, Math.min(1.25, drag.pitch + (p.y - drag.y) * 0.006));
    viewDirty = true;
  });
  stage.addEventListener('pointerup', () => { drag = null; });

  // ---- HUD ------------------------------------------------------------------------
  function project(p: number[]) {
    const { r, d, f, eye } = basis;
    const v = sub(p, eye);
    const x = dotv(v, r), y = dotv(v, d), z = dotv(v, f);
    return { x: w / 2 + (fx * x) / z, y: h / 2 + (fx * y) / z, z };
  }
  function drawHud(fps: number) {
    hc.clearRect(0, 0, w, h);
    mono(hc, 11); hc.fillStyle = LIGHT;
    hc.fillText(training ? `TRAINING · STEP ${Math.round(train * 30000).toLocaleString('en-US')} / 30,000` : 'DRAG TO ORBIT', 16, 22);
    hc.fillStyle = MUTED; hc.fillText(`${Math.round(fps)} FPS`, w - 70, 22);
    if (targetXYZ) {
      const q = project(targetXYZ);
      const s = 26;
      hc.strokeStyle = GOLD; hc.lineWidth = 2;
      hc.strokeRect(q.x - s, q.y - s, s * 2, s * 2);
      hc.beginPath(); hc.moveTo(q.x - s - 8, q.y); hc.lineTo(q.x + s + 8, q.y); hc.moveTo(q.x, q.y - s - 8); hc.lineTo(q.x, q.y + s + 8); hc.stroke();
      mono(hc, 11); hc.fillStyle = GOLD;
      hc.fillText(`XYZ ${targetXYZ.map((v) => v.toFixed(2)).join(', ')}`, q.x + s + 10, q.y - s + 4);
      if (grasp > 0) {
        // Gripper descends from above the target, closes, lifts.
        const k = Math.min(1, grasp);
        const down = k < 0.5 ? k / 0.5 : 1, close = k > 0.5 ? Math.min(1, (k - 0.5) / 0.2) : 0, up = k > 0.75 ? (k - 0.75) / 0.25 : 0;
        const top = project([targetXYZ[0], targetXYZ[1] + 1.2, targetXYZ[2]]);
        const gy = top.y + (q.y - 14 - top.y) * down - up * 40;
        hc.strokeStyle = LIGHT; hc.lineWidth = 3;
        hc.beginPath(); hc.moveTo(q.x, top.y - 60); hc.lineTo(q.x, gy); hc.stroke();
        const open = 22 * (1 - close) + 8;
        hc.beginPath(); hc.moveTo(q.x - open, gy); hc.lineTo(q.x + open, gy); hc.moveTo(q.x - open, gy); hc.lineTo(q.x - open + 4, gy + 18); hc.moveTo(q.x + open, gy); hc.lineTo(q.x + open - 4, gy + 18); hc.stroke();
        if (k >= 1) { mono(hc, 12); hc.fillStyle = GOLD; hc.fillText('GRASP TARGET SENT TO AR4 (SIMULATED)', 16, h - 40); }
      }
    }
    if (quip) {
      mono(hc, 12); hc.fillStyle = hiLabel >= 0 ? GOLD : RED;
      hc.fillText(quip.toUpperCase(), 16, h - 18);
    }
    if (ui.ellipses.checked) { mono(hc, 10); hc.fillStyle = rgba(LIGHT, 0.7); hc.fillText('EACH RING = ONE GAUSSIAN AT 2σ', 16, 40); }
  }

  // ---- loop -------------------------------------------------------------------------
  let fpsAvg = 60;
  let flyFrom = { ...cam };
  const L = loop((dt) => {
    if (fly > 0) {
      if (fly === 0.0001) flyFrom = { ...cam };
      fly = Math.min(1, fly + dt / 7);
      cam.yaw = flyFrom.yaw + fly * Math.PI * 2;
      cam.radius = 2.4 - Math.sin(fly * Math.PI) * 1.1;
      cam.pitch = 0.42 + Math.sin(fly * Math.PI * 2) * 0.25;
      viewDirty = true;
      if (fly >= 1) fly = 0;
    } else if (!drag && ui.orbit.checked && !ctx.reduced) { cam.yaw += dt * 0.15; viewDirty = true; }
    if (training) { train = Math.min(1, train + dt / 3.2); if (train >= 1) training = false; }
    if (grasp > 0 && grasp < 1) grasp = Math.min(1, grasp + dt / 2.4);

    const budget = Math.min(N, Number(ui.budget.value));
    geometry.setInstancedCount(budget);
    if (viewDirty) { updateCamera(); sort(budget); viewDirty = false; }
    uniforms.uHi.value = hiLabel;
    uniforms.uTrain.value = train * train * (3 - 2 * train);
    uniforms.uDepth.value = ui.depth.checked ? 1 : 0;
    uniforms.uDebug.value = ui.ellipses.checked ? 1 : 0;
    renderer.render({ scene: mesh });
    fpsAvg = fpsAvg * 0.92 + (1 / Math.max(dt, 1e-3)) * 0.08;
    drawHud(fpsAvg);

    out('splats', 'Gaussians drawn', Math.round(budget * (0.1 + 0.9 * uniforms.uTrain.value)).toLocaleString('en-US'));
    out('fps', 'Frame rate', `${Math.round(fpsAvg)} fps`, fpsAvg < 30);
    out('match', 'Matched words', matched.length ? matched.join(', ') : '·');
  });

  // The budget takes the first N of a stable shuffle, so the scene thins evenly.
  ui.budget.addEventListener('input', () => { viewDirty = true; });
  query('');
  quip = '';
  L.start();
  return { pause: L.stop, resume: L.start };
}
