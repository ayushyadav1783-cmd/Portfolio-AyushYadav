// Hero sky (spec §5.1, §9): one OGL renderer drawing a 3-layer starfield (~1,500 points, slow drift,
// per-point twinkle, mouse parallax 4/10/18 px) and a shader planet that sits exactly on the DOM planet,
// so scroll parallax on the DOM element still drives it. DPR capped at 1.5, paused off screen.
// Not loaded at all for reduced motion; CSS stars and the CSS planet stay as the fallback.
import { Renderer, Program, Geometry, Mesh, Transform } from 'ogl';

const STARS = 1500;

const STAR_VERT = /* glsl */ `
attribute vec2 position; attribute float size; attribute float phase; attribute float layer;
uniform float uTime; uniform vec2 uPar[3]; uniform vec2 uRes; uniform float uDpr;
varying float vAlpha;
void main() {
  int L = int(layer + 0.5);
  vec2 par = L == 0 ? uPar[0] : L == 1 ? uPar[1] : uPar[2];
  float speed = 0.004 + layer * 0.006;
  vec2 p = position;
  p.x = mod(p.x + uTime * speed + 1.0, 2.0) - 1.0;
  p += par * 2.0 / uRes;
  gl_Position = vec4(p, 0.0, 1.0);
  gl_PointSize = size * uDpr;
  vAlpha = (0.25 + 0.75 * (0.5 + 0.5 * sin(uTime * (0.6 + phase) + phase * 40.0))) * (0.45 + layer * 0.25);
}`;
const STAR_FRAG = /* glsl */ `
precision mediump float;
varying float vAlpha;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d, d);
  if (r > 0.25) discard;
  float a = vAlpha * smoothstep(0.25, 0.0, r);
  gl_FragColor = vec4(vec3(0.965, 0.953, 0.925) * a, a);
}`;

const PLANET_VERT = /* glsl */ `
attribute vec2 position;
uniform vec2 uCenter; uniform vec2 uSize;
varying vec2 vUv;
void main() { vUv = position; gl_Position = vec4(uCenter + position * uSize, 0.0, 1.0); }`;
const PLANET_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
void main() {
  float r = length(vUv);
  if (r > 1.0) discard;
  vec3 n = vec3(vUv, sqrt(1.0 - r * r));
  // Spherical coords, rotating slowly; bands run along latitude with turbulent edges.
  float lon = atan(n.x, n.z) + uTime * 0.05;
  float lat = asin(clamp(n.y, -1.0, 1.0));
  float bands = fbm(vec2(lon * 1.2, lat * 7.0 + fbm(vec2(lon * 2.0, lat * 3.0)) * 1.6));
  vec3 gold = vec3(0.96, 0.77, 0.26), orange = vec3(0.76, 0.25, 0.05), deep = vec3(0.23, 0.05, 0.03), cream = vec3(1.0, 0.96, 0.81);
  vec3 base = mix(orange, gold, smoothstep(0.35, 0.75, bands));
  base = mix(base, cream, smoothstep(0.78, 0.95, bands) * 0.6);
  vec3 L = normalize(vec3(-0.55, 0.6, 0.6));
  float diff = clamp(dot(n, L), 0.0, 1.0);
  vec3 col = mix(deep * 0.6, base, pow(diff, 0.8));
  col += cream * pow(clamp(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 24.0) * 0.25;
  float rim = smoothstep(0.75, 1.0, r);
  col = mix(col, vec3(1.0, 0.29, 0.24) * 0.9, rim * 0.55);
  float edge = smoothstep(1.0, 0.985, r);
  gl_FragColor = vec4(col * edge, edge);
}`;

export function startSky(hero: HTMLElement, planetEl: HTMLElement | null) {
  const host = hero.querySelector<HTMLElement>('.hero__sky');
  if (!host) return null;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  let renderer: Renderer;
  try {
    renderer = new Renderer({ canvas, alpha: true, premultipliedAlpha: true, dpr: Math.min(1.5, window.devicePixelRatio || 1), antialias: true, webgl: 1 });
    if (!renderer.gl) throw new Error('no webgl');
  } catch {
    return null; // CSS stars + CSS planet remain
  }
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);
  host.appendChild(canvas);
  hero.classList.add('has-gl-sky');
  if (planetEl) planetEl.classList.add('has-gl-planet');

  // Stars in NDC; layer 0 = far/small, 2 = near/bright.
  const pos = new Float32Array(STARS * 2), size = new Float32Array(STARS), phase = new Float32Array(STARS), layer = new Float32Array(STARS);
  let s = 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  for (let i = 0; i < STARS; i++) {
    const l = rnd() < 0.6 ? 0 : rnd() < 0.7 ? 1 : 2;
    pos[i * 2] = rnd() * 2 - 1;
    pos[i * 2 + 1] = 1 - rnd() * 1.35; // keep stars in the sky above the stands
    size[i] = l === 0 ? 1 + rnd() : l === 1 ? 1.6 + rnd() * 1.2 : 2.4 + rnd() * 1.6;
    phase[i] = rnd();
    layer[i] = l;
  }
  const starUniforms = { uTime: { value: 0 }, uPar: { value: [0, 0, 0, 0, 0, 0] }, uRes: { value: [1, 1] }, uDpr: { value: renderer.dpr } };
  const stars = new Mesh(gl, {
    mode: gl.POINTS,
    geometry: new Geometry(gl, { position: { size: 2, data: pos }, size: { size: 1, data: size }, phase: { size: 1, data: phase }, layer: { size: 1, data: layer } }),
    program: new Program(gl, { vertex: STAR_VERT, fragment: STAR_FRAG, uniforms: starUniforms, transparent: true, depthTest: false, depthWrite: false }),
  });
  stars.program.setBlendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const planetUniforms = { uTime: { value: 0 }, uCenter: { value: [0, 0] }, uSize: { value: [0, 0] } };
  const planet = new Mesh(gl, {
    geometry: new Geometry(gl, { position: { size: 2, data: new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]) } }),
    program: new Program(gl, { vertex: PLANET_VERT, fragment: PLANET_FRAG, uniforms: planetUniforms, transparent: true, depthTest: false, depthWrite: false }),
  });
  planet.program.setBlendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const scene = new Transform();
  stars.setParent(scene);
  if (planetEl) planet.setParent(scene);

  let w = 1, h = 1;
  const resize = () => {
    const r = hero.getBoundingClientRect();
    w = r.width; h = r.height;
    renderer.setSize(w, h);
    starUniforms.uRes.value = [w, h];
  };
  new ResizeObserver(resize).observe(hero);
  resize();

  // Mouse parallax, lerped.
  const target = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  window.addEventListener('pointermove', (e) => {
    target.x = (e.clientX / window.innerWidth - 0.5) * 2;
    target.y = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  let raf = 0, visible = true, t0 = performance.now();
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const t = (now - t0) / 1000;
    cur.x += (target.x - cur.x) * 0.06;
    cur.y += (target.y - cur.y) * 0.06;
    starUniforms.uTime.value = t;
    starUniforms.uPar.value = [-cur.x * 4, cur.y * 4, -cur.x * 10, cur.y * 10, -cur.x * 18, cur.y * 18];
    planetUniforms.uTime.value = t;
    if (planetEl) {
      const hr = hero.getBoundingClientRect(), pr = planetEl.getBoundingClientRect();
      const cx = pr.left + pr.width / 2 - hr.left, cy = pr.top + pr.height / 2 - hr.top;
      planetUniforms.uCenter.value = [(cx / w) * 2 - 1, 1 - (cy / h) * 2];
      planetUniforms.uSize.value = [pr.width / w, pr.height / h];
    }
    renderer.render({ scene });
  };
  const run = () => { if (!raf && visible && !document.hidden) { t0 = performance.now() - starUniforms.uTime.value * 1000; raf = requestAnimationFrame(frame); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) run(); else stop(); }).observe(hero);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : run()));
  run();
  return { stop };
}
