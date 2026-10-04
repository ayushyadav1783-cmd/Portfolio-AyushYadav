// Full Time Whistle (spec §5.6): whistle flash, headline slam + type-on, copy-email, split-flap
// scoreboard. The penalty shootout + transfer bid that replaced the chat live in shootout.ts.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { reducedMotion } from './env';

gsap.registerPlugin(ScrollTrigger, SplitText);

export function initFullTime() {
  const section = document.querySelector<HTMLElement>('[data-fulltime]');
  if (!section) return;
  if (!reducedMotion) {
    whistle(section);
    headline(section);
    scoreboard();
  }
  copyEmail(section);
}

/** Section top hits 50%: a 2-frame white flash. (The whistle sound arrives with the sound toggle.) */
function whistle(section: HTMLElement) {
  ScrollTrigger.create({
    trigger: section,
    start: 'top 50%',
    once: true,
    onEnter: () => {
      const flash = document.createElement('div');
      flash.setAttribute('aria-hidden', 'true');
      flash.style.cssText = 'position:fixed;inset:0;z-index:90;background:#fff;opacity:.5;pointer-events:none';
      document.body.appendChild(flash);
      gsap.to(flash, { opacity: 0, duration: 0.07, delay: 1 / 30, onComplete: () => flash.remove() });
    },
  });
}

/** "FULL TIME." slams in (scale 1.3→1, 300ms, 4px shake); "YOUR MOVE." types in after it. */
function headline(section: HTMLElement) {
  const a = section.querySelector<HTMLElement>('[data-ft-a]');
  const b = section.querySelector<HTMLElement>('[data-ft-b]');
  if (!a || !b) return;
  const chars = SplitText.create(b, { type: 'chars' }).chars;
  gsap.set(a, { autoAlpha: 0, scale: 1.3, transformOrigin: '0% 60%' });
  gsap.set(chars, { visibility: 'hidden' }); // keeps layout, so nothing shifts
  ScrollTrigger.create({
    trigger: a,
    start: 'top 80%',
    once: true,
    onEnter: () => {
      gsap.timeline()
        .to(a, { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'power4.in' })
        .to('main', { keyframes: { x: [-4, 4, -3, 3, -1, 0] }, duration: 0.24, ease: 'none', clearProps: 'transform' })
        .to(chars, { visibility: 'visible', duration: 0.001, stagger: 0.06 }, '+=0.05');
    },
  });
}

/** Copy email: label rolls up, the button bulges with a ripple, 12 gold particles burst from the cursor. */
function copyEmail(section: HTMLElement) {
  const btn = section.querySelector<HTMLAnchorElement>('[data-copy]');
  const status = section.querySelector<HTMLElement>('[data-copy-status]');
  if (!btn || !status) return;
  btn.setAttribute('role', 'button');
  const aLines = btn.querySelectorAll<HTMLElement>('[data-roll-a]');
  const bLines = btn.querySelectorAll<HTMLElement>('[data-roll-b]');
  const ripple = btn.querySelector<HTMLElement>('[data-copy-ripple]')!;
  let timer = 0;

  const setState = (copied: boolean) => {
    const d = reducedMotion ? 0 : 0.4;
    gsap.to(aLines, { yPercent: copied ? -110 : 0, duration: d, ease: 'expo.out' });
    gsap.to(bLines, { yPercent: copied ? -110 : 0, duration: d, ease: 'expo.out' });
    gsap.to(btn, { backgroundColor: copied ? '#f6f3ec' : '#f5c542', duration: reducedMotion ? 0 : 0.3 });
    bLines.forEach((l) => l.setAttribute('aria-hidden', String(!copied)));
    aLines.forEach((l) => l.setAttribute('aria-hidden', String(copied)));
  };

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = btn.dataset.copy!;
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      window.location.href = `mailto:${email}`; // clipboard blocked: fall back to the mail client
      return;
    }
    status.textContent = 'Email address copied to your clipboard.';
    setState(true);
    clearTimeout(timer);
    timer = window.setTimeout(() => { setState(false); status.textContent = ''; }, 2200);
    if (reducedMotion) return;

    const r = btn.getBoundingClientRect();
    const x = e.detail === 0 ? r.left + r.width / 2 : e.clientX;
    const y = e.detail === 0 ? r.top + r.height / 2 : e.clientY;
    // Bulge + net ripple from the click point.
    ripple.style.setProperty('--rx', `${x - r.left}px`);
    ripple.style.setProperty('--ry', `${y - r.top}px`);
    gsap.fromTo(ripple, { scale: 1, opacity: 0.9 }, { scale: 60, opacity: 0, duration: 0.7, ease: 'power2.out' });
    gsap.fromTo(btn, { scale: 1 }, { scale: 1.04, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out', clearProps: 'scale' });
    // 12 gold particles.
    for (let i = 0; i < 12; i++) {
      const p = document.createElement('span');
      p.setAttribute('aria-hidden', 'true');
      p.style.cssText = `position:fixed;left:${x - 3}px;top:${y - 3}px;width:6px;height:6px;border-radius:999px;background:#f5c542;pointer-events:none;z-index:95`;
      document.body.appendChild(p);
      const a = (i / 12) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 40 + Math.random() * 50;
      gsap.to(p, { x: Math.cos(a) * dist, y: Math.sin(a) * dist + 20, autoAlpha: 0, scale: 0.4, duration: 0.6, ease: 'power2.out', onComplete: () => p.remove() });
    }
  });
}

/** Footer scoreboard digits flip like a split-flap board when the footer enters. */
function scoreboard() {
  const foot = document.querySelector<HTMLElement>('[data-foot]');
  if (!foot) return;
  const flaps = [...foot.querySelectorAll<HTMLElement>('[data-flap]')];
  ScrollTrigger.create({
    trigger: foot,
    start: 'top 92%',
    once: true,
    onEnter: () => flaps.forEach((f, i) => flip(f, f.textContent ?? '', i * 0.15)),
  });
}

/** Split-flap a digit through a few random values and land on `final`. Exported for the GOAL egg. */
export function flip(el: HTMLElement, final: string, delay = 0) {
  const steps = 6;
  const tl = gsap.timeline({ delay });
  for (let s = 0; s < steps; s++) {
    const last = s === steps - 1;
    tl.to(el, { rotationX: 90, duration: 0.06, ease: 'power1.in' })
      .call(() => { el.textContent = last ? final : String(Math.floor(Math.random() * 10)); })
      .fromTo(el, { rotationX: -90 }, { rotationX: 0, duration: 0.06, ease: 'power1.out' });
  }
  return tl;
}
