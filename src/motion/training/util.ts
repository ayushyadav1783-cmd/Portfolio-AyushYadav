// Shared plumbing for Training Ground drills: canvas sizing, a pausable loop, readouts, controls.
export const GOLD = '#f5c542';
export const RED = '#ff4a3d';
export const LIGHT = '#f6f3ec';
export const MUTED = '#a3a1ab';
export const NIGHT = '#08080b';
export const TUNNEL = '#1c1c25';

export type DrillCtx = {
  stage: HTMLElement;
  panel: HTMLElement;
  reduced: boolean;
  /** Set a live readout tile. */
  out: (key: string, label: string, value: string, bad?: boolean) => void;
  /** Find a control by its data-ctl name. */
  ctl: <T extends HTMLElement = HTMLInputElement>(name: string) => T | null;
  ctls: <T extends HTMLElement = HTMLInputElement>(name: string) => T[];
};
export type Drill = { pause(): void; resume(): void };

export function makeCtx(stage: HTMLElement, panel: HTMLElement, reduced: boolean): DrillCtx {
  const box = panel.querySelector<HTMLElement>('[data-tg-readouts]')!;
  const tiles = new Map<string, HTMLElement>();
  return {
    stage, panel, reduced,
    out(key, label, value, bad = false) {
      let dd = tiles.get(key);
      if (!dd) {
        const wrap = document.createElement('div');
        const dt = document.createElement('dt');
        dt.textContent = label;
        dd = document.createElement('dd');
        wrap.append(dt, dd);
        box.appendChild(wrap);
        tiles.set(key, dd);
      }
      if (dd.textContent !== value) dd.textContent = value;
      dd.classList.toggle('is-bad', bad);
    },
    ctl: <T extends HTMLElement>(name: string) => panel.querySelector<T>(`[data-ctl="${name}"]`),
    ctls: <T extends HTMLElement>(name: string) => [...panel.querySelectorAll<T>(`[data-ctl="${name}"]`)],
  };
}

/** A DPR-aware 2D canvas filling the stage. */
export function canvas2d(stage: HTMLElement) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  stage.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  const state = { canvas, ctx, w: 0, h: 0, dpr: 1 };
  const fit = () => {
    const r = stage.getBoundingClientRect();
    state.dpr = Math.min(2, window.devicePixelRatio || 1);
    state.w = r.width; state.h = r.height;
    canvas.width = Math.round(r.width * state.dpr);
    canvas.height = Math.round(r.height * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  };
  fit();
  new ResizeObserver(fit).observe(stage);
  return state;
}

/** requestAnimationFrame loop with pause/resume and a capped dt (seconds). */
export function loop(step: (dt: number, t: number) => void) {
  let raf = 0;
  let last = 0;
  const tick = (now: number) => {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    step(dt, now / 1000);
    raf = requestAnimationFrame(tick);
  };
  return {
    start() { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } },
    stop() { cancelAnimationFrame(raf); raf = 0; },
    get running() { return raf !== 0; },
  };
}

/** Pointer position in stage pixels. */
export function pointer(stage: HTMLElement, e: PointerEvent) {
  const r = stage.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

export function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

export function gauss(r: () => number) {
  const u = Math.max(1e-9, r());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

export const mono = (c: CanvasRenderingContext2D, px: number, weight = 700) => {
  c.font = `${weight} ${px}px "JetBrains Mono", ui-monospace, monospace`;
};
export const display = (c: CanvasRenderingContext2D, px: number) => {
  c.font = `900 ${px}px "Big Shoulders Display", "Arial Narrow", sans-serif`;
};
