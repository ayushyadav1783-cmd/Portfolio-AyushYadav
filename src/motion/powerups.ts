// Dressing Room: Power-ups (spec §5.4). Deal-in, honest meters, aura burst, hover speed lines,
// spring grid, title power-up flash. Reduced motion: static, meters already full (rendered by HTML).
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { MQ, finePointer } from './env';

gsap.registerPlugin(ScrollTrigger, SplitText);

const GOLD = '#f5c542';
const RED = '#ff4a3d';
const EMPTY = '#2a2a35';
const GLOW = '0 0 8px rgba(245,197,66,.6)';

export function initPowerUps() {
  const grid = document.querySelector<HTMLElement>('[data-pu-grid]');
  const title = document.querySelector<HTMLElement>('[data-pu-title]');
  if (!grid || !title) return;
  const cards = [...grid.querySelectorAll<HTMLElement>('[data-pu]')];

  const mm = gsap.matchMedia();
  mm.add(MQ.motion, () => {
    titleFlash(title);
    const meters = cards.map(prepMeter);
    dealIn(grid, cards, meters);
    cards.forEach(speedLines);
    if (finePointer) springGrid(grid, cards);
  });
}

/** Cards deal in like a hand: from a stacked deck at the grid centre, rotation −8°→0, 50ms stagger. */
function dealIn(grid: HTMLElement, cards: HTMLElement[], meters: Array<() => void>) {
  const deck = () => {
    const g = grid.getBoundingClientRect();
    return { x: g.left + g.width / 2, y: g.top + Math.min(g.height, window.innerHeight) / 2 };
  };
  const from = (card: HTMLElement) => {
    const r = card.getBoundingClientRect();
    const d = deck();
    return { x: d.x - (r.left + r.width / 2), y: d.y - (r.top + r.height / 2) };
  };
  // Measure from the untransformed layout, then hold the cards in the deck until the grid enters.
  const starts = cards.map(from);
  cards.forEach((c, i) => gsap.set(c, { x: starts[i].x, y: starts[i].y, rotation: -8 + (i % 3) * 2, autoAlpha: 0 }));

  ScrollTrigger.create({
    trigger: grid,
    start: 'top 70%',
    once: true,
    onEnter: () => {
      cards.forEach((c, i) => {
        gsap.to(c, {
          x: 0, y: 0, rotation: 0, autoAlpha: 1,
          duration: 0.7, delay: i * 0.05, ease: 'expo.out',
          onComplete: () => {
            gsap.set(c, { clearProps: 'rotation,opacity,visibility' });
            meters[i]();
          },
        });
      });
    },
  });
}

/** Empties the meter now and returns a function that fills it: 60ms apart, scale pop; 5+ bursts once. */
function prepMeter(card: HTMLElement) {
  const segs = [...card.querySelectorAll<HTMLElement>('[data-pu-segs] span')];
  const level = Number(card.dataset.level);
  gsap.set(segs, { backgroundColor: EMPTY, boxShadow: 'none' });
  let filled = false;
  return () => {
    if (filled) return;
    filled = true;
    const on = segs.slice(0, level);
    gsap.timeline()
      .to(on, { backgroundColor: GOLD, boxShadow: GLOW, duration: 0.12, stagger: 0.06 })
      .fromTo(on, { scaleY: 1 }, { scaleY: 1.9, duration: 0.09, yoyo: true, repeat: 1, stagger: 0.06, ease: 'power2.out' }, 0)
      .call(() => { if (level >= 5) auraBurst(card, on[on.length - 1]); });
  };
}

/** One-time red/gold particle ring, 400ms. */
function auraBurst(card: HTMLElement, origin: HTMLElement) {
  const c = card.getBoundingClientRect();
  const o = origin.getBoundingClientRect();
  const cx = o.left + o.width / 2 - c.left;
  const cy = o.top + o.height / 2 - c.top;
  const n = 16;
  for (let i = 0; i < n; i++) {
    const p = document.createElement('span');
    p.setAttribute('aria-hidden', 'true');
    p.style.cssText = `position:absolute;left:${cx - 3}px;top:${cy - 3}px;width:6px;height:6px;border-radius:999px;pointer-events:none;background:${i % 2 ? RED : GOLD};box-shadow:0 0 10px ${i % 2 ? RED : GOLD}`;
    card.appendChild(p);
    const a = (i / n) * Math.PI * 2;
    const dist = 46 + (i % 3) * 10;
    gsap.to(p, {
      x: Math.cos(a) * dist, y: Math.sin(a) * dist, scale: 0.2, autoAlpha: 0,
      duration: 0.4, ease: 'power2.out', onComplete: () => p.remove(),
    });
  }
  gsap.fromTo(card.querySelector('.pu__aura'), { filter: 'brightness(1)' }, { filter: 'brightness(2.2)', duration: 0.2, yoyo: true, repeat: 1, clearProps: 'filter' });
}

/** Speed lines streak behind the content for 300ms on hover/focus. */
function speedLines(card: HTMLElement) {
  const speed = card.querySelector<HTMLElement>('[data-pu-speed]');
  if (!speed) return;
  const lines = speed.querySelectorAll('i');
  const run = () => {
    gsap.killTweensOf([speed, lines]);
    gsap.timeline()
      .set(speed, { opacity: 1 })
      .fromTo(lines, { xPercent: 160 }, { xPercent: -160, duration: 0.3, stagger: 0.03, ease: 'power2.in' })
      .set(speed, { opacity: 0 });
  };
  card.addEventListener('pointerenter', run);
  card.addEventListener('focus', run);
}

/** The pointer pushes neighbouring cards away (max 6px, falling off with distance), and they settle with damping. */
function springGrid(grid: HTMLElement, cards: HTMLElement[]) {
  const movers = cards.map((c) => ({
    el: c,
    x: gsap.quickTo(c, 'x', { duration: 0.8, ease: 'elastic.out(1, 0.45)' }),
    y: gsap.quickTo(c, 'y', { duration: 0.8, ease: 'elastic.out(1, 0.45)' }),
  }));
  const RADIUS = 420;
  const MAX = 6;
  grid.addEventListener('pointermove', (e) => {
    for (const m of movers) {
      if (m.el.matches(':hover') || gsap.isTweening(m.el)) continue;
      const r = m.el.getBoundingClientRect();
      const dx = r.left + r.width / 2 - e.clientX;
      const dy = r.top + r.height / 2 - e.clientY;
      const d = Math.hypot(dx, dy) || 1;
      const f = Math.max(0, 1 - d / RADIUS) * MAX;
      m.x((dx / d) * f);
      m.y((dy / d) * f);
    }
  });
  grid.addEventListener('pointerleave', () => movers.forEach((m) => { m.x(0); m.y(0); }));
}

/** "POWER-UPS" jitters once on enter like an anime power-up: a 2-frame white flash and a ±4px shake. */
function titleFlash(title: HTMLElement) {
  const split = SplitText.create(title, { type: 'chars' });
  const frame = 1 / 30;
  ScrollTrigger.create({
    trigger: title,
    start: 'top 75%',
    once: true,
    onEnter: () => {
      gsap.timeline({ onComplete: () => split.revert() })
        .set(split.chars, { color: '#ffffff', textShadow: '0 0 24px rgba(255,255,255,.9)' })
        .set(split.chars, { x: () => gsap.utils.random(-4, 4), y: () => gsap.utils.random(-4, 4) })
        .set(split.chars, { x: () => gsap.utils.random(-4, 4), y: () => gsap.utils.random(-4, 4) }, frame)
        .set(split.chars, { x: 0, y: 0, clearProps: 'color,textShadow' }, frame * 2);
    },
  });
}
