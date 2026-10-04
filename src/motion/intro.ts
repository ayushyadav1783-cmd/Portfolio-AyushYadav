// Tunnel walkout preloader (spec §4.1, board 03). Runs only when the head script set html.intro.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { startScroll, stopScroll } from './scroll';

gsap.registerPlugin(SplitText);

const html = document.documentElement;
const MIN_TUNNEL = 900;   // ms, F1
const MAX_WAIT = 4000;    // hold at 07/07 at most this long, then continue anyway
const SKIP_AT = 600;      // skip link appears

/** Resolves when the intro is over (or immediately when there is none). */
export function runIntro(): Promise<void> {
  if (!html.classList.contains('intro')) return Promise.resolve();

  const q = <T extends Element = HTMLElement>(s: string) => document.querySelector<T>(s)!;
  const pre = q('[data-pre]');
  const tunnel = q('[data-pre-tunnel]');
  const light = q('[data-pre-light]');
  const flash = q('[data-pre-flash]');
  const count = q('[data-pre-count]');
  const skip = q<HTMLButtonElement>('[data-pre-skip]');
  const hero = q('[data-hero]');
  const bar = q('[data-bar]');
  const hurry = q('.bar__hurry');
  const lamps = [
    ...[...document.querySelectorAll<HTMLElement>('.tower--l .tower__lamps span')].reduce<HTMLElement[][]>((rows, el, i) => ((rows[i >> 2] ??= []).push(el), rows), []),
    ...[...document.querySelectorAll<HTMLElement>('.tower--r .tower__lamps span')].reduce<HTMLElement[][]>((rows, el, i) => ((rows[i >> 2] ??= []).push(el), rows), []),
  ]; // 4 floodlights: left top, left bottom, right top, right bottom
  const lampBoxes = [...document.querySelectorAll<HTMLElement>('.tower__lamps')];
  const beams = [...document.querySelectorAll<HTMLElement>('[data-beam]')];

  stopScroll();
  html.style.overflow = 'hidden';

  // ---- Final-state prep (everything below the overlay starts "off") ------
  const first = SplitText.create('[data-intro-first]', { type: 'chars', mask: 'chars' });
  const tagline = SplitText.create('.hero__tagline', { type: 'words' });
  gsap.set(first.chars, { yPercent: 110 });
  gsap.set('[data-intro-last]', { clipPath: 'inset(0 100% 0 0)' });
  gsap.set('[data-intro-stop]', { yPercent: -160, autoAlpha: 0 });
  gsap.set(['.hero__eyebrow', '.hero__sub', '.hero__cue'], { autoAlpha: 0 });
  gsap.set(tagline.words, { autoAlpha: 0, y: 14 });
  gsap.set('.hero__ctas > *', { autoAlpha: 0, y: 16 });
  gsap.set('[data-planet]', { scale: 0.6, autoAlpha: 0 });
  gsap.set('[data-planet-ring]', { autoAlpha: 0 });
  gsap.set(lamps.flat(), { backgroundColor: '#2a2a35' });
  gsap.set(lampBoxes, { boxShadow: '0 0 0px 0px rgba(246,243,236,0)' });
  gsap.set(beams, { autoAlpha: 0 });
  gsap.set(bar, { yPercent: -100 });
  gsap.set(hurry, { scale: 0.6, autoAlpha: 0 });
  gsap.set(hero, { scale: 1.4, filter: 'blur(8px)', transformOrigin: '50% 60%' });

  // ---- Main sequence F2–F4 (0.9s → 2.6s) ---------------------------------
  const tl = gsap.timeline({ paused: true });
  // F2: camera exits the tunnel, floodlights bang on 140ms apart.
  tl.to(tunnel, { scale: 3, autoAlpha: 0, duration: 0.7, ease: 'power2.in' }, 0)
    .to(pre, { backgroundColor: 'rgba(3,3,4,0)', duration: 0.5, ease: 'power1.in' }, 0.2)
    .to(hero, { scale: 1, filter: 'blur(0px)', duration: 0.7, ease: 'expo.out' }, 0);
  lamps.forEach((row, i) => {
    const t = 0.1 + i * 0.14;
    tl.to(flash, { opacity: 0.15, duration: 0.03 }, t)
      .to(flash, { opacity: 0, duration: 0.03 }, t + 0.06)
      .set(row, { backgroundColor: '#fffbe8' }, t)
      .to(lampBoxes[i >> 1], { boxShadow: '0 0 40px 10px rgba(246,243,236,.35)', duration: 0.3 }, t);
    if (i % 2 === 0) tl.to(beams[i >> 1], { autoAlpha: 1, duration: 0.3 }, t + 0.06);
  });
  // F3: name, outline, planet, full stop.
  tl.to(first.chars, { yPercent: 0, duration: 0.8, stagger: 0.028, ease: 'expo.out' }, 0.7)
    .to('[data-intro-last]', { clipPath: 'inset(0 0% 0 0)', duration: 0.6, ease: 'power2.inOut' }, 0.85)
    .to('[data-planet]', { scale: 1, autoAlpha: 1, duration: 0.7, ease: 'expo.out' }, 0.8)
    .fromTo('[data-planet]', { filter: 'brightness(1)' }, { filter: 'brightness(1.5)', duration: 0.2, yoyo: true, repeat: 1 }, 1.2)
    .to('[data-planet-ring]', { autoAlpha: 1, duration: 0.5 }, 1.0)
    .to('[data-intro-stop]', { yPercent: 0, autoAlpha: 1, duration: 0.5, ease: 'bounce.out' }, 1.25)
    .to('.hero__eyebrow', { autoAlpha: 1, duration: 0.4 }, 1.1)
  // F4: bar slides down, highlights pill pops in last, tagline word by word, CTAs follow.
    .to(bar, { yPercent: 0, duration: 0.3, ease: 'expo.out' }, 1.4)
    .to(tagline.words, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.04, ease: 'expo.out' }, 1.4)
    .to(['.hero__sub', '.hero__cue'], { autoAlpha: 1, duration: 0.4 }, 1.55)
    .to('.hero__ctas > *', { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.06, ease: 'expo.out' }, 1.55)
    .to(hurry, { scale: 1, autoAlpha: 1, duration: 0.4, ease: 'back.out(2.5)' }, 1.6);

  return new Promise((resolve) => {
    let finished = false;
    let started = false;

    function finish() {
      if (finished) return;
      finished = true;
      tl.progress(1);
      gsap.killTweensOf([light, count]);
      gsap.to([pre, skip], {
        autoAlpha: 0, duration: 0.2, onComplete: () => {
          html.classList.remove('intro');
          html.style.overflow = '';
          // Hand the hero back to CSS and the scroll-driven walkout.
          gsap.set(hero, { clearProps: 'transform,filter,scale' });
          gsap.set([bar, hurry, lampBoxes, beams, lamps.flat(), '[data-planet]', '[data-planet-ring]'], { clearProps: 'all' });
          first.revert();
          tagline.revert();
          gsap.set(['[data-intro-last]', '[data-intro-stop]', '.hero__eyebrow', '.hero__sub', '.hero__cue', '.hero__ctas > *'], { clearProps: 'all' });
          startScroll();
          ScrollTrigger.refresh();
          document.removeEventListener('keydown', onKey);
          resolve();
        },
      });
    }
    function play() {
      if (started) return;
      started = true;
      tl.eventCallback('onComplete', finish).play();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); finish(); }
    }

    skip.addEventListener('click', finish);
    document.addEventListener('keydown', onKey);
    gsap.to(skip, { opacity: 1, duration: 0.3, delay: SKIP_AT / 1000 });

    // F1: light at the end of the tunnel grows with real loading progress.
    const groups: Promise<unknown>[] = [
      document.fonts.load('900 1em "Big Shoulders Display"'),
      document.fonts.load('800 1em "Big Shoulders Display"'),
      document.fonts.load('400 1em "Instrument Sans"'),
      document.fonts.load('500 1em "Instrument Sans"'),
      document.fonts.load('400 1em "JetBrains Mono"'),
      document.fonts.load('700 1em "JetBrains Mono"'),
      document.readyState === 'complete' ? Promise.resolve() : new Promise((r) => window.addEventListener('load', r, { once: true })),
    ];
    let loaded = 0;
    gsap.set(light, { scale: 0 });
    const tick = () => {
      loaded++;
      count.textContent = `${String(loaded).padStart(2, '0')}/07`; // ticks once per loaded group
      gsap.to(light, { scale: loaded / groups.length, duration: 0.7, ease: 'power2.out', overwrite: true });
    };
    groups.forEach((g) => g.then(tick, tick));

    const t0 = performance.now();
    Promise.all(groups.map((g) => g.catch(() => {})))
      .then(() => new Promise((r) => setTimeout(r, Math.max(0, MIN_TUNNEL - (performance.now() - t0)))))
      .then(play);
    setTimeout(play, MAX_WAIT);
  });
}
