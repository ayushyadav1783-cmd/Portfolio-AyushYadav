// Training Ground runtime: accessible tabs, lazy-loaded drills, pause when off screen or hidden.
import { gsap } from 'gsap';
import { reducedMotion } from '../env';
import { makeCtx, type Drill, type DrillCtx } from './util';
import { attachArt } from '../cardart';

type Loader = () => Promise<{ start: (ctx: DrillCtx) => Drill }>;
const LOADERS: Record<string, Loader> = {
  splat: () => import('./splat'),
  tracker: () => import('./tracker'),
  icp: () => import('./icp'),
  hpo: () => import('./hpo'),
  tcc: () => import('./tcc'),
};

export function initTraining() {
  const root = document.querySelector<HTMLElement>('[data-training]');
  if (!root) return;
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-tg-tab]')];
  const panels = [...root.querySelectorAll<HTMLElement>('[data-tg-panel]')];
  const running = new Map<string, Drill>();
  root.querySelectorAll<HTMLElement>('[data-tg-art]').forEach((el) => attachArt(el, el.dataset.tgArt!));
  let active = tabs[0].dataset.tgTab!;
  let onScreen = false;

  const select = (id: string, focus = false) => {
    if (id === active) return;
    running.get(active)?.pause();
    active = id;
    tabs.forEach((t) => {
      const on = t.dataset.tgTab === id;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    panels.forEach((p) => (p.hidden = p.dataset.tgPanel !== id));
    const panel = panels.find((p) => p.dataset.tgPanel === id)!;
    if (!reducedMotion) gsap.from(panel, { autoAlpha: 0, y: 12, duration: 0.35, ease: 'expo.out', clearProps: 'all' });
    if (onScreen) running.get(id)?.resume();
  };

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t.dataset.tgTab!));
    t.addEventListener('keydown', (e) => {
      const k = e.key;
      const n = k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0;
      if (n) { e.preventDefault(); select(tabs[(i + n + tabs.length) % tabs.length].dataset.tgTab!, true); }
      if (k === 'Home') { e.preventDefault(); select(tabs[0].dataset.tgTab!, true); }
      if (k === 'End') { e.preventDefault(); select(tabs[tabs.length - 1].dataset.tgTab!, true); }
    });
  });

  panels.forEach((panel) => {
    const id = panel.dataset.tgPanel!;
    const stage = panel.querySelector<HTMLElement>('[data-tg-stage]')!;
    const poster = panel.querySelector<HTMLElement>('[data-tg-poster]')!;
    const startBtn = panel.querySelector<HTMLButtonElement>('[data-tg-start]')!;
    const boot = async () => {
      if (running.has(id)) return;
      startBtn.disabled = true;
      startBtn.textContent = 'Warming up…';
      try {
        const mod = await LOADERS[id]();
        const drill = mod.start(makeCtx(stage, panel, reducedMotion));
        running.set(id, drill);
        gsap.to(poster, { autoAlpha: 0, duration: 0.3, onComplete: () => poster.remove() });
        if (!(onScreen && active === id)) drill.pause();
      } catch (err) {
        startBtn.disabled = false;
        startBtn.textContent = 'Retry ▶';
        console.error('[training]', err);
      }
    };
    startBtn.addEventListener('click', boot);
    // Interacting with any control also boots the drill.
    panel.querySelector('[data-tg-controls]')?.addEventListener('pointerdown', boot, { once: true });
    panel.querySelector('[data-tg-controls]')?.addEventListener('focusin', boot, { once: true });
  });

  // Run only while on screen and the tab is visible.
  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    const d = running.get(active);
    if (!d) return;
    if (onScreen && !document.hidden) d.resume(); else d.pause();
  }, { rootMargin: '100px' }).observe(root);
  document.addEventListener('visibilitychange', () => {
    const d = running.get(active);
    if (!d) return;
    if (document.hidden || !onScreen) d.pause(); else d.resume();
  });
}
