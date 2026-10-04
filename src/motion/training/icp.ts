// Drill #10 VAR Alignment: real ICP on a toy scene. Unconstrained 7-DOF ICP vs gravity-first
// (table-plane levelling + 12-seed yaw sweep + yaw/scale/translation solve). RMSE vs true tilt error.
import { canvas2d, loop, pointer, rgba, seeded, gauss, mono, display, GOLD, RED, LIGHT, MUTED, type Drill, type DrillCtx } from './util';
import * as M from './icpmath';

type V3 = M.V3;
const TRUE_SCALE = 1.4;
const YAW = (35 * Math.PI) / 180;
const SEEDS = 12;

function makeScene(kind: string, r: () => number) {
  const P: V3[] = [];
  const table: boolean[] = [];
  const push = (p: V3, isTable = false) => { P.push(p); table.push(isTable); };
  if (kind === 'ball') {
    const n = 420;
    for (let i = 0; i < n; i++) {
      const y = 1 - ((i + 0.5) / n) * 2, rr = Math.sqrt(1 - y * y), th = i * 2.399963;
      if (y < -0.85) continue;
      push([0.5 * rr * Math.cos(th), 0.5 + 0.5 * y, 0.5 * rr * Math.sin(th)]);
    }
    for (let i = 0; i < 60; i++) { const a = r() * Math.PI * 2, rr = 0.18 + r() * 0.17; push([Math.cos(a) * rr, 0, Math.sin(a) * rr], true); }
  } else {
    for (let i = 0; i < 220; i++) push([(r() - 0.5) * 1.2, 0, (r() - 0.5) * 0.8], true);
    for (let i = 0; i < 200; i++) { const a = r() * Math.PI * 2; push([0.3 + Math.cos(a) * 0.15, r() * 0.35, 0.1 + Math.sin(a) * 0.15]); }
    for (let i = 0; i < 150; i++) {
      const f = Math.floor(r() * 3), u = r(), v = r();
      push(f === 0 ? [-0.5 + u * 0.3, v * 0.25, -0.25] : f === 1 ? [-0.5 + u * 0.3, 0.25, -0.25 + v * 0.2] : [-0.5, u * 0.25, -0.25 + v * 0.2]);
    }
  }
  return { P, table };
}

export function start(ctx: DrillCtx): Drill {
  const { stage, out } = ctx;
  const cv = canvas2d(stage);
  const ui = { tilt: ctx.ctl('tilt')!, noise: ctx.ctl('noise')!, residuals: ctx.ctl('residuals')!, scenes: ctx.ctls('scene') };
  const tiltOut = ctx.panel.querySelector<HTMLElement>('[data-out="tilt-in"]');

  let dst: V3[] = [], src: V3[] = [], isTable: boolean[] = [];
  let Rtrue: M.M3 = M.I3;
  let T: M.Sim = { s: 1, R: M.I3, t: [0, 0, 0] };
  let rmse = 0, iter = 0, mode: 'idle' | 'icp' | 'level' | 'sweep' | 'done' = 'idle';
  let verdict = '';
  let seeds: { yaw: number; rmse: number; T: M.Sim }[] = [];
  let shownSeeds = 0, bestSeed = -1;
  let resid: number[] = [];
  let timer = 0;
  let view = { yaw: -0.6, pitch: 0.35 };
  let drag: { x: number; y: number; yaw: number; pitch: number } | null = null;

  const scene = () => ui.scenes.find((x) => x.checked)?.value ?? 'ball';
  function build() {
    const r = seeded(7);
    const s = makeScene(scene(), r);
    dst = s.P; isTable = s.table;
    const tilt = (Number(ui.tilt.value) * Math.PI) / 180;
    Rtrue = M.mulM(M.rotX(tilt), M.rotY(YAW));
    const Ttrue: M.Sim = { s: TRUE_SCALE, R: Rtrue, t: [0.4, 0.2, -0.3] };
    const sig = Number(ui.noise.value) * 0.002;
    src = dst.map((p) => { const q = M.apply(Ttrue, p); return [q[0] + gauss(r) * sig, q[1] + gauss(r) * sig, q[2] + gauss(r) * sig] as V3; });
    const mc = M.mean(src), md = M.mean(dst);
    T = { s: 1, R: M.I3, t: [0, 0, 0] };
    const mm = M.mean(src.map((p) => M.apply(T, p)));
    T.t = [md[0] - mm[0], md[1] - mm[1], md[2] - mm[2]];
    void mc;
    iter = 0; mode = 'idle'; verdict = ''; seeds = []; shownSeeds = 0; bestSeed = -1;
    refresh();
    if (tiltOut) tiltOut.textContent = `${ui.tilt.value}°`;
  }
  const tiltErr = () => M.angleBetween(M.mulMV(M.mulM(T.R, Rtrue), [0, 1, 0]), [0, 1, 0]);
  function refresh() {
    const moved = src.map((p) => M.apply(T, p));
    const nn = M.nearest(moved, dst);
    rmse = nn.rmse;
    resid = moved.map((p, i) => { const q = dst[nn.idx[i]]; return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); });
  }

  function runICP() {
    clearInterval(timer); build(); mode = 'icp';
    timer = window.setInterval(() => {
      const o = M.icpStep(src, dst, T); T = o.T; iter++; refresh();
      if (iter >= 40) {
        clearInterval(timer); mode = 'done';
        const e = tiltErr();
        verdict = e > 5 ? `RMSE says ${rmse.toFixed(3)}. The tilt says ${e.toFixed(0)}°.` : `Converged. On this scene ICP is fine.`;
      }
    }, ctx.reduced ? 10 : 70);
  }

  function runGravity() {
    clearInterval(timer); build();
    // 1. Level the table: RANSAC plane on table points, normal oriented by the whole cloud.
    mode = 'level';
    const n = M.ransacPlane(src.filter((_, i) => isTable[i]), seeded(3), 200, 0.03, src);
    const lev = M.alignVectors(n, [0, 1, 0]);
    const md = M.mean(dst);
    // 2. 12-seed yaw sweep, each refined with the constrained (yaw + scale + translation) solver.
    seeds = [];
    for (let k = 0; k < SEEDS; k++) {
      const yaw = (k * Math.PI * 2) / SEEDS;
      let Tg: M.Sim = { s: 1, R: M.mulM(M.rotY(yaw), lev), t: [0, 0, 0] };
      const mm = M.mean(src.map((p) => M.apply(Tg, p)));
      Tg.t = [md[0] - mm[0], md[1] - mm[1], md[2] - mm[2]];
      let r2 = 0;
      for (let it = 0; it < 25; it++) { const o = M.constrainedStep(src, dst, Tg); Tg = o.T; r2 = o.rmse; }
      seeds.push({ yaw, rmse: r2, T: Tg });
    }
    bestSeed = seeds.reduce((b, s, i) => (s.rmse < seeds[b].rmse ? i : b), 0);
    T = { s: 1, R: lev, t: [0, 0, 0] };
    const mm = M.mean(src.map((p) => M.apply(T, p)));
    T.t = [md[0] - mm[0], md[1] - mm[1], md[2] - mm[2]];
    refresh();
    let step = 0;
    timer = window.setInterval(() => {
      step++;
      if (step === 1) mode = 'sweep';
      if (step <= SEEDS) { shownSeeds = step; T = seeds[step - 1].T; iter = step; refresh(); return; }
      clearInterval(timer);
      T = seeds[bestSeed].T; refresh(); mode = 'done';
      verdict = `Locked. Tilt error ${tiltErr().toFixed(2)}°, seed ${bestSeed + 1} of ${SEEDS}.`;
    }, ctx.reduced ? 10 : 220);
  }

  // ---- drawing ----------------------------------------------------------------
  function proj(p: V3) {
    const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw), cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
    const x = p[0] * cy + p[2] * sy, z0 = -p[0] * sy + p[2] * cy;
    const y = (p[1] - 0.3) * cp - z0 * sp, z = (p[1] - 0.3) * sp + z0 * cp;
    const sc = Math.min(cv.w, cv.h) * 0.75, d = 3 / (3 + z);
    return { x: cv.w * 0.42 + x * sc * d, y: cv.h * 0.6 - y * sc * d };
  }
  function draw() {
    const c = cv.ctx, { w, h } = cv;
    c.fillStyle = '#0d0d12'; c.fillRect(0, 0, w, h);
    // floor grid
    c.strokeStyle = rgba(LIGHT, 0.06); c.lineWidth = 1;
    for (let k = -4; k <= 4; k++) {
      const a = proj([k * 0.25, 0, -1]), b = proj([k * 0.25, 0, 1]), e = proj([-1, 0, k * 0.25]), f = proj([1, 0, k * 0.25]);
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.moveTo(e.x, e.y); c.lineTo(f.x, f.y); c.stroke();
    }
    for (const p of dst) { const q = proj(p); c.fillStyle = rgba(LIGHT, 0.55); c.fillRect(q.x - 1, q.y - 1, 2.2, 2.2); }
    const maxR = 0.12;
    src.forEach((p, i) => {
      const q = proj(M.apply(T, p));
      const k = ui.residuals.checked ? Math.min(1, (resid[i] ?? 0) / maxR) : 0;
      c.fillStyle = k > 0.35 ? rgba(RED, 0.5 + k * 0.5) : rgba(GOLD, 0.9);
      c.fillRect(q.x - 1.2, q.y - 1.2, 2.6, 2.6);
    });
    // gravity arrow
    const g0 = proj([0.9, 0.9, 0]), g1 = proj([0.9, 0.55, 0]);
    c.strokeStyle = rgba(LIGHT, 0.4); c.lineWidth = 2; c.beginPath(); c.moveTo(g0.x, g0.y); c.lineTo(g1.x, g1.y); c.stroke();
    mono(c, 10); c.fillStyle = MUTED; c.fillText('g', g1.x + 6, g1.y);

    // HUD
    mono(c, 11); c.fillStyle = LIGHT; c.fillText('WHITE = ROBOT FRAME   GOLD = SPLAT FRAME' + (ui.residuals.checked ? '   RED = HIGH RESIDUAL' : ''), 16, 22);
    const label = { idle: 'READY', icp: 'UNCONSTRAINED 7-DOF ICP', level: 'LEVELLING THE TABLE PLANE', sweep: 'YAW SWEEP · 12 SEEDS', done: 'DONE' }[mode];
    mono(c, 12); c.fillStyle = GOLD; c.fillText(label, 16, 42);

    if (seeds.length && (mode === 'sweep' || mode === 'done')) {
      const cx = w - 90, cy = 90, R = 56;
      c.strokeStyle = rgba(LIGHT, 0.2); c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
      const maxr = Math.max(...seeds.map((s) => s.rmse));
      seeds.slice(0, Math.max(shownSeeds, mode === 'done' ? SEEDS : 0)).forEach((s, i) => {
        const a = s.yaw - Math.PI / 2, len = 12 + (1 - s.rmse / maxr) * 30;
        c.strokeStyle = i === bestSeed && mode === 'done' ? GOLD : rgba(LIGHT, 0.6); c.lineWidth = i === bestSeed && mode === 'done' ? 3 : 1.5;
        c.beginPath(); c.moveTo(cx + Math.cos(a) * (R - len), cy + Math.sin(a) * (R - len)); c.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); c.stroke();
      });
      mono(c, 9); c.fillStyle = MUTED; c.fillText('YAW SEEDS (LONGER = BETTER FIT)', cx - 92, cy + R + 16);
    }
    if (verdict) {
      display(c, Math.max(22, w / 30));
      const e = tiltErr();
      c.fillStyle = e > 5 ? RED : GOLD;
      c.fillText(verdict.toUpperCase(), 16, h - 22);
    }
  }

  const L = loop((dt) => {
    if (!drag && !ctx.reduced) view.yaw += dt * 0.12;
    draw();
    const e = tiltErr();
    out('iter', mode === 'sweep' || (mode === 'done' && seeds.length) ? 'Seed' : 'Iteration', String(iter));
    out('rmse', 'RMSE (scene units)', rmse.toFixed(4));
    out('tilt', 'True tilt error', `${e.toFixed(1)}°`, e > 5);
  });

  stage.addEventListener('pointerdown', (e) => { const p = pointer(stage, e); drag = { ...p, ...view }; stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = pointer(stage, e);
    view = { yaw: drag.yaw + (p.x - drag.x) * 0.01, pitch: Math.max(-0.2, Math.min(1.2, drag.pitch + (p.y - drag.y) * 0.01)) };
  });
  stage.addEventListener('pointerup', () => { drag = null; });
  ctx.ctl('icp')?.addEventListener('click', runICP);
  ctx.ctl('gravity')?.addEventListener('click', runGravity);
  ctx.ctl('reset')?.addEventListener('click', () => { clearInterval(timer); build(); });
  [ui.tilt, ui.noise, ...ui.scenes].forEach((el) => el.addEventListener('input', () => { clearInterval(timer); build(); }));

  build();
  L.start();
  return { pause: L.stop, resume: L.start };
}
