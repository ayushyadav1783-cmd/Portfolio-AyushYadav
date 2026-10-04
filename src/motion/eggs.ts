// Easter eggs (spec §7): SIUUU (7 taps on the 7), anime mode (Konami), GOAL (type "goal"),
// Houston (hover the planet 3 s, click to warp), devtools greeting. All skippable; Esc always exits.
import { gsap } from 'gsap';
import { reducedMotion } from './env';
import { flip } from './fulltime';
import { startScroll, stopScroll } from './scroll';

const GOLD = '#f5c542';
const RED = '#ff4a3d';
const LIGHT = '#f6f3ec';

export function initEggs() {
  siuuu();
  anime();
  goal();
  houston();
  devtools();
}

// ---------------------------------------------------------------------------
// SIUUU
// ---------------------------------------------------------------------------
function siuuu() {
  const seven = document.querySelector<HTMLButtonElement>('[data-seven]');
  const taps = document.querySelector<HTMLElement>('[data-taps]');
  const dialog = document.querySelector<HTMLDialogElement>('[data-siu]');
  if (!seven || !taps || !dialog) return;
  let count = 0;
  let reset = 0;

  seven.addEventListener('click', () => {
    count++;
    clearTimeout(reset);
    reset = window.setTimeout(() => { count = 0; taps.textContent = ''; }, 4000);
    if (!reducedMotion) gsap.fromTo(seven, { scale: 1.25 }, { scale: 1, duration: 0.35, ease: 'back.out(3)' });
    if (count >= 7) { count = 0; taps.textContent = ''; celebrate(); return; }
    taps.textContent = count >= 2 ? `${7 - count} MORE…` : '';
  });

  function celebrate() {
    stopScroll();
    dialog!.showModal();
    window.dispatchEvent(new CustomEvent('md:sound', { detail: 'roar' }));
    const confetti = dialog!.querySelector<HTMLElement>('[data-siu-confetti]')!;
    confetti.innerHTML = '';
    const pieces: HTMLElement[] = [];
    for (let i = 0; i < 90; i++) {
      const c = document.createElement('i');
      c.style.cssText = `position:absolute;left:50%;top:50%;width:${6 + Math.random() * 10}px;height:${3 + Math.random() * 6}px;background:${[GOLD, LIGHT, RED][i % 3]}`;
      confetti.appendChild(c);
      pieces.push(c);
    }
    if (reducedMotion) {
      pieces.forEach((c) => gsap.set(c, { x: gsap.utils.random(-innerWidth / 2, innerWidth / 2), y: gsap.utils.random(-innerHeight / 2, innerHeight / 2), rotation: gsap.utils.random(0, 360) }));
      return;
    }
    gsap.timeline()
      .fromTo('[data-siu-title]', { scale: 0.3, rotation: -8, autoAlpha: 0 }, { scale: 1, rotation: -3, autoAlpha: 1, duration: 0.7, ease: 'back.out(2.5)' })
      .fromTo('[data-siu-text], [data-siu-close]', { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.1 }, 0.4)
      .to(dialog, { keyframes: { x: [-4, 4, -3, 3, 0] }, duration: 0.3 }, 0.35);
    pieces.forEach((c) => {
      const a = Math.random() * Math.PI * 2, d = 200 + Math.random() * Math.max(innerWidth, innerHeight) * 0.6;
      gsap.fromTo(c, { x: 0, y: 0, rotation: 0 }, { x: Math.cos(a) * d, y: Math.sin(a) * d + 200, rotation: gsap.utils.random(-720, 720), duration: gsap.utils.random(1.2, 2.2), ease: 'power3.out' });
    });
    gsap.fromTo('[data-siu-burst]', { rotation: 0 }, { rotation: 360, duration: 24, ease: 'none', repeat: -1 });
  }

  const close = () => { if (dialog.open) dialog.close(); };
  dialog.querySelector('[data-siu-close]')?.addEventListener('click', close);
  dialog.addEventListener('close', () => { gsap.killTweensOf('[data-siu-burst]'); startScroll(); seven.focus({ preventScroll: true }); });
}

// ---------------------------------------------------------------------------
// Anime mode
// ---------------------------------------------------------------------------
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
const SFX = ['DOOON', 'BAM!', 'SIUU', 'ZOOM', 'KRAK!', 'WHAM', 'DON!'];

function anime() {
  let pos = 0;
  document.addEventListener('keydown', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    pos = k === KONAMI[pos] ? pos + 1 : k === KONAMI[0] ? 1 : 0;
    if (pos < KONAMI.length) return;
    pos = 0;
    const on = document.documentElement.classList.toggle('anime');
    toast(on ? 'Anime mode unlocked. Power level: rising.' : 'Anime mode off. Power level: sensible.');
  });
  document.addEventListener('pointerdown', (e) => {
    if (!document.documentElement.classList.contains('anime')) return;
    const w = document.createElement('span');
    w.setAttribute('aria-hidden', 'true');
    w.textContent = SFX[Math.floor(Math.random() * SFX.length)];
    w.className = 'sfx';
    w.style.left = `${e.clientX}px`;
    w.style.top = `${e.clientY}px`;
    document.body.appendChild(w);
    gsap.timeline({ onComplete: () => w.remove() })
      .fromTo(w, { scale: 0.2, rotation: gsap.utils.random(-20, 20), autoAlpha: 1 }, { scale: 1, duration: reducedMotion ? 0.01 : 0.35, ease: 'back.out(3)' })
      .to(w, { autoAlpha: 0, y: -30, duration: 0.4 }, '+=0.35');
  });
}

function toast(text: string) {
  let t = document.querySelector<HTMLElement>('.egg-toast');
  if (!t) {
    t = document.createElement('p');
    t.className = 'egg-toast m';
    t.setAttribute('role', 'status');
    document.body.appendChild(t);
  }
  t.textContent = text;
  gsap.killTweensOf(t);
  gsap.timeline()
    .fromTo(t, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.3 })
    .to(t, { autoAlpha: 0, duration: 0.4 }, '+=2.4');
}

// ---------------------------------------------------------------------------
// GOAL
// ---------------------------------------------------------------------------
function goal() {
  let typed = '';
  let score = 7;
  document.addEventListener('keydown', (e) => {
    const el = e.target as HTMLElement;
    if (el.closest('input, textarea, select, [contenteditable="true"]') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-4);
    if (typed !== 'goal') return;
    typed = '';
    score++;
    document.querySelectorAll<HTMLElement>('[data-score-bar]').forEach((s) => (s.textContent = String(score)));
    const flap = document.querySelector<HTMLElement>('[data-score-home]');
    if (flap) { if (reducedMotion) flap.textContent = String(score); else flip(flap, String(score)); }
    const sr = document.querySelector<HTMLElement>('[data-score-sr]');
    if (sr) sr.textContent = `Final score: Ayush ${score}, Bugs 0, full time`;
    toast(`GOAL! Ayush ${score} – 0 Bugs.`);
    window.dispatchEvent(new CustomEvent('md:sound', { detail: 'cheer' }));
    netRipple();
  });
}

function netRipple() {
  const bar = document.querySelector<HTMLElement>('[data-bar]');
  if (!bar || reducedMotion) return;
  const net = document.createElement('span');
  net.setAttribute('aria-hidden', 'true');
  net.className = 'bar-net';
  bar.appendChild(net);
  gsap.timeline({ onComplete: () => net.remove() })
    .fromTo(net, { opacity: 0, scaleY: 1 }, { opacity: 1, duration: 0.1 })
    .to(net, { scaleY: 1.6, duration: 0.15, yoyo: true, repeat: 3, ease: 'sine.inOut', transformOrigin: '50% 0%' })
    .to(net, { opacity: 0, duration: 0.4 });
}

// ---------------------------------------------------------------------------
// Houston
// ---------------------------------------------------------------------------
function houston() {
  const planet = document.querySelector<HTMLElement>('[data-planet]');
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  if (!planet || !hero) return;
  const tip = document.createElement('p');
  tip.className = 'houston m';
  tip.setAttribute('role', 'status');
  tip.textContent = 'Houston, we have a portfolio.';
  hero.appendChild(tip);
  let timer = 0;
  let over = false;
  let shown = false;

  const inside = (x: number, y: number) => {
    const r = planet.getBoundingClientRect();
    return Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2)) < r.width / 2;
  };
  const show = () => {
    shown = true;
    const r = planet.getBoundingClientRect(), hr = hero.getBoundingClientRect();
    tip.style.left = `${r.left - hr.left + r.width / 2}px`;
    tip.style.top = `${r.bottom - hr.top + 14}px`;
    gsap.to(tip, { autoAlpha: 1, y: 0, duration: 0.3 });
    gsap.to(planet, { scale: 1.08, duration: 0.6, ease: 'expo.out' });
  };
  const hide = () => {
    shown = false;
    clearTimeout(timer);
    gsap.to(tip, { autoAlpha: 0, duration: 0.2 });
    gsap.to(planet, { scale: 1, duration: 0.6, ease: 'expo.out' });
  };
  window.addEventListener('pointermove', (e) => {
    const now = inside(e.clientX, e.clientY);
    if (now && !over) { over = true; timer = window.setTimeout(show, 3000); }
    if (!now && over) { over = false; hide(); }
    hero.classList.toggle('is-on-planet', now);
  }, { passive: true });
  window.addEventListener('click', (e) => {
    if (!inside(e.clientX, e.clientY) || !shown) return;
    warp(planet, hero);
  });
}

function warp(planet: HTMLElement, hero: HTMLElement) {
  if (reducedMotion) return;
  const c = document.createElement('canvas');
  c.setAttribute('aria-hidden', 'true');
  c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none';
  hero.appendChild(c);
  const r = hero.getBoundingClientRect(), pr = planet.getBoundingClientRect();
  const dpr = Math.min(2, devicePixelRatio || 1);
  c.width = r.width * dpr; c.height = r.height * dpr;
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  const cx = pr.left - r.left + pr.width / 2, cy = pr.top - r.top + pr.height / 2;
  const streaks = Array.from({ length: 260 }, () => ({ a: Math.random() * Math.PI * 2, d: Math.random() * 80, v: 2 + Math.random() * 6 }));
  const state = { t: 0 };
  gsap.to(state, {
    t: 1, duration: 1, ease: 'power2.in',
    onUpdate: () => {
      g.clearRect(0, 0, r.width, r.height);
      const k = state.t;
      g.lineWidth = 1.5;
      for (const s of streaks) {
        s.d += s.v * (1 + k * 30);
        const x1 = cx + Math.cos(s.a) * s.d, y1 = cy + Math.sin(s.a) * s.d;
        const len = 10 + k * 160;
        g.strokeStyle = `rgba(246,243,236,${0.3 + k * 0.6})`;
        g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - Math.cos(s.a) * len, y1 - Math.sin(s.a) * len); g.stroke();
      }
    },
    onComplete: () => gsap.to(c, { opacity: 0, duration: 0.3, onComplete: () => c.remove() }),
  });
}

// ---------------------------------------------------------------------------
// Devtools
// ---------------------------------------------------------------------------
function devtools() {
  console.log(
    '%c7%c You opened devtools. Respect. Let\'s talk: ayushyadav1783@gmail.com',
    'background:#f5c542;color:#120d02;font:900 22px "Arial Narrow",sans-serif;padding:4px 12px;border-radius:999px',
    'color:#f5c542;font:600 13px monospace;padding-left:8px',
  );
}
