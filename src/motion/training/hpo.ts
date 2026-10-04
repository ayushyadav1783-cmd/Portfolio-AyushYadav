// Drill #1 HPO Arena: random vs grid vs a TPE-style sampler (density ratio l(x)/g(x) over good/bad
// trials) racing on a toy landscape, with median pruning, learning curves and a GPU clock that uses the
// real 30 → 8 minute per-trial costs.
import { canvas2d, loop, rgba, seeded, gauss, mono, GOLD, RED, LIGHT, MUTED, type Drill, type DrillCtx } from './util';

type Pt = { x: number; y: number };
type Trial = Pt & { score: number | null; partial: number; pruned: boolean; curve: number[] };
type Run = { name: string; color: string; trials: Trial[]; best: number[]; minutes: number };

const EPOCHS = 10;
const PRUNE_AT = 4;

const LANDS: Record<string, (p: Pt) => number> = {
  smooth: ({ x, y }) => Math.exp(-((x - 0.68) ** 2 + (y - 0.32) ** 2) / 0.08),
  multi: ({ x, y }) =>
    0.95 * Math.exp(-((x - 0.78) ** 2 + (y - 0.22) ** 2) / 0.012) +
    0.7 * Math.exp(-((x - 0.28) ** 2 + (y - 0.7) ** 2) / 0.05) +
    0.45 * Math.exp(-((x - 0.55) ** 2 + (y - 0.55) ** 2) / 0.02),
  needle: ({ x, y }) => 0.35 * Math.exp(-((x - 0.35) ** 2 + (y - 0.4) ** 2) / 0.15) + 0.95 * Math.exp(-((x - 0.82) ** 2 + (y - 0.76) ** 2) / 0.0018),
};

export function start(ctx: DrillCtx): Drill {
  const { stage, out } = ctx;
  const cv = canvas2d(stage);
  const ui = { trials: ctx.ctl('trials')!, prune: ctx.ctl('prune')!, deferred: ctx.ctl('deferred')!, lands: ctx.ctls('land') };
  const trialsOut = ctx.panel.querySelector<HTMLElement>('[data-out="trials-in"]');
  const land = () => LANDS[ui.lands.find((l) => l.checked)?.value ?? 'multi'];

  let runs: Run[] = [];
  let racing = false;
  let tick = 0;
  let heat: HTMLCanvasElement | null = null;
  let rnd = seeded(1);

  function reset() {
    rnd = seeded(Math.floor(Math.random() * 1e6) + 1);
    runs = [
      { name: 'RANDOM', color: LIGHT, trials: [], best: [], minutes: 0 },
      { name: 'GRID', color: MUTED, trials: [], best: [], minutes: 0 },
      { name: 'TPE-STYLE', color: GOLD, trials: [], best: [], minutes: 0 },
    ];
    heat = renderHeat();
    if (trialsOut) trialsOut.textContent = ui.trials.value;
  }

  function renderHeat() {
    const n = 64, c = document.createElement('canvas');
    c.width = n; c.height = n;
    const g = c.getContext('2d')!, img = g.createImageData(n, n), f = land();
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const v = Math.min(1, f({ x: i / (n - 1), y: j / (n - 1) }));
      const k = (j * n + i) * 4;
      img.data[k] = 28 + v * (245 - 28); img.data[k + 1] = 28 + v * (197 - 28); img.data[k + 2] = 37 + v * (66 - 37); img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  // ---- samplers ---------------------------------------------------------------
  function sample(run: Run, k: number, N: number): Pt {
    if (run.name === 'RANDOM') return { x: rnd(), y: rnd() };
    if (run.name === 'GRID') {
      const side = Math.ceil(Math.sqrt(N));
      return { x: ((k % side) + 0.5) / side, y: (Math.floor(k / side) + 0.5) / side };
    }
    // TPE-style: random warm-up, then maximise l(x)/g(x) over candidates drawn near good trials.
    const done = run.trials.filter((t) => t.score !== null || t.pruned);
    if (done.length < 8) return { x: rnd(), y: rnd() };
    const scored = done.map((t) => ({ t, v: t.score ?? t.partial * 0.5 })).sort((a, b) => b.v - a.v);
    const cut = Math.max(2, Math.floor(scored.length * 0.25));
    const good = scored.slice(0, cut).map((s) => s.t), bad = scored.slice(cut).map((s) => s.t);
    const kde = (pts: Pt[], p: Pt, bw: number) => pts.reduce((s, q) => s + Math.exp(-((p.x - q.x) ** 2 + (p.y - q.y) ** 2) / (2 * bw * bw)), 0) / pts.length + 1e-6;
    let best: Pt = { x: rnd(), y: rnd() }, bestR = -1;
    for (let c = 0; c < 24; c++) {
      const g = good[Math.floor(rnd() * good.length)];
      const p = { x: Math.min(1, Math.max(0, g.x + gauss(rnd) * 0.09)), y: Math.min(1, Math.max(0, g.y + gauss(rnd) * 0.09)) };
      const r = kde(good, p, 0.08) / kde(bad, p, 0.12);
      if (r > bestR) { bestR = r; best = p; }
    }
    return best;
  }

  function runTrial(run: Run, k: number, N: number) {
    const p = sample(run, k, N);
    const f = land()(p);
    const curve = Array.from({ length: EPOCHS }, (_, e) => Math.max(0, f * (1 - Math.exp(-(e + 1) / 3)) + gauss(rnd) * 0.015));
    const partial = curve[PRUNE_AT - 1];
    // Median pruning: stop if the partial score is below the median of earlier trials at the same epoch.
    const earlier = run.trials.map((t) => t.partial).sort((a, b) => a - b);
    const median = earlier.length >= 5 ? earlier[Math.floor(earlier.length / 2)] : -Infinity;
    const pruned = ui.prune.checked && partial < median;
    const trial: Trial = { ...p, partial, curve, pruned, score: pruned ? null : curve[EPOCHS - 1] };
    run.trials.push(trial);
    const perTrial = ui.deferred.checked ? 8 : 30; // real per-trial minutes, from content.json
    run.minutes += pruned ? perTrial * (PRUNE_AT / EPOCHS) : perTrial;
    const prevBest = run.best.length ? run.best[run.best.length - 1] : 0;
    run.best.push(Math.max(prevBest, trial.score ?? 0));
  }

  // ---- drawing ----------------------------------------------------------------
  function draw() {
    const c = cv.ctx, { w, h } = cv;
    c.fillStyle = '#0d0d12'; c.fillRect(0, 0, w, h);
    const pad = 14, top = 30;
    const narrow = w < 560;
    const pw = narrow ? (w - pad * 4) / 3 : (w - pad * 4) / 3;
    const ph = Math.min(pw, h * (narrow ? 0.32 : 0.5));
    runs.forEach((run, i) => {
      const x0 = pad + i * (pw + pad), y0 = top;
      if (heat) { c.imageSmoothingEnabled = true; c.globalAlpha = 0.9; c.drawImage(heat, x0, y0, pw, ph); c.globalAlpha = 1; }
      c.strokeStyle = rgba(LIGHT, 0.15); c.strokeRect(x0, y0, pw, ph);
      mono(c, 10); c.fillStyle = run.color; c.fillText(run.name, x0, y0 - 8);
      let bestT: Trial | null = null;
      run.trials.forEach((t) => {
        const px = x0 + t.x * pw, py = y0 + t.y * ph;
        if (t.pruned) {
          c.strokeStyle = RED; c.lineWidth = 1.5;
          c.beginPath(); c.moveTo(px - 3, py - 3); c.lineTo(px + 3, py + 3); c.moveTo(px + 3, py - 3); c.lineTo(px - 3, py + 3); c.stroke();
        } else {
          c.fillStyle = '#08080b'; c.beginPath(); c.arc(px, py, 3.6, 0, Math.PI * 2); c.fill();
          c.fillStyle = run.color; c.beginPath(); c.arc(px, py, 2.6, 0, Math.PI * 2); c.fill();
          if (!bestT || (t.score ?? 0) > (bestT.score ?? 0)) bestT = t;
        }
      });
      if (bestT) {
        const b = bestT as Trial;
        c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.beginPath(); c.arc(x0 + b.x * pw, y0 + b.y * ph, 7, 0, Math.PI * 2); c.stroke();
      }
    });

    // Best-so-far chart.
    const cy0 = top + ph + 34, ch = h - cy0 - 34, cw = narrow ? w - pad * 2 : (w - pad * 3) * 0.6;
    c.strokeStyle = rgba(LIGHT, 0.15); c.strokeRect(pad, cy0, cw, ch);
    mono(c, 10); c.fillStyle = MUTED; c.fillText('BEST SO FAR (TOY SCORE) vs TRIAL', pad, cy0 - 8);
    const N = Number(ui.trials.value);
    runs.forEach((run) => {
      if (!run.best.length) return;
      c.strokeStyle = run.color; c.lineWidth = 2; c.beginPath();
      run.best.forEach((b, k) => { const x = pad + (k / Math.max(1, N - 1)) * cw, y = cy0 + ch - Math.min(1, b) * ch; k ? c.lineTo(x, y) : c.moveTo(x, y); });
      c.stroke();
    });

    // Learning curves of the TPE run: pruned ones stop at the median line.
    if (!narrow) {
      const lx = pad * 2 + cw, lw = w - lx - pad;
      c.strokeStyle = rgba(LIGHT, 0.15); c.strokeRect(lx, cy0, lw, ch);
      mono(c, 10); c.fillStyle = MUTED; c.fillText('LEARNING CURVES · PRUNED AT EPOCH 4', lx, cy0 - 8);
      const tpe = runs[2];
      tpe.trials.slice(-14).forEach((t) => {
        const n = t.pruned ? PRUNE_AT : EPOCHS;
        c.strokeStyle = t.pruned ? rgba(RED, 0.75) : rgba(GOLD, 0.8); c.lineWidth = 1.3; c.beginPath();
        for (let e = 0; e < n; e++) { const x = lx + (e / (EPOCHS - 1)) * lw, y = cy0 + ch - Math.min(1, t.curve[e]) * ch; e ? c.lineTo(x, y) : c.moveTo(x, y); }
        c.stroke();
      });
      const px = lx + ((PRUNE_AT - 1) / (EPOCHS - 1)) * lw;
      c.setLineDash([3, 3]); c.strokeStyle = rgba(LIGHT, 0.4); c.beginPath(); c.moveTo(px, cy0); c.lineTo(px, cy0 + ch); c.stroke(); c.setLineDash([]);
    }
    mono(c, 10, 400); c.fillStyle = MUTED;
    c.fillText('● FINISHED TRIAL   × PRUNED   ○ BEST', pad, h - 12);
  }

  const L = loop(() => {
    const N = Number(ui.trials.value);
    if (racing && ++tick % (ctx.reduced ? 1 : 4) === 0) {
      runs.forEach((run) => { if (run.trials.length < N) runTrial(run, run.trials.length, N); });
      if (runs.every((r) => r.trials.length >= N)) racing = false;
    }
    draw();
    const bestOf = (r: Run) => (r.best.length ? r.best[r.best.length - 1] : 0);
    out('tpe', 'Best · TPE-style', bestOf(runs[2]).toFixed(3));
    out('rnd', 'Best · Random', bestOf(runs[0]).toFixed(3));
    out('pruned', 'Trials pruned', String(runs.reduce((s, r) => s + r.trials.filter((t) => t.pruned).length, 0)));
    out('gpu', 'GPU time · TPE run', `${(runs[2].minutes / 60).toFixed(1)} h`);
    const saved = runs[2].trials.length * 22;
    out('saved', 'Saved by deferral', ui.deferred.checked ? `${(saved / 60).toFixed(1)} h` : '0 h', !ui.deferred.checked);
  });

  ctx.ctl('run')?.addEventListener('click', () => { reset(); racing = true; });
  [ui.trials, ...ui.lands].forEach((el) => el.addEventListener('input', () => { racing = false; reset(); }));

  reset();
  L.start();
  return { pause: L.stop, resume: L.start };
}
