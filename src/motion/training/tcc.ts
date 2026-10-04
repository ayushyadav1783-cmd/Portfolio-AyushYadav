// Drill #4 Cycle Check: temporal cycle-consistency between two clips of the same kick at different speeds.
// Soft nearest neighbour A→B, then B→A; if you land where you started, the embedding understands timing.
// Toy embeddings: phase features projected to D dims plus noise that "training" shrinks.
import { canvas2d, loop, pointer, rgba, seeded, gauss, mono, GOLD, RED, LIGHT, MUTED, type Drill, type DrillCtx } from './util';

const NA = 14;
const NB = 14;

export function start(ctx: DrillCtx): Drill {
  const { stage, out } = ctx;
  const cv = canvas2d(stage);
  const ui = { dims: ctx.ctls('dim'), speed: ctx.ctl('speed')!, shuffle: ctx.ctl('shuffle')! };
  const speedOut = ctx.panel.querySelector<HTMLElement>('[data-out="speed-in"]');

  let D = 64, sigma = 1.4, epoch = 0;
  let W: number[][] = [], noiseA: number[][] = [], noiseB: number[][] = [];
  let phA: number[] = [], phB: number[] = [], order: number[] = [];
  let U: number[][] = [], V: number[][] = [];
  let tau = 1;
  let pca: { a: number[][]; b: number[][] } = { a: [], b: [] };
  let selected = 0, anim = 0, autoTimer = 0, userPicked = false;
  let training = 0;

  const feat = (p: number) => { const a = 2 * Math.PI * p; return [Math.cos(a), Math.sin(a), 0.5 * Math.cos(2 * a), 0.5 * Math.sin(2 * a)]; };

  function reset() {
    const r = seeded(4 + D);
    D = Number(ui.dims.find((d) => d.checked)?.value ?? 64);
    W = Array.from({ length: D }, () => Array.from({ length: 4 }, () => gauss(r)));
    noiseA = Array.from({ length: NA }, () => Array.from({ length: D }, () => gauss(r)));
    noiseB = Array.from({ length: NB }, () => Array.from({ length: D }, () => gauss(r)));
    sigma = 1.4; epoch = 0;
    rebuildClips();
  }
  function rebuildClips() {
    const s = Number(ui.speed.value);
    if (speedOut) speedOut.textContent = `${s.toFixed(1)}×`;
    phA = Array.from({ length: NA }, (_, i) => i / NA);
    const base = Array.from({ length: NB }, (_, j) => (((j / NB) * s * 0.9 + 0.13) % 1));
    order = base.map((_, j) => j);
    if (ui.shuffle.checked) { const r = seeded(99); for (let i = order.length - 1; i > 0; i--) { const k = Math.floor(r() * (i + 1)); [order[i], order[k]] = [order[k], order[i]]; } }
    phB = order.map((j) => base[j]);
    embed();
  }
  function embed() {
    const proj = (p: number, n: number[]) => { const f = feat(p); return W.map((row, d) => row.reduce((s, w, k) => s + w * f[k], 0) + sigma * n[d]); };
    U = phA.map((p, i) => proj(p, noiseA[i]));
    V = phB.map((p, j) => proj(p, noiseB[j]));
    const all: number[] = [];
    U.forEach((u) => V.forEach((v) => all.push(dist2(u, v))));
    all.sort((a, b) => a - b);
    tau = all[Math.floor(all.length * 0.1)] || 1;
    pca = project2(U, V);
  }
  const dist2 = (a: number[], b: number[]) => a.reduce((s, x, k) => s + (x - b[k]) ** 2, 0);
  const softmax = (xs: number[]) => { const m = Math.max(...xs); const e = xs.map((x) => Math.exp(x - m)); const s = e.reduce((a, b) => a + b, 0); return e.map((x) => x / s); };

  /** Cycle A_i → soft NN in B → back to A. */
  function cycle(i: number) {
    const alpha = softmax(V.map((v) => -dist2(U[i], v) / tau));
    const vt = U[i].map((_, d) => V.reduce((s, v, j) => s + alpha[j] * v[d], 0));
    const beta = softmax(U.map((u) => -dist2(vt, u) / tau));
    const land = beta.indexOf(Math.max(...beta));
    const circ = Math.min(Math.abs(land - i), NA - Math.abs(land - i));
    return { alpha, beta, land, ok: circ <= 1 };
  }
  const accuracy = () => phA.reduce((s, _, i) => s + (cycle(i).ok ? 1 : 0), 0) / NA;

  function project2(A: number[][], B: number[][]) {
    const X = [...A, ...B];
    const mu = X[0].map((_, d) => X.reduce((s, x) => s + x[d], 0) / X.length);
    const C = X.map((x) => x.map((v, d) => v - mu[d]));
    const comps: number[][] = [];
    for (let c = 0; c < 2; c++) {
      let v = Array.from({ length: D }, (_, d) => Math.sin(d * 1.7 + c));
      for (let it = 0; it < 40; it++) {
        const s = C.map((x) => x.reduce((a, xv, d) => a + xv * v[d], 0));
        let nv = v.map((_, d) => C.reduce((a, x, k) => a + x[d] * s[k], 0));
        for (const p of comps) { const dp = nv.reduce((a, x, d) => a + x * p[d], 0); nv = nv.map((x, d) => x - dp * p[d]); }
        const n = Math.hypot(...nv) || 1; v = nv.map((x) => x / n);
      }
      comps.push(v);
    }
    const pr = (x: number[]) => comps.map((p) => x.reduce((a, xv, d) => a + (xv - mu[d]) * p[d], 0));
    return { a: A.map(pr), b: B.map(pr) };
  }

  // ---- drawing ----------------------------------------------------------------
  function kicker(c: CanvasRenderingContext2D, x: number, y: number, s: number, phase: number, col: string) {
    const a = Math.sin(phase * Math.PI * 2);
    const hip = { x, y: y + s * 0.15 }, head = { x, y: y - s * 0.42 };
    c.strokeStyle = col; c.lineWidth = Math.max(1.2, s * 0.06); c.lineCap = 'round';
    c.beginPath(); c.arc(head.x, head.y, s * 0.11, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(head.x, head.y + s * 0.11); c.lineTo(hip.x, hip.y);
    c.moveTo(x, y - s * 0.2); c.lineTo(x - s * 0.25 * Math.cos(a), y - s * 0.02);
    c.moveTo(x, y - s * 0.2); c.lineTo(x + s * 0.25 * Math.cos(a), y - s * 0.05);
    c.moveTo(hip.x, hip.y); c.lineTo(hip.x - s * 0.08, y + s * 0.5);
    const kick = a * 1.1;
    c.moveTo(hip.x, hip.y); c.lineTo(hip.x + Math.sin(kick) * s * 0.36, hip.y + Math.cos(kick) * s * 0.36);
    c.stroke();
    const bx = phase > 0.25 && phase < 0.75 ? x + s * (0.2 + (phase - 0.25) * 1.2) : x + s * 0.22;
    c.fillStyle = LIGHT; c.beginPath(); c.arc(bx, y + s * 0.47, s * 0.06, 0, Math.PI * 2); c.fill();
  }

  let geom = { ax: 0, aw: 0, rowA: 0, rowB: 0, fw: 0, fh: 0 };
  function draw(time: number) {
    const c = cv.ctx, { w, h } = cv;
    c.fillStyle = '#0d0d12'; c.fillRect(0, 0, w, h);
    const pad = 14, fw = (w - pad * 2) / NA - 4, fh = Math.min(fw * 1.2, h * 0.17);
    const rowA = 30, rowB = rowA + fh + Math.max(60, h * 0.13);
    geom = { ax: pad, aw: fw + 4, rowA, rowB, fw, fh };
    const cyc = cycle(selected);
    mono(c, 10); c.fillStyle = MUTED; c.fillText('CLIP A · NORMAL SPEED', pad, rowA - 8); c.fillText(`CLIP B · ${ui.speed.value}× SPEED${ui.shuffle.checked ? ' · SHUFFLED' : ''}`, pad, rowB - 8);
    phA.forEach((p, i) => {
      const x = pad + i * (fw + 4);
      c.fillStyle = i === selected ? rgba(GOLD, 0.18) : '#15151c'; c.fillRect(x, rowA, fw, fh);
      c.strokeStyle = i === selected ? GOLD : i === cyc.land ? (cyc.ok ? GOLD : RED) : rgba(LIGHT, 0.12); c.lineWidth = i === selected || i === cyc.land ? 2 : 1; c.strokeRect(x, rowA, fw, fh);
      kicker(c, x + fw * 0.45, rowA + fh * 0.48, fh * 0.75, p, LIGHT);
      const b = cyc.beta[i] * (anim > 0.5 ? 1 : 0);
      c.fillStyle = rgba(RED, 0.8); c.fillRect(x, rowA + fh + 3, fw * Math.min(1, b * 3), 3);
    });
    phB.forEach((p, j) => {
      const x = pad + j * (fw + 4);
      c.fillStyle = '#15151c'; c.fillRect(x, rowB, fw, fh);
      c.strokeStyle = rgba(LIGHT, 0.12); c.lineWidth = 1; c.strokeRect(x, rowB, fw, fh);
      kicker(c, x + fw * 0.45, rowB + fh * 0.48, fh * 0.75, p, GOLD);
      c.fillStyle = rgba(GOLD, 0.85); c.fillRect(x, rowB - 7, fw * Math.min(1, cyc.alpha[j] * 3 * Math.min(1, anim * 2)), 3);
    });
    // Arcs A → B (soft position) → A.
    const ax = pad + selected * (fw + 4) + fw / 2;
    const bxs = cyc.alpha.reduce((s, a, j) => s + a * (pad + j * (fw + 4) + fw / 2), 0);
    const lx = pad + cyc.land * (fw + 4) + fw / 2;
    const k1 = Math.min(1, anim * 2), k2 = Math.max(0, Math.min(1, anim * 2 - 1));
    c.lineWidth = 2;
    if (k1 > 0) { c.strokeStyle = GOLD; arc(c, ax, rowA + fh + 8, bxs, rowB - 10, -30, k1); }
    if (k2 > 0) { c.strokeStyle = cyc.ok ? GOLD : RED; arc(c, bxs, rowB - 10, lx, rowA + fh + 8, 30, k2); }
    if (anim >= 1) { mono(c, 12); c.fillStyle = cyc.ok ? GOLD : RED; c.fillText(cyc.ok ? 'CYCLE-CONSISTENT ✓' : 'CYCLE BROKE: LANDED ON A DIFFERENT MOMENT', pad, rowB + fh + 22); }

    // Similarity matrix and embedding scatter.
    const by = rowB + fh + 44, bh = h - by - 18, side = Math.min(bh, (w - pad * 3) / 2);
    if (side > 60) {
      mono(c, 10); c.fillStyle = MUTED; c.fillText('SIMILARITY A × B', pad, by - 6);
      const cs = side / Math.max(NA, NB);
      for (let i = 0; i < NA; i++) for (let j = 0; j < NB; j++) {
        const s = Math.exp(-dist2(U[i], V[j]) / (tau * 2));
        c.fillStyle = rgba(GOLD, Math.min(1, s * 1.4)); c.fillRect(pad + j * cs, by + i * cs, cs - 1, cs - 1);
      }
      const sx = pad * 2 + side;
      mono(c, 10); c.fillStyle = MUTED; c.fillText('EMBEDDINGS · 2D PCA (LOOP = LEARNED TIMING)', sx, by - 6);
      c.strokeStyle = rgba(LIGHT, 0.12); c.strokeRect(sx, by, w - sx - pad, side);
      const pts = [...pca.a, ...pca.b];
      const mx = Math.max(...pts.map((p) => Math.abs(p[0]))) || 1, my = Math.max(...pts.map((p) => Math.abs(p[1]))) || 1;
      const cx = sx + (w - sx - pad) / 2, cy = by + side / 2, rx = (w - sx - pad) / 2 - 10, ry = side / 2 - 10;
      const dot = (p: number[], phase: number, col: string) => {
        c.fillStyle = col; c.globalAlpha = 0.4 + 0.6 * phase;
        c.beginPath(); c.arc(cx + (p[0] / mx) * rx, cy + (p[1] / my) * ry, 3.2, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
      };
      pca.a.forEach((p, i) => dot(p, phA[i], LIGHT));
      pca.b.forEach((p, j) => dot(p, phB[j], GOLD));
    }
    void time;
  }
  function arc(c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, bend: number, k: number) {
    const mx = (x1 + x2) / 2 + bend, my = (y1 + y2) / 2;
    c.beginPath();
    const n = 24;
    for (let s = 0; s <= n * k; s++) {
      const t = s / n, x = (1 - t) ** 2 * x1 + 2 * (1 - t) * t * mx + t * t * x2, y = (1 - t) ** 2 * y1 + 2 * (1 - t) * t * my + t * t * y2;
      s ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.stroke();
  }

  const L = loop((dt, time) => {
    anim = Math.min(1, anim + dt * (ctx.reduced ? 10 : 0.9));
    if (!userPicked) { autoTimer += dt; if (autoTimer > 2.2) { autoTimer = 0; selected = (selected + 3) % NA; anim = 0; } }
    if (training > 0) { training -= dt; if (Math.floor((training + dt) * 4) !== Math.floor(training * 4)) trainEpoch(); }
    draw(time);
    out('epoch', 'Epoch', String(epoch));
    out('noise', 'Embedding noise σ', sigma.toFixed(2), sigma > 0.6);
    const acc = accuracy();
    out('acc', 'Cycle-back accuracy', `${Math.round(acc * 100)}%`, acc < 0.7);
  });

  function trainEpoch() { if (sigma > 0.08) { sigma *= 0.8; epoch++; embed(); anim = 0; } }
  stage.addEventListener('pointerdown', (e) => {
    const p = pointer(stage, e);
    if (p.y < geom.rowA || p.y > geom.rowA + geom.fh) return;
    const i = Math.floor((p.x - geom.ax) / geom.aw);
    if (i >= 0 && i < NA) { selected = i; anim = 0; userPicked = true; }
  });
  ctx.ctl('epoch')?.addEventListener('click', trainEpoch);
  ctx.ctl('train')?.addEventListener('click', () => { training = 3.5; });
  ctx.ctl('reset')?.addEventListener('click', () => { training = 0; reset(); anim = 0; });
  ui.dims.forEach((d) => d.addEventListener('change', () => { training = 0; reset(); anim = 0; }));
  ui.speed.addEventListener('input', () => { rebuildClips(); anim = 0; });
  ui.shuffle.addEventListener('change', () => { rebuildClips(); anim = 0; });

  reset();
  L.start();
  return { pause: L.stop, resume: L.start };
}
