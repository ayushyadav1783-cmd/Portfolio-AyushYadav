// Capability flags shared by every motion module (spec §9).
const mq = (q: string) => typeof window !== 'undefined' && window.matchMedia(q).matches;

export const reducedMotion = mq('(prefers-reduced-motion: reduce)');
/** Mouse or trackpad. Touch devices get no Lenis, cursor, magnetic effect or physics. */
export const finePointer = mq('(hover: hover) and (pointer: fine)');
export const isTouch = !finePointer;

/** Media queries for gsap.matchMedia. */
export const MQ = {
  desktop: '(min-width: 768px) and (prefers-reduced-motion: no-preference)',
  mobile: '(max-width: 767px) and (prefers-reduced-motion: no-preference)',
  motion: '(prefers-reduced-motion: no-preference)',
  reduce: '(prefers-reduced-motion: reduce)',
};
