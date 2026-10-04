// Match Highlights (spec §8): the recruiter escape hatch. Native dialog (focus contained, Esc closes),
// URL #highlights, a broadcast "replay" wipe in, then the content fades up. Nothing else, recruiters are busy.
import { gsap } from 'gsap';
import { reducedMotion } from './env';
import { startScroll, stopScroll } from './scroll';

const HASH = '#highlights';

export function initHighlights() {
  const dialog = document.querySelector<HTMLDialogElement>('[data-hl]');
  const panel = document.querySelector<HTMLElement>('[data-hl-panel]');
  const stripe = document.querySelector<HTMLElement>('[data-replay]');
  if (!dialog || !panel || !stripe) return;
  const items = [...panel.querySelectorAll<HTMLElement>('[data-hl-item]')];
  let opener: HTMLElement | null = null;
  let closing = false;

  function open(trigger: HTMLElement | null) {
    if (dialog!.open) return;
    opener = trigger;
    stopScroll();
    if (location.hash !== HASH) history.pushState(null, '', HASH);
    if (reducedMotion) {
      dialog!.showModal();
      gsap.fromTo(panel, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25 });
      return;
    }
    gsap.set(panel, { autoAlpha: 0 });
    gsap.timeline()
      .set(stripe, { visibility: 'visible', xPercent: -130 })
      .to(stripe, { xPercent: 0, duration: 0.2, ease: 'power3.out' })
      .call(() => dialog!.showModal())
      .to(stripe, { xPercent: 130, duration: 0.2, ease: 'power3.in' }, '+=0.05')
      .set(stripe, { visibility: 'hidden' })
      .set(panel, { autoAlpha: 1 }, '-=0.15')
      .fromTo(items, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.04, ease: 'expo.out', clearProps: 'all' }, '<');
  }

  function close(fromHistory = false) {
    if (!dialog!.open || closing) return;
    closing = true;
    gsap.to(panel, {
      autoAlpha: 0, y: reducedMotion ? 0 : 12, duration: reducedMotion ? 0.15 : 0.25, ease: 'power2.in',
      onComplete: () => {
        dialog!.close();
        gsap.set(panel, { clearProps: 'all' });
        closing = false;
      },
    });
    if (!fromHistory && location.hash === HASH) history.replaceState(null, '', location.pathname + location.search);
  }

  dialog.addEventListener('close', () => {
    startScroll();
    opener?.focus({ preventScroll: true });
  });
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  dialog.querySelectorAll('[data-hl-close]').forEach((b) => b.addEventListener('click', () => close()));

  document.addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest<HTMLAnchorElement>(`a[href="${HASH}"]`);
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    open(a);
  });
  window.addEventListener('popstate', () => {
    if (location.hash === HASH) open(null);
    else close(true);
  });
  if (location.hash === HASH) open(null);
}
