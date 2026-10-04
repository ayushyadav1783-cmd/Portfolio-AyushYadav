// Fan Zone (spec §5.5): red flood in and drain out, crossing tickers, matter-js stickers on desktop,
// and a signature trick on every sticker click (tricks.ts). Mobile / reduced motion: static grid.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type MatterNS from 'matter-js';
import { MQ, finePointer, reducedMotion } from './env';
import { runTrick, type Stage } from './tricks';

gsap.registerPlugin(ScrollTrigger);

export function initFanZone() {
  const section = document.querySelector<HTMLElement>('[data-fan]');
  const pit = document.querySelector<HTMLElement>('[data-stickers]');
  if (!section || !pit) return;
  const stickers = [...pit.querySelectorAll<HTMLButtonElement>('[data-sticker]')];

  const mm = gsap.matchMedia();
  mm.add(MQ.motion, () => flood(section));

  // Stage the tricks run on: DOM-only by default, upgraded to physics on desktop.
  const stage: Stage = { section, stickers, physics: null };

  // Click (or tap / Enter) = trick. A drag that moves more than a few px is a throw, not a click.
  let down: { x: number; y: number; t: number } | null = null;
  pit.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  stickers.forEach((s) => {
    s.addEventListener('click', (e) => {
      const moved = down && e.detail !== 0 ? Math.hypot(e.clientX - down.x, e.clientY - down.y) : 0;
      const quick = down && e.detail !== 0 ? performance.now() - down.t < 450 : true;
      down = null;
      if (moved > 6 || !quick) return;
      runTrick(s, stage);
    });
  });

  if (finePointer && !reducedMotion) {
    // Lazy-load matter-js only as the Fan Zone approaches (spec §9 budget).
    ScrollTrigger.create({
      trigger: section,
      start: 'top 180%',
      once: true,
      onEnter: () => {
        import('matter-js').then((m) => {
          stage.physics = physics((m as unknown as { default?: typeof MatterNS }).default ?? (m as unknown as typeof MatterNS), pit, stickers);
        });
      },
    });
  }
}

/**
 * The red floods down from the top edge as the section arrives (circle clip-path anchored at the top
 * centre), complete by the time the section top is two thirds up the screen. No drain on exit:
 * Ayush's rule is no black or plain screens, so the Fan Zone stays red once it has arrived.
 */
function flood(section: HTMLElement) {
  const layer = section.querySelector<HTMLElement>('[data-flood]');
  if (!layer) return;
  section.style.backgroundColor = 'var(--night)';
  gsap.fromTo(layer, { clipPath: 'circle(0% at 50% 0%)' }, {
    clipPath: 'circle(160% at 50% 0%)',
    ease: 'none',
    scrollTrigger: { trigger: section, start: 'top bottom', end: 'top 65%', scrub: 0.3 },
  });
  return () => { section.style.backgroundColor = ''; gsap.set(layer, { clearProps: 'clipPath' }); };
}

export type Physics = {
  Matter: typeof MatterNS;
  engine: MatterNS.Engine;
  bodies: MatterNS.Body[];
  pit: HTMLElement;
};

/** Stickers become matter-js bodies that drop in when the pit enters, collide, and can be thrown. */
function physics(Matter: typeof MatterNS, pit: HTMLElement, stickers: HTMLButtonElement[]): Physics {
  const { Engine, Bodies, Body, Composite, Mouse, MouseConstraint, Events } = Matter;

  // Measure the static layout first, then switch to absolute positioning at the same height (no CLS).
  const pitRect = pit.getBoundingClientRect();
  const sizes = stickers.map((s) => {
    const r = s.getBoundingClientRect();
    return { w: s.offsetWidth, h: s.offsetHeight, x: r.left - pitRect.left + r.width / 2, y: r.top - pitRect.top + r.height / 2 };
  });
  const height = Math.max(pit.offsetHeight + 60, 460);
  pit.style.height = `${height}px`;
  pit.classList.add('is-physics');
  const W = () => pit.clientWidth;

  const engine = Engine.create({ gravity: { x: 0, y: 1, scale: 0.0012 } });
  const wallOpts = { isStatic: true, render: { visible: false } };
  const T = 200;
  const ground = Bodies.rectangle(W() / 2, height + T / 2, W() * 3, T, wallOpts);
  const left = Bodies.rectangle(-T / 2, -height, T, height * 4, wallOpts);
  const right = Bodies.rectangle(W() + T / 2, -height, T, height * 4, wallOpts);
  Composite.add(engine.world, [ground, left, right]);

  const bodies = stickers.map((s, i) => {
    const { w, h, x } = sizes[i];
    const rot = parseFloat(getComputedStyle(s).getPropertyValue('--rot')) || 0;
    const radius = Math.min(parseFloat(getComputedStyle(s).borderRadius) || 0, h / 2 - 1);
    const b = Bodies.rectangle(x, -h - i * 90, w, h, {
      angle: (rot * Math.PI) / 180,
      restitution: 0.5,
      friction: 0.3,
      frictionAir: 0.012,
      chamfer: { radius: Math.max(0, radius) },
    });
    Composite.add(engine.world, b);
    return b;
  });

  // Drag + throw. matter's mouse swallows the wheel; give scrolling back to the page.
  const mouse = Mouse.create(pit);
  const anyMouse = mouse as unknown as { mousewheel: EventListener };
  pit.removeEventListener('wheel', anyMouse.mousewheel);
  const mc = MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.2, damping: 0.1 } });
  Composite.add(engine.world, mc);
  Events.on(mc, 'startdrag', () => pit.classList.add('is-dragging'));
  Events.on(mc, 'enddrag', () => pit.classList.remove('is-dragging'));

  // Keep the walls at the pit's edges on resize.
  const ro = new ResizeObserver(() => {
    Body.setPosition(right, { x: W() + T / 2, y: right.position.y });
    Body.setPosition(ground, { x: W() / 2, y: ground.position.y });
  });
  ro.observe(pit);

  // Sync DOM to bodies; only run while the Fan Zone is on screen, and drop them in on first entry.
  let running = false;
  let dropped = false;
  const sync = () => {
    Engine.update(engine, 1000 / 60);
    bodies.forEach((b, i) => {
      const { w, h } = sizes[i];
      (stickers[i].parentElement as HTMLElement).style.transform =
        `translate(${b.position.x - w / 2}px, ${b.position.y - h / 2}px) rotate(${b.angle}rad)`;
    });
  };
  bodies.forEach((b) => Body.setStatic(b, true));
  const slots = stickers.map((st) => st.parentElement as HTMLElement);
  slots.forEach((sl) => (sl.style.visibility = 'hidden'));
  sync();
  ScrollTrigger.create({
    trigger: pit,
    start: 'top 85%',
    end: 'bottom top',
    onToggle: (self) => {
      if (self.isActive && !running) { gsap.ticker.add(sync); running = true; }
      if (!self.isActive && running) { gsap.ticker.remove(sync); running = false; }
      if (self.isActive && !dropped) {
        dropped = true;
        bodies.forEach((b, i) => gsap.delayedCall(i * 0.09, () => { slots[i].style.visibility = ''; Body.setStatic(b, false); }));
      }
    },
  });
  return { Matter, engine, bodies, pit };
}
