// Starting VII (spec §5.3): broadcast-camera pin, cards running into the 1-1-2-3, hover tilt and
// glare, flip to the gold teaser, then a shared-element expand into the match report at #report-N.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MQ, finePointer, reducedMotion } from './env';
import { startScroll, stopScroll } from './scroll';

gsap.registerPlugin(ScrollTrigger);

export function initStartingVII() {
  const stage = document.querySelector<HTMLElement>('[data-xi-stage]');
  const pitch = document.querySelector<HTMLElement>('[data-pitch]');
  if (!stage || !pitch) return;
  const cards = [...pitch.querySelectorAll<HTMLAnchorElement>('[data-card]')];

  const mm = gsap.matchMedia();
  mm.add(MQ.desktop, () => pinSequence(stage, pitch));
  mm.add(MQ.mobile, () => mobileRunIn(pitch));

  if (finePointer) cards.forEach((card) => hoverTilt(card, pitch));
  initReports(cards);
}

/**
 * Broadcast camera (agreed with Ayush, tightened on his feedback). The whole formation is on the
 * pitch from the first frame, already fitted to the screen. It tilts up while the section scrolls in
 * (no pin, no empty frames), then pins for a short 40vh: a hold to read the line-up, the 7 catching
 * the floodlights, and the camera zooming to 100% as the pin releases.
 */
function pinSequence(stage: HTMLElement, pitch: HTMLElement) {
  let fit = 1;
  let offY = 0;
  const measure = () => {
    const h = pitch.offsetHeight;
    const top = 84; // clear the broadcast bar
    fit = Math.min(1, (window.innerHeight - top - 24) / h);
    offY = top + Math.max(0, (window.innerHeight - top - 24 - h * fit) / 2);
  };
  measure();
  const st = pitch.querySelector<HTMLElement>('[data-slot="ST"]')!;
  gsap.set(pitch, { transformOrigin: '50% 0%', transformPerspective: 1600 });

  // Approach: tilt up quickly as it scrolls in.
  gsap.fromTo(pitch, { rotationX: 38 }, {
    rotationX: 0,
    ease: 'power2.out',
    scrollTrigger: { trigger: stage, start: 'top 85%', end: 'top 20%', scrub: 0.4 },
  });

  // Pinned: hold to view the line-up, then zoom to full size.
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: stage,
      start: 'top top',
      end: '+=40%',
      pin: true,
      scrub: 0.5,
      invalidateOnRefresh: true,
      onRefreshInit: measure,
    },
  });
  tl.fromTo(pitch, { scale: () => fit, y: () => offY }, { scale: () => fit, y: () => offY, duration: 0.45 }, 0)
    .fromTo(st, { filter: 'brightness(1) drop-shadow(0 0 0px rgba(245,197,66,0))' },
      { filter: 'brightness(1.5) drop-shadow(0 0 36px rgba(245,197,66,.85))', duration: 0.12 }, 0.08)
    .to(st, { filter: 'brightness(1) drop-shadow(0 0 0px rgba(245,197,66,0))', duration: 0.2 }, 0.2)
    .to(pitch, { scale: 1, y: 0, duration: 0.55, ease: 'power2.inOut' }, 0.45);

  return () => gsap.set([pitch, st], { clearProps: 'all' });
}

/** Mobile: no pin. Cards slide in from alternating sides as they enter. */
function mobileRunIn(pitch: HTMLElement) {
  pitch.querySelectorAll<HTMLElement>('[data-slot]').forEach((li, i) => {
    gsap.from(li, {
      xPercent: i % 2 ? 60 : -60,
      autoAlpha: 0,
      duration: 0.8,
      ease: 'expo.out',
      scrollTrigger: { trigger: li, start: 'top 90%', once: true },
    });
  });
}

/** Hover: tilt follows the pointer (max 12°), glare band tracks it, neighbours dim to 60%. */
function hoverTilt(card: HTMLElement, pitch: HTMLElement) {
  gsap.set(card, { transformPerspective: 900 });
  const rx = gsap.quickTo(card, 'rotationX', { duration: 0.5, ease: 'power3' });
  const ry = gsap.quickTo(card, 'rotationY', { duration: 0.5, ease: 'power3' });
  const lift = gsap.quickTo(card, 'y', { duration: 0.5, ease: 'power3' });

  card.addEventListener('pointerenter', () => {
    card.classList.add('is-active');
    pitch.classList.add('is-scouting');
    if (!reducedMotion) lift(-8);
  });
  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    card.style.setProperty('--gx', `${(1 - x) * 100}%`);
    if (reducedMotion) return;
    rx((0.5 - y) * 24);
    ry((x - 0.5) * 24);
  });
  card.addEventListener('pointerleave', () => {
    card.classList.remove('is-active');
    pitch.classList.remove('is-scouting');
    rx(0); ry(0); lift(0);
  });
}

// ---------------------------------------------------------------------------
// Match reports
// ---------------------------------------------------------------------------

function initReports(cards: HTMLAnchorElement[]) {
  const dialog = document.querySelector<HTMLDialogElement>('[data-report]');
  const panel = document.querySelector<HTMLElement>('[data-report-panel]');
  const curtain = document.querySelector<HTMLElement>('[data-report-curtain]');
  const scroller = document.querySelector<HTMLElement>('[data-report-scroll]');
  if (!dialog || !panel || !curtain || !scroller) return;
  const articles = [...dialog.querySelectorAll<HTMLElement>('[data-report-kit]')];
  const cardFor = (kit: string) => cards.find((c) => c.dataset.kit === kit) ?? null;
  const articleFor = (kit: string) => articles.find((a) => a.dataset.reportKit === kit) ?? null;
  const kitFromHash = () => /^#report-(\d+)$/.exec(location.hash)?.[1] ?? null;

  let current: { kit: string; flipped: boolean } | null = null;
  let busy = false;

  function show(kit: string) {
    articles.forEach((a) => (a.hidden = a.dataset.reportKit !== kit));
    dialog!.setAttribute('aria-labelledby', `report-h-${kit}`);
    dialog!.removeAttribute('aria-label');
    scroller!.scrollTop = 0;
    countUp(articleFor(kit)!);
  }

  function setHash(kit: string | null, replace = false) {
    const url = kit ? `#report-${kit}` : location.pathname + location.search;
    if (kit && location.hash === `#report-${kit}`) return;
    if (replace || !kit) history.replaceState(null, '', url);
    else history.pushState(null, '', url);
  }

  function flatten(card: HTMLElement) {
    gsap.set(card, { rotationX: 0, rotationY: 0, y: 0 });
    card.classList.remove('is-active');
    card.closest('[data-pitch]')?.classList.remove('is-scouting');
  }

  /** Panel transform that makes it sit exactly over the card. */
  function cardTransform(card: HTMLElement) {
    const c = card.getBoundingClientRect();
    gsap.set(panel, { clearProps: 'transform' });
    const p = panel!.getBoundingClientRect();
    return { x: c.left - p.left, y: c.top - p.top, scaleX: c.width / p.width, scaleY: c.height / p.height };
  }

  function open(kit: string, opts: { flip: boolean; animate: boolean }) {
    if (busy || !articleFor(kit)) return;
    const card = cardFor(kit);
    busy = true;
    stopScroll();
    setHash(kit);

    const reveal = () => {
      dialog!.showModal();
      show(kit);
      current = { kit, flipped: opts.flip };
      const article = articleFor(kit)!;
      if (!opts.animate || !card) {
        gsap.fromTo(panel, { autoAlpha: 0 }, { autoAlpha: 1, duration: reducedMotion ? 0.2 : 0.3, onComplete: () => { busy = false; } });
        return;
      }
      // Shared-element expand from the card into the full report.
      gsap.timeline({ onComplete: () => { busy = false; } })
        .set(panel, { autoAlpha: 1, transformOrigin: '0 0', ...cardTransform(card) })
        .set(curtain, { opacity: 1 })
        .set(article, { autoAlpha: 0 })
        .to(panel, { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.7, ease: 'expo.out' })
        .to(curtain, { opacity: 0, duration: 0.35 }, 0.3)
        .to(article, { autoAlpha: 1, duration: 0.3 }, 0.42)
        .set(panel, { clearProps: 'transform' });
    };

    if (opts.flip && card && opts.animate) {
      flatten(card);
      gsap.to(card.querySelector('[data-card-inner]'), { rotationY: 180, duration: 0.5, ease: 'power2.inOut', onComplete: reveal });
    } else {
      reveal();
    }
  }

  function close(opts: { fromHistory?: boolean } = {}) {
    if (!dialog!.open || busy || !current) return;
    busy = true;
    const { kit, flipped } = current;
    const card = cardFor(kit);
    const inner = card?.querySelector<HTMLElement>('[data-card-inner]');

    const done = () => {
      dialog!.close();
      gsap.set([panel, curtain], { clearProps: 'all' });
      articles.forEach((a) => gsap.set(a, { clearProps: 'all' }));
      if (inner && flipped) gsap.to(inner, { rotationY: 0, duration: 0.5, ease: 'power2.inOut' });
      if (!opts.fromHistory) setHash(null);
      startScroll();
      current = null;
      busy = false;
      card?.focus({ preventScroll: true });
    };

    // Shrink back onto the card if it's on screen; otherwise just fade.
    const onScreen = card && (() => { const r = card.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; })();
    if (reducedMotion || !card || !onScreen) {
      gsap.to(panel, { autoAlpha: 0, duration: 0.2, onComplete: done });
      return;
    }
    const article = articleFor(kit)!;
    gsap.timeline({ onComplete: done })
      .to(article, { autoAlpha: 0, duration: 0.15 })
      .to(curtain, { opacity: flipped ? 1 : 0, duration: 0.2 }, 0.05)
      .set(panel, { transformOrigin: '0 0' })
      .to(panel, { ...cardTransform(card), duration: 0.5, ease: 'expo.inOut' }, 0.1)
      .to(panel, { autoAlpha: 0, duration: 0.1 });
  }

  function go(kit: string) {
    if (!current || busy || kit === current.kit) return;
    const from = articleFor(current.kit)!;
    const to = articleFor(kit)!;
    const prevCard = cardFor(current.kit)?.querySelector<HTMLElement>('[data-card-inner]');
    if (prevCard && current.flipped) gsap.set(prevCard, { rotationY: 0 });
    current = { kit, flipped: false };
    setHash(kit, true);
    if (reducedMotion) { show(kit); return; }
    busy = true;
    gsap.timeline({ onComplete: () => { busy = false; } })
      .to(from, { autoAlpha: 0, x: -24, duration: 0.2, ease: 'power2.in' })
      .call(() => { gsap.set(from, { clearProps: 'all' }); show(kit); })
      .fromTo(to, { autoAlpha: 0, x: 24 }, { autoAlpha: 1, x: 0, duration: 0.35, ease: 'expo.out', clearProps: 'transform' });
    (dialog!.querySelector('[data-report-close]') as HTMLElement).focus();
  }

  // ---- Wiring --------------------------------------------------------------
  let lastPointer = '';
  cards.forEach((card) => {
    card.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType; });
    card.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      const kit = card.dataset.kit!;
      // Touch: first tap tilts the card once, second tap opens the report.
      if (lastPointer === 'touch' && !reducedMotion && card.dataset.armed !== '1') {
        card.dataset.armed = '1';
        cards.forEach((c) => c !== card && delete c.dataset.armed);
        gsap.fromTo(card, { rotationY: 0, transformPerspective: 900 }, { keyframes: { rotationY: [-12, 8, 0] }, duration: 0.6, ease: 'power2.out' });
        return;
      }
      delete card.dataset.armed;
      // Keyboard (detail 0) opens directly with no flip.
      const keyboard = e.detail === 0;
      open(kit, { flip: !keyboard, animate: !reducedMotion && !keyboard });
      lastPointer = '';
    });
  });

  dialog.querySelectorAll('[data-report-close]').forEach((b) => b.addEventListener('click', () => close()));
  dialog.querySelectorAll<HTMLButtonElement>('[data-report-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.reportGo!)));
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });

  window.addEventListener('popstate', () => {
    const kit = kitFromHash();
    if (kit && !dialog.open) open(kit, { flip: false, animate: false });
    else if (kit && current && kit !== current.kit) go(kit);
    else if (!kit && dialog.open) close({ fromHistory: true });
  });

  const initial = kitFromHash();
  if (initial) open(initial, { flip: false, animate: false });
}

/** Stats count up over 900ms. Each number in the string animates; the final text is always the original. */
function countUp(root: HTMLElement) {
  if (reducedMotion) return;
  root.querySelectorAll<HTMLElement>('[data-countup]').forEach((dd) => {
    const original = (dd.dataset.final ??= dd.textContent ?? '');
    const parts = original.split(/(\d[\d,]*(?:\.\d+)?)/);
    const nums = parts.map((p, i) => {
      if (i % 2 === 0) return null;
      return { val: parseFloat(p.replace(/,/g, '')), dec: (p.split('.')[1] ?? '').length, comma: p.includes(',') };
    });
    const fmt = (n: { val: number; dec: number; comma: boolean }, t: number) =>
      (n.val * t).toLocaleString('en-US', { minimumFractionDigits: n.dec, maximumFractionDigits: n.dec, useGrouping: n.comma });
    const state = { t: 0 };
    gsap.killTweensOf(dd);
    gsap.to(state, {
      t: 1,
      duration: 0.9,
      ease: 'power2.out',
      onUpdate: () => { dd.textContent = parts.map((p, i) => (nums[i] ? fmt(nums[i]!, state.t) : p)).join(''); },
      onComplete: () => { dd.textContent = original; },
    });
  });
}
