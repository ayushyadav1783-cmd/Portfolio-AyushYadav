// Lenis smooth scroll synced to the GSAP ticker (spec §4.3), plus anchor navigation.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { finePointer, reducedMotion } from './env';

gsap.registerPlugin(ScrollTrigger);

export let lenis: Lenis | null = null;

const expoOut = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

export function initScroll() {
  // Native momentum is better on touch, and reduced motion gets plain scrolling.
  if (finePointer && !reducedMotion) {
    lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, autoRaf: false });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis?.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  document.addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const id = a.getAttribute('href')!.slice(1);
    const target = id ? document.getElementById(id) : null;
    if (!target) return; // #report-N / #highlights are handled by their own phases
    e.preventDefault();
    scrollToEl(target);
    history.pushState(null, '', `#${id}`);
  });
}

export function scrollToEl(el: HTMLElement) {
  if (lenis) {
    lenis.scrollTo(el, { duration: 1.2, easing: expoOut });
  } else {
    el.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  }
  // Move focus for keyboard and screen reader users without a second jump.
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}

export function stopScroll() { lenis?.stop(); }
export function startScroll() { lenis?.start(); }
