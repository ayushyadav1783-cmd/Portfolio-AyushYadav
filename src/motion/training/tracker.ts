// Drill #19 Tracker: a real 8-state Kalman filter [cx, cy, w, h, vx, vy, vw, vh] with Hungarian (or greedy)
// assignment, tracking the visitor's cursor among decoys from simulated noisy detections.
import { canvas2d, loop, pointer, rgba, seeded, gauss, mono, GOLD, RED, LIGHT, MUTED, type Drill, type DrillCtx } from './util';

type Box = { cx: number; cy: number; w: number; h: number };
type Truth = Box & { id: number; you: boolean; seed: number[] };
type Track = { id: number; x: number[]; P: number[][]; missed: number; hits: number; trail: { x: number; y: number }[] };

const DETECT_HZ = 30;
const MAX_COAST = 5;

export function start(ctx: DrillCtx): Drill {
  const { stage, out } = ctx;
  const cv = canvas2d(stage);
  const rnd = seeded(19);
  const ui = {
    decoys: ctx.ctl('decoys')!, noise: ctx.ctl('noise')!, miss: ctx.ctl('miss')!,
    kalman: ctx.ctl('kalman')!, hungarian: ctx.ctl('hungarian')!, ellipse: ctx.ctl('ellipse')!,
    predict: ctx.ctl('predict')!, trails: ctx.ctl('trails')!,
  };

  // ---- world ----------------------------------------------------------------
  let t = 0;
  let mouse: { x: number; y: number } | null = null;
  let crossing = 0; // seconds remaining in the crossing scenario
  let blackout = 0;
  const truths: Truth[] = [];
  const mkTruth = (id: number, you: boolean): Truth => ({
    id, you, cx: 0, cy: 0, w: 0, h: 0, seed: Array.from({ length: 6 }, () => 0.3 + rnd() * 0.9),
  });
  truths.push(mkTruth(0, true));
  const syncDecoys = () => {
    const n = Number(ui.decoys.value);
    while (truths.length - 1 < n) truths.push(mkTruth(truths.length, false));
    truths.length = n + 1;
  };
  syncDecoys();

  function moveTruths(dt: number) {
    const { w, h } = cv;
    const s = Math.max(0.6, Math.min(1.4, w / 900));
    truths.forEach((d, i) => {
      const [a, b, c, e, f, g] = d.seed;
      let x: number, y: number;
      if (d.you && mouse) { x = mouse.x; y = mouse.y; }
      else {
        const tt = t * 0.35;
        x = w * (0.5 + 0.38 * Math.sin(tt * a + i * 1.7) * Math.cos(tt * 0.3 * b));
        y = h * (0.5 + 0.34 * Math.sin(tt * c + i * 2.3 + 1));
      }
      if (crossing > 0 && !d.you && i <= 2) {
        // Scripted crossing: two decoys sweep straight through the middle in opposite directions.
        const k = 1 - crossing / 3;
        const yy = mouse ? mouse.y : h * 0.5;
        x = i === 1 ? w * (0.05 + 0.9 * k) : w * (0.95 - 0.9 * k);
        y = yy + (i === 1 ? -8 : 8);
      }
      d.cx += ((x - d.cx) || 0) * (d.cx ? Math.min(1, dt * 12) : 1);
      d.cy += ((y - d.cy) || 0) * (d.cy ? Math.min(1, dt * 12) : 1);
      d.w = 54 * s * (1 + 0.12 * Math.sin(t * e + i));
      d.h = 32 * s * (1 + 0.12 * Math.sin(t * f + i));
      void g;
    });
  }

  // ---- detector (simulated) -------------------------------------------------
  function detect(): Box[] {
    if (blackout > 0) return [];
    const sigma = Number(ui.noise.value);
    const miss = Number(ui.miss.value) / 100;
    const dets: Box[] = [];
    for (const d of truths) {
      if (rnd() < miss) continue;
      dets.push({ cx: d.cx + gauss(rnd) * sigma, cy: d.cy + gauss(rnd) * sigma, w: d.w + gauss(rnd) * sigma * 0.4, h: d.h + gauss(rnd) * sigma * 0.4 });
    }
    if (rnd() < 0.04 + sigma / 600) dets.push({ cx: rnd() * cv.w, cy: rnd() * cv.h, w: 40, h: 26 }); // clutter
    return dets;
  }

  // ---- Kalman ---------------------------------------------------------------
  const dtK = 1 / DETECT_HZ;
  const eye = (n: number): number[][] => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  const F = eye(8); for (let i = 0; i < 4; i++) F[i][i + 4] = dtK;
  const mul = (A: number[][], B: number[][]) => A.map((r) => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));
  const T = (A: number[][]) => A[0].map((_, j) => A.map((r) => r[j]));
  const add = (A: number[][], B: number[][]) => A.map((r, i) => r.map((v, j) => v + B[i][j]));
  const sub = (A: number[][], B: number[][]) => A.map((r, i) => r.map((v, j) => v - B[i][j]));
  const mv = (A: number[][], v: number[]) => A.map((r) => r.reduce((s, x, k) => s + x * v[k], 0));
  function inv(A: number[][]) {
    const n = A.length;
    const M = A.map((r, i) => [...r, ...eye(n)[i]]);
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      const d = M[c][c] || 1e-9;
      for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j]; }
    }
    return M.map((r) => r.slice(n));
  }
  const H = Array.from({ length: 4 }, (_, i) => Array.from({ length: 8 }, (_, j) => (i === j ? 1 : 0)));
  const Q = eye(8).map((r, i) => r.map((v) => v * (i < 4 ? 2 : 40)));
  const Rm = () => { const s = Math.max(2, Number(ui.noise.value)); return eye(4).map((r, i) => r.map((v) => v * (i < 2 ? s * s : (s * 0.4) ** 2 + 1))); };

  function predict(tr: Track) {
    if (!ui.kalman.checked) return;
    tr.x = mv(F, tr.x);
    tr.P = add(mul(mul(F, tr.P), T(F)), Q);
  }
  function update(tr: Track, z: Box) {
    if (!ui.kalman.checked) { tr.x = [z.cx, z.cy, z.w, z.h, 0, 0, 0, 0]; return; }
    const y = [z.cx, z.cy, z.w, z.h].map((v, i) => v - tr.x[i]);
    const S = add(mul(mul(H, tr.P), T(H)), Rm());
    const K = mul(mul(tr.P, T(H)), inv(S));
    tr.x = tr.x.map((v, i) => v + K[i].reduce((s, k, j) => s + k * y[j], 0));
    tr.P = mul(sub(eye(8), mul(K, H)), tr.P);
  }
  const newTrack = (z: Box): Track => ({
    id: ++nextId, x: [z.cx, z.cy, z.w, z.h, 0, 0, 0, 0],
    P: eye(8).map((r, i) => r.map((v) => v * (i < 4 ? 100 : 2500))), missed: 0, hits: 1, trail: [],
  });

  // ---- assignment -------------------------------------------------------------
  /** Hungarian algorithm (Kuhn–Munkres with potentials), rectangular via padding. Returns row → col or -1. */
  function hungarian(cost: number[][]): number[] {
    const nR = cost.length, nC = cost[0]?.length ?? 0, n = Math.max(nR, nC);
    if (!n) return [];
    const BIG = 1e6;
    const a = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i && j && i <= nR && j <= nC ? cost[i - 1][j - 1] : BIG)));
    const u = new Array(n + 1).fill(0), v = new Array(n + 1).fill(0), p = new Array(n + 1).fill(0), way = new Array(n + 1).fill(0);
    for (let i = 1; i <= n; i++) {
      p[0] = i; let j0 = 0;
      const minv = new Array(n + 1).fill(Infinity), used = new Array(n + 1).fill(false);
      do {
        used[j0] = true;
        const i0 = p[j0]; let delta = Infinity, j1 = 0;
        for (let j = 1; j <= n; j++) if (!used[j]) {
          const cur = a[i0][j] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        for (let j = 0; j <= n; j++) if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
        j0 = j1;
      } while (p[j0] !== 0);
      do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
    }
    const res = new Array(nR).fill(-1);
    for (let j = 1; j <= nC; j++) if (p[j] && p[j] <= nR) res[p[j] - 1] = j - 1;
    return res;
  }
  function greedy(cost: number[][]): number[] {
    const pairs: [number, number, number][] = [];
    cost.forEach((r, i) => r.forEach((c, j) => pairs.push([c, i, j])));
    pairs.sort((x, y) => x[0] - y[0]);
    const res = new Array(cost.length).fill(-1), usedC = new Set<number>();
    for (const [, i, j] of pairs) if (res[i] < 0 && !usedC.has(j)) { res[i] = j; usedC.add(j); }
    return res;
  }

  // ---- tracker step ---------------------------------------------------------
  let tracks: Track[] = [];
  let nextId = 0;
  let switches = 0;
  const owner = new Map<number, number>(); // truth id → track id
  const GATE = 90;

  function step() {
    tracks.forEach(predict);
    const dets = detect();
    const cost = tracks.map((tr) => dets.map((d) => {
      const dist = Math.hypot(tr.x[0] - d.cx, tr.x[1] - d.cy);
      return dist > GATE ? 1e5 : dist;
    }));
    const assign = tracks.length && dets.length ? (ui.hungarian.checked ? hungarian(cost) : greedy(cost)) : tracks.map(() => -1);
    const usedDet = new Set<number>();
    tracks.forEach((tr, i) => {
      const j = assign[i];
      if (j >= 0 && cost[i][j] < 1e5) { update(tr, dets[j]); tr.missed = 0; tr.hits++; usedDet.add(j); }
      else tr.missed++;
      tr.trail.push({ x: tr.x[0], y: tr.x[1] });
      if (tr.trail.length > 40) tr.trail.shift();
    });
    tracks = tracks.filter((tr) => tr.missed <= MAX_COAST);
    dets.forEach((d, j) => { if (!usedDet.has(j)) tracks.push(newTrack(d)); });
    lastDets = dets;

    // ID switches: which track sits on each true drone, frame to frame.
    for (const d of truths) {
      let best: Track | null = null, bd = 40;
      for (const tr of tracks) { const dd = Math.hypot(tr.x[0] - d.cx, tr.x[1] - d.cy); if (dd < bd && tr.hits > 2) { bd = dd; best = tr; } }
      if (best) {
        const prev = owner.get(d.id);
        if (prev !== undefined && prev !== best.id) switches++;
        owner.set(d.id, best.id);
      }
    }
  }
  let lastDets: Box[] = [];

  // ---- drawing ----------------------------------------------------------------
  function drone(c: CanvasRenderingContext2D, d: Truth) {
    const s = d.w * 0.32;
    c.strokeStyle = d.you ? GOLD : LIGHT; c.lineWidth = 2;
    c.beginPath(); c.moveTo(d.cx - s, d.cy - s * 0.55); c.lineTo(d.cx + s, d.cy + s * 0.55); c.moveTo(d.cx + s, d.cy - s * 0.55); c.lineTo(d.cx - s, d.cy + s * 0.55); c.stroke();
    c.fillStyle = d.you ? GOLD : LIGHT; c.fillRect(d.cx - s * 0.32, d.cy - s * 0.22, s * 0.64, s * 0.44);
    for (const [dx, dy] of [[-1, -0.55], [1, -0.55], [-1, 0.55], [1, 0.55]]) {
      c.beginPath(); c.ellipse(d.cx + dx * s, d.cy + dy * s, s * 0.55 * Math.abs(Math.cos(t * 40 + dx)) + 1, 2, 0, 0, Math.PI * 2); c.stroke();
    }
    if (d.you) { mono(c, 10); c.fillStyle = GOLD; c.fillText(mouse ? 'YOU' : cv.w < 560 ? 'YOU (AUTOPILOT)' : 'YOU (AUTOPILOT, MOVE YOUR CURSOR IN)', d.cx - s, d.cy + d.h * 0.95); }
  }

  function draw() {
    const c = cv.ctx, { w, h } = cv;
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0b0b12'); g.addColorStop(1, '#14141c');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = rgba(LIGHT, 0.05); c.lineWidth = 1;
    for (let x = 0; x < w; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    for (let y = 0; y < h; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }

    truths.forEach((d) => drone(c, d));

    c.setLineDash([4, 4]); c.strokeStyle = rgba(RED, 0.85); c.lineWidth = 1.2;
    lastDets.forEach((d) => c.strokeRect(d.cx - d.w / 2, d.cy - d.h / 2, d.w, d.h));
    c.setLineDash([]);

    for (const tr of tracks) {
      if (tr.hits < 2) continue;
      const [x, y, bw, bh, vx, vy] = tr.x;
      const coasting = tr.missed > 0;
      if (ui.trails.checked && tr.trail.length > 1) {
        c.strokeStyle = rgba(GOLD, 0.35); c.lineWidth = 1.5; c.beginPath();
        tr.trail.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.stroke();
      }
      if (ui.predict.checked && ui.kalman.checked) {
        c.fillStyle = rgba(GOLD, 0.6);
        for (let k = 1; k <= 10; k++) { c.beginPath(); c.arc(x + vx * k * 0.1, y + vy * k * 0.1, 1.6, 0, Math.PI * 2); c.fill(); }
      }
      if (ui.ellipse.checked && ui.kalman.checked) {
        const sx = Math.sqrt(Math.max(1, tr.P[0][0])) * 2, sy = Math.sqrt(Math.max(1, tr.P[1][1])) * 2;
        c.strokeStyle = rgba(GOLD, 0.45); c.beginPath(); c.ellipse(x, y, sx, sy, 0, 0, Math.PI * 2); c.stroke();
      }
      if (coasting) c.setLineDash([6, 4]);
      c.strokeStyle = GOLD; c.lineWidth = 2; c.strokeRect(x - bw / 2, y - bh / 2, bw, bh);
      c.setLineDash([]);
      mono(c, 11); c.fillStyle = GOLD;
      c.fillText(`ID ${tr.id}${coasting ? ` · COAST ${tr.missed}` : ''}`, x - bw / 2, y - bh / 2 - 5);
    }

    if (blackout > 0) { mono(c, 14); c.fillStyle = RED; c.fillText('DETECTOR BLACKOUT', 16, 26); }
    mono(c, 10, 400); c.fillStyle = MUTED;
    c.fillText(w < 560 ? 'RED = DETECTIONS · GOLD = TRACKS' : 'RED DASHED = DETECTIONS   GOLD = TRACKS   DASHED GOLD = COASTING', 16, h - 14);
  }

  // ---- loop -----------------------------------------------------------------
  let acc = 0;
  const L = loop((dt) => {
    t += dt;
    crossing = Math.max(0, crossing - dt);
    blackout = Math.max(0, blackout - dt);
    moveTruths(dt);
    acc += dt;
    while (acc >= dtK) { step(); acc -= dtK; }
    draw();
    const err = (() => {
      let s = 0, n = 0;
      for (const d of truths) {
        const id = owner.get(d.id);
        const tr = tracks.find((x) => x.id === id);
        if (tr) { s += Math.hypot(tr.x[0] - d.cx, tr.x[1] - d.cy); n++; }
      }
      return n ? s / n : 0;
    })();
    out('tracks', 'Live tracks', String(tracks.filter((x) => x.hits > 1).length));
    out('switch', 'ID switches', String(switches), switches > 0);
    out('err', 'Mean error', `${err.toFixed(1)} px`, err > 20);
  });

  stage.addEventListener('pointermove', (e) => { mouse = pointer(stage, e); });
  stage.addEventListener('pointerdown', (e) => { mouse = pointer(stage, e); });
  // Mouse leaving hands back to autopilot; a lifted finger leaves the drone where it was.
  stage.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') mouse = null; });
  ui.decoys.addEventListener('input', syncDecoys);
  ctx.ctl('cross')?.addEventListener('click', () => { crossing = 3; switches = 0; });
  ctx.ctl('blackout')?.addEventListener('click', () => { blackout = 1; });
  [ui.kalman, ui.hungarian].forEach((el) => el.addEventListener('change', () => { switches = 0; }));

  L.start();
  return { pause: L.stop, resume: L.start };
}
