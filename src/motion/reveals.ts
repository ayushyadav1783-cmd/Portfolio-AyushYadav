// Scroll reveals: hero walkout scrub, text reveals, Warm-Up choreography, floodlight sweeps,
// ticker velocity. Reduced motion gets fades only (spec §9).
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { MQ, finePointer } from './env';

gsap.registerPlugin(ScrollTrigger, SplitText);

const $ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => root.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => [...root.querySelectorAll<T>(s)];

export function initReveals() {
  const mm = gsap.matchMedia();

  mm.add(MQ.desktop, () => {
    walkout();
  });

  mm.add(MQ.motion, () => {
    textReveals();
    warmUp();
    sweeps();
    tickerVelocity();
  });

  mm.add(MQ.reduce, () => {
    // Fades only, nothing moves.
    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 90%',
      once: true,
      onEnter: (els) => gsap.fromTo(els, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, stagger: 0.08 }),
    });
  });

  portraitReveal();
  typewriter();
}

/** Spec §5.1: pin the hero for 100vh; the name grows while the stands rise like a camera moving forward. */
function walkout() {
  const hero = $('[data-hero]');
  if (!hero) return;
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: hero, start: 'top top', end: '+=100%', pin: true, scrub: true },
  });
  tl.to('[data-walk-name]', { scale: 1.6, letterSpacing: '0.06em', duration: 1 }, 0)
    .to('[data-walk-fade]', { autoAlpha: 0, y: -20, duration: 0.3, stagger: 0.02 }, 0)
    .to('[data-stands]', { yPercent: -55, scaleX: 1.15, duration: 1 }, 0)
    .to('[data-planet]', { yPercent: -30, rotate: 8, duration: 1 }, 0)
    .to('[data-planet-ring]', { yPercent: -30, duration: 1 }, 0)
    .to('[data-beam]', { filter: 'brightness(1.4)', duration: 0.3 }, 0);
}

function textReveals() {
  // Headlines: lines rise from masks, 80ms stagger, at 75% of the viewport.
  $$('[data-reveal="lines"]').forEach((el) => {
    SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.lines, {
          yPercent: 110,
          duration: 0.9,
          stagger: 0.08,
          ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 75%', once: true },
        }),
    });
  });

  // Paragraphs: fade + y 24px, 100ms stagger.
  ScrollTrigger.batch('[data-reveal="fade"]', {
    start: 'top 85%',
    once: true,
    onEnter: (els) => gsap.fromTo(els, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.1, ease: 'expo.out' }),
  });
}

/** Spec §5.2 Warm-Up motion. */
function warmUp() {
  const section = $('#warmup');
  if (!section) return;

  // Background word drifts −15% → +5% across the section.
  gsap.fromTo('[data-bgword]', { xPercent: -15 }, {
    xPercent: 5,
    ease: 'none',
    scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true },
  });

  // Drills tick one per 8% of progress; the open box wiggles once all four are done.
  const drills = $('[data-drills]');
  if (drills) {
    const done = $$('li.done', drills);
    const open = $('li:not(.done) .drills__box', drills);
    const ticks = done.map((li) => {
      const box = $('.drills__box', li)!;
      const path = $('path', li)!;
      return gsap.timeline({ paused: true })
        .fromTo(box, { backgroundColor: 'rgba(245,197,66,0)' }, { backgroundColor: '#f5c542', duration: 0.15 }, 0)
        .fromTo(path, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.3, ease: 'power2.out' }, 0.05)
        .fromTo(box, { scale: 1 }, { scale: 1.25, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out' }, 0);
    });
    ticks.forEach((t) => t.progress(0));
    let shown = 0;
    let wiggled = false;
    ScrollTrigger.create({
      trigger: drills,
      start: 'top 80%',
      end: 'bottom 20%',
      onUpdate: (self) => {
        const n = Math.min(ticks.length, Math.floor(self.progress / 0.08));
        while (shown < n) ticks[shown++].play();
        while (shown > n) ticks[--shown].reverse();
        if (n === ticks.length && !wiggled && open) {
          wiggled = true;
          gsap.fromTo(open, { rotate: 0 }, { keyframes: { rotate: [-14, 12, -8, 5, 0] }, duration: 0.6, ease: 'power1.inOut' });
        }
      },
    });
  }

  // Gold 7 rotates in when the portrait enters.
  gsap.from('[data-seven-badge]', {
    rotate: -20,
    autoAlpha: 0,
    duration: 0.8,
    ease: 'back.out(2)',
    scrollTrigger: { trigger: '[data-portrait]', start: 'top 75%', once: true },
  });
}

/** Spec §4.5 MVP: a white band at 15% sweeps diagonally as each section's top crosses 60%. */
function sweeps() {
  const sweep = document.createElement('div');
  sweep.className = 'sweep';
  sweep.setAttribute('aria-hidden', 'true');
  sweep.innerHTML = '<div class="sweep__band"></div>';
  document.body.appendChild(sweep);
  const band = sweep.firstElementChild!;

  $$('[data-zone]').forEach((section) => {
    ScrollTrigger.create({
      trigger: section,
      start: 'top 60%',
      onEnter: () => {
        gsap.timeline()
          .set(sweep, { visibility: 'visible' })
          .fromTo(band, { xPercent: -120, x: 0 }, { x: () => window.innerWidth * 1.3, duration: 0.6, ease: 'power2.inOut' })
          .set(sweep, { visibility: 'hidden' });
      },
    });
  });
  return () => sweep.remove();
}

/** Spec §5.1 ticker: velocity speeds the marquee up to 3× and skews it ±6°. */
function tickerVelocity() {
  const tracks = $$('[data-velocity]');
  if (!tracks.length) return;
  const anims = tracks.flatMap((t) => t.getAnimations());
  const skewTo = tracks.map((t) => gsap.quickTo(t, 'skewX', { duration: 0.4, ease: 'power3' }));
  const state = { rate: 1 };
  const apply = () => anims.forEach((a) => (a.playbackRate = state.rate));

  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      const v = self.getVelocity();
      const rate = 1 + gsap.utils.clamp(0, 2, Math.abs(v) / 900);
      gsap.to(state, { rate, duration: 0.2, overwrite: true, onUpdate: apply });
      skewTo.forEach((fn) => fn(gsap.utils.clamp(-6, 6, v / -300)));
      gsap.delayedCall(0.15, () => {
        gsap.to(state, { rate: 1, duration: 0.8, overwrite: true, onUpdate: apply });
        skewTo.forEach((fn) => fn(0));
      });
    },
  });
}

/** Spec §5.2 portrait: halftone clears from the pointer outward; slight 3D tilt (max 6°). Tap toggles on touch. */
function portraitReveal() {
  const p = $('[data-portrait]');
  if (!p) return;
  const reduce = window.matchMedia(MQ.reduce).matches;
  const setPos = (e: PointerEvent) => {
    const r = p.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    p.style.setProperty('--mx', `${x * 100}%`);
    p.style.setProperty('--my', `${y * 100}%`);
    return { x, y };
  };

  if (finePointer) {
    const rx = gsap.quickTo(p, 'rotationX', { duration: 0.5, ease: 'power3' });
    const ry = gsap.quickTo(p, 'rotationY', { duration: 0.5, ease: 'power3' });
    gsap.set(p, { transformPerspective: 900 });
    p.addEventListener('pointerenter', (e) => { setPos(e); p.classList.add('is-revealed'); });
    p.addEventListener('pointermove', (e) => {
      const { x, y } = setPos(e);
      if (!reduce) { rx((0.5 - y) * 12); ry((x - 0.5) * 12); }
    });
    p.addEventListener('pointerleave', () => { p.classList.remove('is-revealed'); rx(0); ry(0); });
  } else {
    p.addEventListener('click', (e) => { setPos(e as PointerEvent); p.classList.toggle('is-revealed'); });
  }
}

/** Spec §5.2 profile rows: values type in, mono, 12ms per character. Layout never shifts. */
function typewriter() {
  const list = $('[data-typewriter]');
  if (!list) return;
  const reduce = window.matchMedia(MQ.reduce).matches;
  const rows = $$('dd', list);
  if (reduce) return;

  const live = rows.map((dd) => {
    const text = dd.textContent ?? '';
    dd.innerHTML = '';
    const ghost = document.createElement('span');
    ghost.className = 'tw-ghost';
    ghost.textContent = text; // stays in flow and is what screen readers read
    const typed = document.createElement('span');
    typed.className = 'tw-live';
    typed.setAttribute('aria-hidden', 'true');
    dd.append(ghost, typed);
    return { ghost, typed, text };
  });
  live.forEach(({ ghost }) => (ghost.style.color = 'transparent'));

  ScrollTrigger.create({
    trigger: list,
    start: 'top 85%',
    once: true,
    onEnter: () => {
      let delay = 0;
      live.forEach(({ typed, text }) => {
        const counter = { n: 0 };
        gsap.to(counter, {
          n: text.length,
          duration: text.length * 0.012,
          delay,
          ease: 'none',
          onUpdate: () => (typed.textContent = text.slice(0, Math.round(counter.n))),
        });
        delay += 0.12;
      });
    },
  });
}
