// Scouting Report (spec §8.1): resume links open an in-page VAR-check sequence instead of the raw PDF.
import { gsap } from 'gsap';
import { reducedMotion } from './env';
import { startScroll, stopScroll } from './scroll';

export function initScouting() {
  const dialog = document.querySelector<HTMLDialogElement>('[data-scout]');
  const sheet = document.querySelector<HTMLElement>('[data-scout-sheet]');
  const stripe = document.querySelector<HTMLElement>('[data-var-stripe]');
  const scan = document.querySelector<HTMLElement>('[data-scout-scan]');
  const stamp = document.querySelector<HTMLElement>('[data-scout-stamp]');
  if (!dialog || !sheet || !stripe || !scan || !stamp) return;

  let opener: HTMLElement | null = null;
  let closing = false;

  function open(trigger: HTMLElement) {
    if (dialog!.open) return;
    opener = trigger;
    stopScroll();
    if (location.hash !== '#resume') history.pushState({ scout: true }, '', '#resume');

    if (reducedMotion) {
      dialog!.showModal();
      gsap.fromTo(sheet, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 });
      gsap.set(stamp, { autoAlpha: 1 });
      return;
    }

    gsap.set(sheet, { autoAlpha: 0 });
    gsap.set(stamp, { autoAlpha: 0 });
    gsap.timeline()
      // 1. VAR stripe sweeps across the broadcast.
      .set(stripe, { visibility: 'visible', xPercent: -130 })
      .to(stripe, { xPercent: 0, duration: 0.2, ease: 'power3.out' })
      .call(() => dialog!.showModal())
      .to(stripe, { xPercent: 130, duration: 0.25, ease: 'power3.in' }, '+=0.12')
      .set(stripe, { visibility: 'hidden' })
      // 2. The sheet slides up and tilts flat, like a contract pushed across the table.
      .fromTo(sheet, { autoAlpha: 1, yPercent: 110, rotationX: 25, transformPerspective: 1200 },
        { yPercent: 0, rotationX: 0, duration: 0.7, ease: 'expo.out' }, '-=0.3')
      // 3. Gold scanline reviews the document.
      .fromTo(scan, { top: '0%', opacity: 1 }, { top: '100%', duration: 0.8, ease: 'power1.inOut' }, '-=0.2')
      .to(scan, { opacity: 0, duration: 0.15 })
      // 4. Decision: CLEARED stamp thumps in with a small shake.
      .fromTo(stamp, { autoAlpha: 0, scale: 2, rotate: -4 }, { autoAlpha: 1, scale: 1, rotate: -12, duration: 0.45, ease: 'back.out(2.2)' }, '-=0.1')
      .to(sheet, { keyframes: { x: [-3, 3, -2, 2, 0] }, duration: 0.25 }, '<0.12');
  }

  function close() {
    if (!dialog!.open || closing) return;
    closing = true;
    const done = () => {
      dialog!.close();
      gsap.set(sheet, { clearProps: 'transform,opacity,visibility' });
      closing = false;
    };
    if (reducedMotion) gsap.to(sheet, { autoAlpha: 0, duration: 0.2, onComplete: done });
    else gsap.to(sheet, { yPercent: 110, rotationX: 12, duration: 0.45, ease: 'power3.in', onComplete: done });
  }

  dialog.addEventListener('close', () => {
    startScroll();
    if (location.hash === '#resume') history.replaceState(null, '', location.pathname + location.search);
    opener?.focus({ preventScroll: true });
  });
  // Esc: animate out instead of the instant native close.
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); }); // backdrop
  dialog.querySelectorAll('[data-scout-close]').forEach((b) => b.addEventListener('click', close));

  document.addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[data-resume]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    open(a);
  });

  window.addEventListener('popstate', () => { if (location.hash !== '#resume') close(); });
  if (location.hash === '#resume') open(document.body);
}
