// Full Time interactive (replaces the chat on Ayush's request): penalty shootout → transfer bid.
import { gsap } from 'gsap';
import { reducedMotion } from './env';

const GOLD = '#f5c542';
const RED = '#ff4a3d';
const LIGHT = '#f6f3ec';
const ZONES = ['tl', 'tc', 'tr', 'bl', 'bc', 'br'] as const;
type Zone = (typeof ZONES)[number];

export function initShootout() {
  const root = document.querySelector<HTMLElement>('[data-shoot]');
  if (!root) return;
  const game = root.querySelector<HTMLElement>('[data-shoot-game]')!;
  const bid = root.querySelector<HTMLElement>('[data-bid]')!;

  // With JS the penalty comes first; without it only the bid form shows.
  game.hidden = false;
  bid.hidden = true;
  root.querySelectorAll<HTMLElement>('[data-to-game]').forEach((b) => (b.hidden = false));

  const show = (which: 'game' | 'bid') => {
    const from = which === 'bid' ? game : bid;
    const to = which === 'bid' ? bid : game;
    const focusTarget = which === 'bid'
      ? to.querySelector<HTMLElement>('[data-bid-club]')
      : to.querySelector<HTMLElement>('.pen__zone');
    const swap = () => {
      from.hidden = true;
      to.hidden = false;
      focusTarget?.focus({ preventScroll: true });
      if (!reducedMotion) gsap.fromTo(to, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: 'expo.out' });
    };
    if (reducedMotion) swap();
    else gsap.to(from, { autoAlpha: 0, y: -16, duration: 0.25, ease: 'power2.in', onComplete: () => { gsap.set(from, { clearProps: 'all' }); swap(); } });
  };
  root.querySelectorAll('[data-to-bid]').forEach((b) => b.addEventListener('click', () => show('bid')));
  root.querySelectorAll('[data-to-game]').forEach((b) => b.addEventListener('click', () => show('game')));

  penalty(root);
  transferBid(root);
}

// ---------------------------------------------------------------------------
// Penalty
// ---------------------------------------------------------------------------

function penalty(root: HTMLElement) {
  const q = <T extends Element = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const pen = q('[data-pen]');
  const goal = q('[data-goal]');
  const net = q('[data-net]');
  const ripple = q('[data-net-ripple]');
  const keeper = q('[data-keeper]');
  const ball = q('[data-ball]');
  const shout = q('[data-shout]');
  const result = q('[data-result]');
  const line = q('[data-result-line]');
  const youEl = q('[data-score-you]');
  const meEl = q('[data-score-me]');
  // Copy comes from copy.json via a template's data attributes.
  const texts = readTexts(root);
  let you = 0;
  let me = 0;
  let busy = false;

  if (!reducedMotion) {
    gsap.to(keeper, { x: 6, duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut' }); // idle sway
  }

  const centreOf = (z: Zone) => {
    const g = goal.getBoundingClientRect();
    const col = z[1] === 'l' ? 0 : z[1] === 'c' ? 1 : 2;
    const row = z[0] === 't' ? 0 : 1;
    return { x: g.width * ((col * 2 + 1) / 6), y: g.height * ((row * 2 + 1) / 4), g };
  };

  root.querySelectorAll<HTMLButtonElement>('.pen__zone').forEach((btn) => {
    btn.addEventListener('click', () => shoot(btn.dataset.zoneId as Zone));
  });
  q('[data-again]').addEventListener('click', reset);

  function shoot(zone: Zone) {
    if (busy) return;
    busy = true;
    pen.classList.add('is-locked');
    // The keeper reads one shot in three.
    const dive: Zone = Math.random() < 0.3 ? zone : pick(ZONES.filter((z) => z !== zone));
    const saved = dive === zone;
    const target = centreOf(zone);
    const p = pen.getBoundingClientRect();
    const b = ball.getBoundingClientRect();
    const tx = target.g.left - p.left + target.x - (b.left - p.left + b.width / 2);
    const ty = target.g.top - p.top + target.y - (b.top - p.top + b.height / 2);
    const keeperTo = keeperPose(dive, centreOf(dive).x - target.g.width / 2);

    const finish = () => {
      if (saved) { me++; meEl.textContent = String(me); } else { you++; youEl.textContent = String(you); }
      line.textContent = saved ? texts.savedLine : texts.goalLine;
      result.hidden = false;
      if (!reducedMotion) gsap.from(result, { autoAlpha: 0, y: 12, duration: 0.4, ease: 'expo.out' });
      busy = false;
    };

    if (reducedMotion) {
      gsap.set(ball, { x: tx, y: ty, scale: 0.55 });
      gsap.set(keeper, keeperTo);
      shout.textContent = saved ? texts.saved : texts.goal;
      gsap.set(shout, { opacity: 1 });
      finish();
      return;
    }

    gsap.killTweensOf(keeper);
    const tl = gsap.timeline({ onComplete: finish });
    tl.to(ball, { x: tx, y: ty, scale: 0.55, rotation: 540, duration: 0.5, ease: 'power2.in' }, 0)
      .to(keeper, { ...keeperTo, duration: 0.42, ease: 'power3.out' }, 0.08);

    if (saved) {
      // Glove flash, ball punched away.
      tl.to(keeper.querySelectorAll('.keeper__arm i'), { scale: 1.7, backgroundColor: '#ffffff', boxShadow: '0 0 24px 8px rgba(255,255,255,.8)', duration: 0.1, yoyo: true, repeat: 1 }, 0.48)
        .to(ball, { x: tx + (tx > 0 ? 160 : -160), y: ty + 170, rotation: '+=360', scale: 0.8, duration: 0.6, ease: 'power2.out' }, 0.52)
        .call(() => { shout.textContent = texts.saved; shout.style.color = LIGHT; }, [], 0.5);
    } else {
      // Net ripple + bulge from the impact point, confetti, shake.
      const nx = `${(target.x / target.g.width) * 100}%`;
      const ny = `${(target.y / target.g.height) * 100}%`;
      goal.style.setProperty('--nx', nx);
      goal.style.setProperty('--ny', ny);
      tl.fromTo(net, { scale: 1 }, { scale: 1.08, duration: 0.12, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 0.5)
        .fromTo(ripple, { scale: 1, opacity: 0.9 }, { scale: 22, opacity: 0, duration: 0.8, ease: 'power2.out' }, 0.5)
        .call(() => { shout.textContent = texts.goal; shout.style.color = GOLD; confetti(pen); }, [], 0.5)
        .to(pen, { keyframes: { x: [-4, 4, -3, 3, 0] }, duration: 0.25 }, 0.5);
    }
    tl.fromTo(shout, { opacity: 0, scale: 2.4 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2.4)' }, 0.52);
  }

  function reset() {
    if (busy) return;
    result.hidden = true;
    pen.classList.remove('is-locked');
    gsap.set(shout, { opacity: 0 });
    gsap.to(ball, { x: 0, y: 0, scale: 1, rotation: 0, duration: reducedMotion ? 0 : 0.4, ease: 'expo.out' });
    gsap.to(keeper, { x: 0, y: 0, rotation: 0, duration: reducedMotion ? 0 : 0.4, ease: 'expo.out', onComplete: () => {
      if (!reducedMotion) gsap.to(keeper, { x: 6, duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    } });
    root.querySelector<HTMLElement>('.pen__zone')?.focus({ preventScroll: true });
  }
}

function keeperPose(z: Zone, dx: number) {
  const side = z[1] === 'l' ? -1 : z[1] === 'r' ? 1 : 0;
  const high = z[0] === 't';
  return { x: dx * 0.8, y: high ? -42 : side ? -6 : 0, rotation: side * (high ? 62 : 82) };
}

function confetti(host: HTMLElement) {
  const cols = [GOLD, RED, LIGHT];
  const w = host.clientWidth;
  for (let i = 0; i < 40; i++) {
    const c = document.createElement('span');
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = `position:absolute;left:${Math.random() * w}px;top:-10px;width:${6 + Math.random() * 6}px;height:${3 + Math.random() * 4}px;background:${cols[i % 3]};z-index:5;pointer-events:none`;
    host.appendChild(c);
    gsap.to(c, {
      y: host.clientHeight + 20, x: `+=${gsap.utils.random(-60, 60)}`, rotation: gsap.utils.random(-540, 540),
      duration: gsap.utils.random(0.9, 1.6), ease: 'power1.in', onComplete: () => c.remove(),
    });
  }
}

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

function readTexts(root: HTMLElement) {
  const t = root.querySelector<HTMLTemplateElement>('template[data-shoot-copy]');
  const d = t?.dataset ?? {};
  return {
    goal: d.goal ?? 'Goal!',
    saved: d.saved ?? 'Saved!',
    goalLine: d.goalLine ?? '',
    savedLine: d.savedLine ?? '',
  };
}

// ---------------------------------------------------------------------------
// Transfer bid
// ---------------------------------------------------------------------------

function transferBid(root: HTMLElement) {
  const form = root.querySelector<HTMLFormElement>('[data-bid-form]');
  const doc = root.querySelector<HTMLElement>('[data-doc]');
  const stamp = root.querySelector<HTMLElement>('[data-stamp]');
  const status = root.querySelector<HTMLElement>('[data-bid-status]');
  const t = root.querySelector<HTMLTemplateElement>('template[data-bid-copy]');
  if (!form || !doc || !stamp || !status || !t) return;
  const { subject = 'Transfer bid', sign = '', blank = '________' } = t.dataset;
  const statusText = t.dataset.status ?? '';

  const field = (name: string) => doc.querySelector<HTMLElement>(`[data-doc-field="${name}"]`);
  const value = (name: string) => {
    const el = form.elements.namedItem(name) as RadioNodeList | HTMLInputElement | HTMLTextAreaElement | null;
    return (el && 'value' in el ? el.value : '').trim();
  };

  // The contract fills in live, with a gold flash on each change.
  form.addEventListener('input', (e) => {
    const name = (e.target as HTMLInputElement).name;
    const dd = field(name);
    if (!dd) return;
    dd.textContent = value(name) || blank;
    if (!reducedMotion) gsap.fromTo(dd, { backgroundColor: 'rgba(245,197,66,.55)' }, { backgroundColor: 'rgba(245,197,66,0)', duration: 0.6, clearProps: 'backgroundColor' });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const club = value('club');
    const note = value('note');
    const body = [
      'Transfer bid for Ayush Yadav (No. 7)',
      '',
      `Club: ${club}`,
      `Position: ${value('position')}`,
      `Contract: ${value('contract')}`,
      `Kickoff: ${value('kickoff')}`,
      ...(note ? ['', note] : []),
      '',
      sign,
    ].join('\n');
    const url = `mailto:${form.dataset.email}?subject=${encodeURIComponent(`${subject} · ${club}`)}&body=${encodeURIComponent(body)}`;
    status.textContent = statusText;

    if (reducedMotion) {
      gsap.set(stamp, { opacity: 1 });
      window.location.href = url;
      return;
    }
    gsap.timeline({ onComplete: () => { window.location.href = url; } })
      .fromTo(stamp, { opacity: 0, scale: 2.2, rotation: -4 }, { opacity: 1, scale: 1, rotation: -12, duration: 0.4, ease: 'back.out(2.2)' })
      .to(doc, { keyframes: { x: [-5, 5, -3, 3, 0] }, duration: 0.25 }, '-=0.12')
      .call(() => sparks(stamp), [], '<')
      .to({}, { duration: 0.5 });
  });
}

function sparks(from: HTMLElement) {
  const r = from.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  for (let i = 0; i < 14; i++) {
    const p = document.createElement('span');
    p.setAttribute('aria-hidden', 'true');
    p.style.cssText = `position:fixed;left:${cx - 3}px;top:${cy - 3}px;width:6px;height:6px;border-radius:999px;background:${i % 2 ? GOLD : RED};pointer-events:none;z-index:95`;
    document.body.appendChild(p);
    const a = (i / 14) * Math.PI * 2;
    gsap.to(p, { x: Math.cos(a) * 80, y: Math.sin(a) * 60, autoAlpha: 0, duration: 0.55, ease: 'power2.out', onComplete: () => p.remove() });
  }
}
