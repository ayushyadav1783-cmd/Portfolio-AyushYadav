// Broadcast bar (spec §4.2): scroll-driven match clock, zone lower-thirds, hide/show, stadium map.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { reducedMotion } from './env';
import { scrollToEl, startScroll, stopScroll } from './scroll';

gsap.registerPlugin(ScrollTrigger);

type Zone = { el: HTMLElement; time: string; label: string; top: number };

export function initBroadcast() {
  const bar = document.querySelector<HTMLElement>('[data-bar]');
  const clock = document.querySelector<HTMLElement>('[data-clock]');
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  if (!bar || !clock || !hero) return;

  const zones: Zone[] = [...document.querySelectorAll<HTMLElement>('[data-zone]')].map((el) => ({
    el,
    time: el.querySelector('.bug__time')?.textContent?.trim() ?? '',
    label: el.querySelector('.bug__label')?.textContent?.trim() ?? '',
    top: 0,
  }));
  const fan = zones.find((z) => z.el.hasAttribute('data-halftime'));
  const full = zones.find((z) => z.el.hasAttribute('data-fulltime'));

  // ---- Match clock -------------------------------------------------------
  // First half 0'→45' runs from kickoff to the Fan Zone, passing each zone's own minute
  // (Warm-Up 15', Starting VII 30', Power-ups 40'). Fan Zone is HT. Full Time runs 46'→90', then 90'+.
  let marks: { y: number; min: number }[] = [];
  let maxY = 1;
  const markerOffset = () => window.innerHeight * 0.4;

  function measure() {
    zones.forEach((z) => (z.top = z.el.getBoundingClientRect().top + window.scrollY));
    maxY = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const firstHalf = zones
      .filter((z) => z !== fan && z !== full)
      .map((z) => ({ y: z.top, min: parseInt(z.time, 10) }))
      .filter((m) => !Number.isNaN(m.y) && !Number.isNaN(m.min));
    marks = [{ y: markerOffset(), min: 0 }, ...firstHalf]; // 0' exactly at kickoff
    if (fan) marks.push({ y: fan.top, min: 45 });
  }

  function minuteAt(y: number): string {
    const p = y + markerOffset();
    if (y >= maxY - 2) return "90'+";
    if (full && p >= full.top) {
      const t = (p - full.top) / Math.max(1, maxY + markerOffset() - full.top);
      return `${Math.min(90, 46 + Math.floor(t * 44))}'`;
    }
    if (fan && p >= fan.top) return 'HT';
    for (let i = marks.length - 1; i >= 0; i--) {
      if (p >= marks[i].y) {
        const next = marks[i + 1];
        if (!next) return `${marks[i].min}'`;
        const t = (p - marks[i].y) / Math.max(1, next.y - marks[i].y);
        return `${Math.floor(marks[i].min + t * (next.min - marks[i].min))}'`;
      }
    }
    return "0'";
  }

  // ---- Lower-third bugs --------------------------------------------------
  const lt = document.querySelector<HTMLElement>('[data-lt]');
  const ltTime = document.querySelector<HTMLElement>('[data-lt-time]');
  const ltLabel = document.querySelector<HTMLElement>('[data-lt-label]');
  let ltTl: gsap.core.Timeline | null = null;
  let bugActive = false;
  let currentZone: Zone | null = null;

  function zoneAt(y: number): Zone | null {
    const p = y + markerOffset();
    let z: Zone | null = null;
    for (const zone of zones) if (p >= zone.top) z = zone;
    return z;
  }

  function playBug(z: Zone) {
    if (!lt || !ltTime || !ltLabel) return;
    ltTl?.kill();
    ltTime.textContent = z.time;
    ltLabel.textContent = z.label;
    bugActive = true;
    showBar();

    if (reducedMotion) {
      ltTl = gsap.timeline({ onComplete: () => { bugActive = false; } })
        .set(lt, { autoAlpha: 0, x: 0, y: 0, scale: 1 })
        .to(lt, { autoAlpha: 1, duration: 0.3 })
        .to(lt, { autoAlpha: 0, duration: 0.3 }, '+=1.6');
      return;
    }

    const from = lt.getBoundingClientRect();
    const to = clock!.getBoundingClientRect();
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    ltTl = gsap.timeline({ onComplete: () => { bugActive = false; } })
      .set(lt, { autoAlpha: 1, x: 0, y: 0, scale: 1, transformOrigin: '50% 50%', clipPath: 'inset(0 100% 0 0)' })
      .to(lt, { clipPath: 'inset(0 0% 0 0)', duration: 0.45, ease: 'expo.out' })
      // Collapse into the clock after 1.6s on screen.
      .to(lt, { x: dx, y: dy, scale: 0.18, autoAlpha: 0, duration: 0.45, ease: 'power3.in' }, '+=1.6')
      .fromTo(clock, { scale: 1 }, { scale: 1.35, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out' }, '-=0.08');
  }

  // ---- Bar hide/show -----------------------------------------------------
  let hidden = false;
  const showBar = () => {
    if (!hidden) return;
    hidden = false;
    gsap.to(bar, { yPercent: 0, duration: reducedMotion ? 0 : 0.35, ease: 'expo.out' });
  };
  const hideBar = () => {
    if (hidden || bugActive || reducedMotion || bar.contains(document.activeElement)) return;
    hidden = true;
    gsap.to(bar, { yPercent: -100, duration: 0.35, ease: 'power2.in' });
  };
  bar.addEventListener('focusin', showBar);

  // ---- Wire to scroll ----------------------------------------------------
  const navLinks = [...bar.querySelectorAll<HTMLAnchorElement>('.bar__nav a')];
  let lastText = '';

  function update(self?: ScrollTrigger) {
    const y = window.scrollY;
    const text = minuteAt(y);
    if (text !== lastText) {
      clock!.textContent = text; // digits tick, never tween
      lastText = text;
    }
    const z = zoneAt(y);
    if (z !== currentZone) {
      currentZone = z;
      if (z) playBug(z);
      navLinks.forEach((a) => a.setAttribute('aria-current', String(z !== null && a.hash === `#${z.el.id}`)));
    }
    if (self) {
      const pastHero = y > hero!.offsetTop + hero!.offsetHeight - bar!.offsetHeight;
      if (self.direction === 1 && pastHero) hideBar();
      else if (self.direction === -1 || !pastHero) showBar();
    }
  }

  ScrollTrigger.addEventListener('refresh', () => { measure(); update(); });
  measure();
  // Don't fire a bug for the zone the page loads into; only for zones entered by scrolling.
  currentZone = zoneAt(window.scrollY);
  update();
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => update(self) });

  initStadiumMap();
}

function initStadiumMap() {
  const dialog = document.querySelector<HTMLDialogElement>('[data-map]');
  const open = document.querySelector<HTMLButtonElement>('[data-map-open]');
  const close = document.querySelector<HTMLButtonElement>('[data-map-close]');
  if (!dialog || !open || !close) return;

  open.setAttribute('aria-expanded', 'false');
  open.addEventListener('click', () => {
    dialog.showModal();
    open.setAttribute('aria-expanded', 'true');
    stopScroll();
    if (!reducedMotion) {
      gsap.from(dialog.querySelectorAll('.map__link'), { yPercent: 60, autoAlpha: 0, duration: 0.5, stagger: 0.05, ease: 'expo.out' });
    }
  });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    open.setAttribute('aria-expanded', 'false');
    startScroll();
  });
  dialog.addEventListener('click', (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    dialog.close();
    const target = document.getElementById(a.hash.slice(1));
    if (target) {
      scrollToEl(target);
      history.pushState(null, '', a.hash);
    }
  });
}
