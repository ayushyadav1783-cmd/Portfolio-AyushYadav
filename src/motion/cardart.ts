// Animated project sketches for the Starting VII cards and match reports (Ayush's request, 2026-10-04).
// Original procedural illustrations of each project, not real outputs: labelled as such on the card.
// One rAF loop drives every visible canvas; nothing runs off screen. Reduced motion: one still frame.
import { reducedMotion } from './env';

const GOLD = '#f5c542';
const RED = '#ff4a3d';
const LIGHT = '#f6f3ec';

type Draw = (c: CanvasRenderingContext2D, w: number, h: number, t: number) => void;

// ---- tiny 3D helpers ---------------------------------------------------------
type P3 = { x: number; y: number; z: number; c: string; r: number; tag?: number };
const rotY = (p: P3, a: number) => ({ ...p, x: p.x * Math.cos(a) + p.z * Math.sin(a), z: -p.x * Math.sin(a) + p.z * Math.cos(a) });
const rotX = (p: P3, a: number) => ({ ...p, y: p.y * Math.cos(a) - p.z * Math.sin(a), z: p.y * Math.sin(a) + p.z * Math.cos(a) });
function project(p: P3, w: number, h: number, scale: number, cx = 0.62, cy = 0.58) {
  const d = 3.2 / (3.2 + p.z);
  return { x: w * cx + p.x * scale * d, y: h * cy - p.y * scale * d, d };
}
function seeded(seed: number) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

/** A small lab scene as gaussians: table, red mug (tag 1), gold box, pale plant. */
function labScene(n = 420): P3[] {
  const r = seeded(11);
  const pts: P3[] = [];
  for (let i = 0; i < n; i++) {
    const k = r();
    if (k < 0.45) { // table top
      const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 1.05;
      pts.push({ x: Math.cos(a) * rr, y: -0.05 + r() * 0.04, z: Math.sin(a) * rr * 0.75, c: '#6e6d7a', r: 0.05 + r() * 0.05 });
    } else if (k < 0.7) { // mug
      const a = r() * Math.PI * 2;
      pts.push({ x: 0.25 + Math.cos(a) * 0.2, y: r() * 0.45, z: 0.1 + Math.sin(a) * 0.2, c: RED, r: 0.04 + r() * 0.03, tag: 1 });
    } else if (k < 0.85) { // box
      pts.push({ x: -0.55 + (r() - 0.5) * 0.4, y: r() * 0.3, z: -0.2 + (r() - 0.5) * 0.4, c: GOLD, r: 0.04 + r() * 0.03 });
    } else { // plant
      const a = r() * Math.PI * 2, rr = r() * 0.28;
      pts.push({ x: -0.2 + Math.cos(a) * rr, y: 0.45 + Math.sin(a) * rr * 0.8 + r() * 0.2, z: 0.45 + (r() - 0.5) * 0.2, c: LIGHT, r: 0.04 + r() * 0.04 });
    }
  }
  return pts;
}
const SCENE = labScene();

function splats(c: CanvasRenderingContext2D, w: number, h: number, t: number, highlight = -1) {
  const scale = Math.min(w, h * 1.6) * 0.42;
  const pts = SCENE.map((p) => rotX(rotY(p, t * 0.35), -0.35)).sort((a, b) => b.z - a.z);
  for (const p of pts) {
    const q = project(p, w, h, scale);
    const rad = Math.max(1.5, p.r * scale * q.d);
    const dim = highlight >= 0 && p.tag !== highlight;
    const col = highlight >= 0 && p.tag === highlight ? GOLD : p.c;
    const g = c.createRadialGradient(q.x, q.y, 0, q.x, q.y, rad);
    g.addColorStop(0, hexA(col, dim ? 0.18 : 0.85));
    g.addColorStop(1, hexA(col, 0));
    c.fillStyle = g;
    c.beginPath(); c.arc(q.x, q.y, rad, 0, Math.PI * 2); c.fill();
  }
  return { scale };
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
const mono = (c: CanvasRenderingContext2D, px: number) => { c.font = `700 ${px}px "JetBrains Mono", ui-monospace, monospace`; };

// ---- the seven sketches ------------------------------------------------------
export const DRAW: Record<string, Draw> = {
  /** #7 Language-grounded 3DGS: an orbiting splat scene; a reticle locks the mug as an XYZ target. */
  ST(c, w, h, t) {
    const { scale } = splats(c, w, h, t);
    const cyc = t % 5;
    if (cyc > 2.2) {
      const mug = project(rotX(rotY({ x: 0.25, y: 0.22, z: 0.1, c: '', r: 0 }, t * 0.35), -0.35), w, h, scale);
      const k = Math.min(1, (cyc - 2.2) / 0.5);
      const s = 34 - 18 * k;
      c.strokeStyle = GOLD; c.lineWidth = 1.5;
      c.strokeRect(mug.x - s, mug.y - s, s * 2, s * 2);
      c.beginPath(); c.moveTo(mug.x - s - 6, mug.y); c.lineTo(mug.x + s + 6, mug.y); c.moveTo(mug.x, mug.y - s - 6); c.lineTo(mug.x, mug.y + s + 6); c.stroke();
      if (k === 1) { mono(c, Math.max(9, w / 26)); c.fillStyle = GOLD; c.fillText('XYZ → AR4', mug.x + s + 8, mug.y - s); }
    }
  },
  /** #11 Open-vocab queries: a plain-words query types in and the matching splats light up. */
  LW(c, w, h, t) {
    const cyc = t % 6;
    const q = '"the red mug"';
    const typed = q.slice(0, Math.max(0, Math.min(q.length, Math.floor((cyc - 0.4) * 9))));
    splats(c, w, h, t * 0.6, cyc > 2.2 ? 1 : -1);
    mono(c, Math.max(9, w / 24));
    c.fillStyle = LIGHT;
    c.fillText(`query: ${typed}${cyc < 2.2 && Math.floor(t * 3) % 2 ? '▌' : ''}`, w * 0.36, h * 0.86);
  },
  /** #19 UAV detection + MOT: drones on smooth paths with gold track boxes, IDs and trails. */
  RW(c, w, h, t) {
    for (let i = 0; i < 3; i++) {
      const path = (tt: number) => ({
        x: w * (0.62 + 0.3 * Math.sin(tt * (0.5 + i * 0.17) + i * 2)),
        y: h * (0.45 + 0.28 * Math.sin(tt * (0.9 + i * 0.11) + i)),
      });
      // trail
      c.strokeStyle = hexA(GOLD, 0.35); c.lineWidth = 1; c.beginPath();
      for (let k = 0; k <= 20; k++) { const p = path(t - k * 0.06); k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); }
      c.stroke();
      const p = path(t);
      drone(c, p.x, p.y, Math.max(7, w / 30), t);
      const s = Math.max(12, w / 16);
      // noisy detection + steady track
      const jx = Math.sin(t * 13 + i) * 3, jy = Math.cos(t * 11 + i) * 3;
      c.setLineDash([3, 3]); c.strokeStyle = hexA(RED, 0.8); c.strokeRect(p.x - s + jx, p.y - s * 0.7 + jy, s * 2, s * 1.4); c.setLineDash([]);
      c.strokeStyle = GOLD; c.lineWidth = 1.5; c.strokeRect(p.x - s, p.y - s * 0.7, s * 2, s * 1.4);
      mono(c, Math.max(8, w / 30)); c.fillStyle = GOLD; c.fillText(`ID ${i + 1}`, p.x - s, p.y - s * 0.7 - 3);
    }
  },
  /** #10 Sim-to-real: the gold cloud swings from a 28° mis-tilt into alignment with the robot frame. */
  CAM(c, w, h, t) {
    const cyc = t % 5;
    const k = cyc < 1 ? 0 : cyc < 3 ? easeInOut((cyc - 1) / 2) : 1;
    const tilt = (28 * (1 - k) * Math.PI) / 180;
    const scale = Math.min(w, h * 1.6) * 0.36;
    for (const [col, a] of [[LIGHT, 0], [GOLD, tilt]] as const) {
      for (const p of SCENE) {
        const q = project(rotX(rotY(rotX(p, a), 0.6), -0.3), w, h, scale);
        c.fillStyle = hexA(col, col === GOLD ? 0.8 : 0.35);
        c.fillRect(q.x, q.y, 1.6, 1.6);
      }
    }
    mono(c, Math.max(9, w / 24)); c.fillStyle = k === 1 ? GOLD : LIGHT;
    c.fillText(`tilt ${Math.round(28 * (1 - k))}°`, w * 0.62, h * 0.9);
  },
  /** #8 Semantic perception: a robot roams a maze; detections travel the pipeline into the database. */
  CM(c, w, h, t) {
    const ox = w * 0.38, oy = h * 0.14, mw = w * 0.36, mh = h * 0.5;
    c.strokeStyle = hexA(LIGHT, 0.35); c.lineWidth = 1.5;
    c.strokeRect(ox, oy, mw, mh);
    c.beginPath(); c.moveTo(ox + mw * 0.33, oy); c.lineTo(ox + mw * 0.33, oy + mh * 0.6); c.moveTo(ox + mw * 0.66, oy + mh); c.lineTo(ox + mw * 0.66, oy + mh * 0.4); c.stroke();
    const u = (t * 0.18) % 1;
    const rx = ox + mw * (0.16 + 0.68 * (u < 0.5 ? u * 2 : 2 - u * 2));
    const ry = oy + mh * (0.5 + 0.35 * Math.sin(t * 1.3));
    c.fillStyle = LIGHT; c.beginPath(); c.arc(rx, ry, Math.max(4, w / 50), 0, Math.PI * 2); c.fill();
    const nodes = ['ROS2', 'YOLO', 'ZENOH', 'PG'];
    const ny = h * 0.8;
    mono(c, Math.max(7, w / 34));
    nodes.forEach((n, i) => {
      const nx = w * (0.4 + i * 0.17);
      c.strokeStyle = hexA(GOLD, 0.7); c.strokeRect(nx - w * 0.06, ny - 9, w * 0.12, 18);
      c.fillStyle = GOLD; c.fillText(n, nx - w * 0.05, ny + 4);
    });
    for (let k = 0; k < 3; k++) {
      const pu = (t * 0.6 + k / 3) % 1;
      const px = w * (0.4 + pu * 0.51);
      c.fillStyle = RED; c.beginPath(); c.arc(px, ny - 14, 3, 0, Math.PI * 2); c.fill();
    }
  },
  /** #4 TCC: two clips of the same motion at different speeds; a frame cycles across and back. */
  CB(c, w, h, t) {
    const n = 9, fw = w * 0.055, gap = w * 0.012, x0 = w * 0.36;
    const rows = [h * 0.3, h * 0.66];
    const phaseA = (i: number) => (i / n) * Math.PI * 2;
    const phaseB = (i: number) => (i / n) * Math.PI * 2 * 1.0 + 0.9;
    rows.forEach((y, r) => {
      for (let i = 0; i < n; i++) {
        const x = x0 + i * (fw + gap);
        c.strokeStyle = hexA(LIGHT, 0.4); c.strokeRect(x, y - fw * 0.7, fw, fw * 1.4);
        const ph = r ? phaseB(i) : phaseA(i);
        c.fillStyle = r ? GOLD : LIGHT;
        c.beginPath(); c.arc(x + fw / 2 + Math.cos(ph) * fw * 0.3, y + Math.sin(ph) * fw * 0.45, 2.2, 0, Math.PI * 2); c.fill();
      }
    });
    const i = Math.floor(t * 0.8) % n;
    const j = ((Math.round(((phaseA(i) - 0.9) / (Math.PI * 2)) * n) % n) + n) % n;
    const ax = x0 + i * (fw + gap) + fw / 2, bx = x0 + j * (fw + gap) + fw / 2;
    const prog = (t * 0.8) % 1;
    c.strokeStyle = GOLD; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(ax, rows[0] + fw * 0.7); c.quadraticCurveTo((ax + bx) / 2 - 18, (rows[0] + rows[1]) / 2, bx, rows[1] - fw * 0.7); c.stroke();
    if (prog > 0.5) { c.strokeStyle = RED; c.beginPath(); c.moveTo(bx, rows[1] - fw * 0.7); c.quadraticCurveTo((ax + bx) / 2 + 18, (rows[0] + rows[1]) / 2, ax, rows[0] + fw * 0.7); c.stroke(); }
  },
  /** #1 Faster R-CNN HPO: trials land on a search space, weak ones get pruned, the best line steps down. */
  GK(c, w, h, t) {
    const r = seeded(5);
    const N = 26;
    const shown = Math.floor((t * 4) % (N + 8));
    const ox = w * 0.36, oy = h * 0.12, pw = w * 0.58, ph = h * 0.62;
    c.strokeStyle = hexA(LIGHT, 0.25); c.strokeRect(ox, oy, pw, ph);
    let best = 1;
    const steps: { x: number; y: number }[] = [];
    for (let i = 0; i < N; i++) {
      const x = r(), y = r(), loss = 0.25 + 0.75 * Math.hypot(x - 0.7, y - 0.35) + r() * 0.1;
      const pruned = loss > 0.75;
      if (i >= shown) continue;
      const px = ox + x * pw, py = oy + y * ph;
      if (pruned) {
        c.strokeStyle = RED; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(px - 3, py - 3); c.lineTo(px + 3, py + 3); c.moveTo(px + 3, py - 3); c.lineTo(px - 3, py + 3); c.stroke();
      } else {
        c.fillStyle = GOLD; c.beginPath(); c.arc(px, py, 2.6, 0, Math.PI * 2); c.fill();
      }
      best = Math.min(best, loss);
      steps.push({ x: ox + (i / N) * pw, y: oy + best * ph * 0.95 });
    }
    c.strokeStyle = GOLD; c.lineWidth = 1.5; c.beginPath();
    steps.forEach((s, i) => (i ? c.lineTo(s.x, s.y) : c.moveTo(s.x, s.y)));
    c.stroke();
  },
};

function drone(c: CanvasRenderingContext2D, x: number, y: number, s: number, t: number) {
  c.strokeStyle = LIGHT; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(x - s, y - s * 0.5); c.lineTo(x + s, y + s * 0.5); c.moveTo(x + s, y - s * 0.5); c.lineTo(x - s, y + s * 0.5); c.stroke();
  c.fillStyle = LIGHT; c.fillRect(x - s * 0.3, y - s * 0.2, s * 0.6, s * 0.4);
  for (const [dx, dy] of [[-1, -0.5], [1, -0.5], [-1, 0.5], [1, 0.5]]) {
    const w = s * 0.55 * Math.abs(Math.cos(t * 30 + dx));
    c.beginPath(); c.ellipse(x + dx * s, y + dy * s, w + 1, 1.5, 0, 0, Math.PI * 2); c.stroke();
  }
}
const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

// ---- runtime -----------------------------------------------------------------
type Entry = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; draw: Draw; visible: boolean; w: number; h: number };
const entries: Entry[] = [];
let raf = 0;

function size(e: Entry) {
  const r = e.canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  e.w = r.width; e.h = r.height;
  e.canvas.width = Math.max(1, Math.round(r.width * dpr));
  e.canvas.height = Math.max(1, Math.round(r.height * dpr));
  e.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function frame(now: number) {
  const t = now / 1000;
  let any = false;
  for (const e of entries) {
    if (!e.visible) continue;
    any = true;
    e.ctx.clearRect(0, 0, e.w, e.h);
    e.draw(e.ctx, e.w, e.h, t);
  }
  raf = any ? requestAnimationFrame(frame) : 0;
}

const io = typeof IntersectionObserver !== 'undefined'
  ? new IntersectionObserver((list) => {
    for (const it of list) {
      const e = entries.find((x) => x.canvas === it.target);
      if (!e) continue;
      e.visible = it.isIntersecting;
      if (e.visible) { size(e); if (reducedMotion) e.draw(e.ctx, e.w, e.h, 2.6); }
    }
    if (!reducedMotion && !raf && entries.some((e) => e.visible)) raf = requestAnimationFrame(frame);
  })
  : null;

/** Adds an animated sketch canvas into `host` for the given formation position. */
export function attachArt(host: HTMLElement, pos: string) {
  const draw = DRAW[pos];
  if (!draw || host.querySelector('canvas[data-art]')) return;
  const canvas = document.createElement('canvas');
  canvas.dataset.art = pos;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
  host.prepend(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const e: Entry = { canvas, ctx, draw, visible: false, w: 0, h: 0 };
  entries.push(e);
  io?.observe(canvas);
  window.addEventListener('resize', () => e.visible && size(e));
}

export function initCardArt() {
  document.querySelectorAll<HTMLElement>('[data-card]').forEach((card) => {
    const art = card.querySelector<HTMLElement>('.pcard__art');
    if (art) attachArt(art, card.dataset.pos!);
  });
  document.querySelectorAll<HTMLElement>('[data-report-kit]').forEach((a) => {
    const art = a.querySelector<HTMLElement>('.report__art');
    const pos = a.querySelector('.report__pos')?.textContent?.split(' ')[0];
    if (art && pos) attachArt(art, pos);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && raf) { cancelAnimationFrame(raf); raf = 0; }
    else if (!document.hidden && !reducedMotion && !raf) raf = requestAnimationFrame(frame);
  });
}
