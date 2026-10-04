// Magnetic buttons (spec §6.1, board 06): within 80px the button shell drifts up to 10px toward the pointer
// and its label 14px (1.4x, for depth), then springs back. Fine pointers only. Uses the CSS `translate`
// property (via custom properties) so it stacks with the buttons' own hover transforms.
import { gsap } from 'gsap';

const RADIUS = 80;
const SHELL = 10;
const LABEL = 14;
const SELECTOR = '.btn, .bar__seven, .copy, .link, .tg__btn, .chip-opt span, .report__code, .hl__x, .scout__x, .map__close, .report__close';
/** Layouts that would break if their children were wrapped: the shell moves, the label doesn't. */
const NO_WRAP = '.copy, .link, .report__code';

export function initMagnetic() {
  const els = [...document.querySelectorAll<HTMLElement>(SELECTOR)];
  const items = els.map((el) => {
    // Wrap the contents so the label can move further than the shell.
    const wrap = !el.matches(NO_WRAP);
    if (wrap && !el.querySelector(':scope > .mag-label')) {
      const span = document.createElement('span');
      span.className = 'mag-label';
      while (el.firstChild) span.appendChild(el.firstChild);
      el.appendChild(span);
    }
    el.classList.add('is-magnetic');
    const label = el.querySelector<HTMLElement>(':scope > .mag-label') ?? el;
    const opts = { duration: 0.55, ease: 'power3.out' };
    return {
      el,
      sx: gsap.quickTo(el, '--mx', opts),
      sy: gsap.quickTo(el, '--my', opts),
      lx: wrap ? gsap.quickTo(label, '--lx', opts) : () => {},
      ly: wrap ? gsap.quickTo(label, '--ly', opts) : () => {},
      active: false,
    };
  });

  let raf = 0;
  let px = 0, py = 0;
  const update = () => {
    raf = 0;
    for (const it of items) {
      const r = it.el.getBoundingClientRect();
      if (r.width === 0) continue;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = px - cx, dy = py - cy;
      // Distance to the button's edge, not its centre, so wide buttons feel right.
      const ex = Math.max(0, Math.abs(dx) - r.width / 2), ey = Math.max(0, Math.abs(dy) - r.height / 2);
      const d = Math.hypot(ex, ey);
      if (d < RADIUS) {
        const k = 1 - d / RADIUS;
        const nx = dx / Math.max(1, Math.hypot(dx, dy)), ny = dy / Math.max(1, Math.hypot(dx, dy));
        it.sx(nx * SHELL * k); it.sy(ny * SHELL * k); it.lx(nx * LABEL * k); it.ly(ny * LABEL * k);
        it.active = true;
      } else if (it.active) {
        it.active = false;
        // Spring back to rest.
        it.sx(0); it.sy(0); it.lx(0); it.ly(0);
      }
    }
  };
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    px = e.clientX; py = e.clientY;
    if (!raf) raf = requestAnimationFrame(update);
  }, { passive: true });
}
