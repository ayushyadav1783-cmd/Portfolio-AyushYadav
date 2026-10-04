// Fan Zone signature tricks (Ayush's request, 2026-10-04): every sticker click sets off its own
// full-screen moment. Original shapes and words only, no characters or logos.
// Each trick works with matter-js bodies (desktop) or plain DOM tweens (touch).
import { gsap } from 'gsap';
import { reducedMotion } from './env';
import type { Physics } from './fanzone';

export type Stage = { section: HTMLElement; stickers: HTMLButtonElement[]; physics: Physics | null };

const GOLD = '#f5c542';
const RED = '#ff4a3d';
const LIGHT = '#f6f3ec';
const NIGHT = '#08080b';

let busy = false;
let live: HTMLElement | null = null;

export function runTrick(sticker: HTMLButtonElement, stage: Stage) {
  if (busy) return;
  const shoutText = sticker.dataset.shout ?? '';
  announce(shoutText);
  if (reducedMotion) {
    // Reduced motion: the shout fades in and out; nothing moves.
    const s = shout(shoutText, GOLD);
    gsap.timeline({ onComplete: () => s.remove() }).fromTo(s, { opacity: 0 }, { opacity: 1, duration: 0.3 }).to(s, { opacity: 0, duration: 0.4, delay: 0.8 });
    return;
  }
  busy = true;
  const done = () => { busy = false; };
  const trick = TRICKS[sticker.dataset.trick ?? ''] ?? TRICKS.siuuu;
  trick(sticker, stage, shoutText).eventCallback('onComplete', done);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function announce(text: string) {
  if (!live) {
    live = document.createElement('p');
    live.className = 'sr-only';
    live.setAttribute('aria-live', 'polite');
    document.body.appendChild(live);
  }
  live.textContent = text;
}

function layer(z = 85) {
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = `position:fixed;inset:0;z-index:${z};pointer-events:none;overflow:hidden`;
  document.body.appendChild(el);
  return el;
}

function shout(text: string, color: string, shadow = RED) {
  const el = document.createElement('p');
  el.setAttribute('aria-hidden', 'true');
  el.textContent = text;
  el.style.cssText = `position:fixed;left:0;right:0;top:50%;margin:0;transform:translateY(-50%);z-index:88;pointer-events:none;text-align:center;
    font-family:var(--font-display);text-transform:uppercase;font-weight:900;font-size:clamp(64px,13vw,200px);line-height:.85;
    color:${color};text-shadow:6px 6px 0 ${shadow};white-space:nowrap`;
  document.body.appendChild(el);
  return el;
}

/** Big text slams in and leaves. Returns a timeline. */
function slam(text: string, color = GOLD, shadow = RED, hold = 0.7) {
  const el = shout(text, color, shadow);
  return gsap.timeline({ onComplete: () => el.remove() })
    .fromTo(el, { opacity: 0, scale: 2.2 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2.2)' })
    .to(el, { opacity: 0, scale: 0.9, duration: 0.3 }, `+=${hold}`);
}

const centre = (el: Element) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

function shake(px = 6) {
  return gsap.to('main', { keyframes: { x: [-px, px, -px * 0.7, px * 0.7, -px * 0.3, 0] }, duration: 0.35, ease: 'none', clearProps: 'transform' });
}

/** Push every other sticker away from (or towards) a point. Physics: velocity; touch: DOM tween. */
function knock(stage: Stage, from: { x: number; y: number }, power: number, except?: HTMLElement, towards = false) {
  const dir = towards ? -1 : 1;
  stage.stickers.forEach((s, i) => {
    if (s === except) return;
    const c = centre(s);
    const dx = c.x - from.x;
    const dy = c.y - from.y;
    const d = Math.hypot(dx, dy) || 1;
    if (stage.physics) {
      const { Matter, bodies } = stage.physics;
      Matter.Body.setVelocity(bodies[i], { x: (dx / d) * power * dir, y: (dy / d) * power * dir - (towards ? 0 : power * 0.6) });
      Matter.Body.setAngularVelocity(bodies[i], (Math.random() - 0.5) * 0.4);
    } else {
      gsap.timeline()
        .to(s, { x: (dx / d) * power * 9 * dir, y: (dy / d) * power * 9 * dir, rotation: (Math.random() - 0.5) * 40, duration: 0.3, ease: 'power3.out' })
        .to(s, { x: 0, y: 0, rotation: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)', clearProps: 'x,y,rotation' });
    }
  });
}

/** Launch a sticker up (physics) or hop it (DOM). */
function launch(stage: Stage, s: HTMLButtonElement, vy: number, spin: number) {
  const i = stage.stickers.indexOf(s);
  if (stage.physics) {
    const { Matter, bodies } = stage.physics;
    Matter.Body.setVelocity(bodies[i], { x: (Math.random() - 0.5) * 4, y: -vy });
    Matter.Body.setAngularVelocity(bodies[i], spin);
    return gsap.timeline().to({}, { duration: 0.7 });
  }
  return gsap.timeline()
    .to(s, { y: -vy * 9, rotation: spin * 1200, duration: 0.4, ease: 'power2.out' })
    .to(s, { y: 0, rotation: spin * 1440, duration: 0.35, ease: 'bounce.out', clearProps: 'y,rotation' });
}

function confetti(n = 60, colours = [GOLD, LIGHT, RED]) {
  const l = layer(86);
  const tl = gsap.timeline({ onComplete: () => l.remove() });
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    c.style.cssText = `position:absolute;left:${Math.random() * 100}%;top:-20px;width:${6 + Math.random() * 8}px;height:${4 + Math.random() * 5}px;background:${colours[i % colours.length]}`;
    l.appendChild(c);
    tl.to(c, { y: innerHeight + 40, x: gsap.utils.random(-80, 80), rotation: gsap.utils.random(-720, 720), duration: gsap.utils.random(1, 1.8), ease: 'power1.in' }, Math.random() * 0.3);
  }
  return tl;
}

function ball(size = 44) {
  const b = document.createElement('span');
  b.style.cssText = `position:fixed;left:0;top:0;width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;border-radius:999px;background:${LIGHT};
    box-shadow:inset -9px -7px 0 rgba(8,8,11,.25);display:flex;align-items:center;justify-content:center;z-index:87;pointer-events:none`;
  b.innerHTML = `<i style="width:${size * 0.34}px;height:${size * 0.34}px;background:${NIGHT};clip-path:polygon(50% 0,100% 38%,82% 100%,18% 100%,0 38%)"></i>`;
  b.setAttribute('aria-hidden', 'true');
  document.body.appendChild(b);
  return b;
}

// ---------------------------------------------------------------------------
// The eight tricks
// ---------------------------------------------------------------------------

type Trick = (s: HTMLButtonElement, stage: Stage, text: string) => gsap.core.Timeline;

const TRICKS: Record<string, Trick> = {
  /** Hala Madrid: a white-and-gold card-stunt wave sweeps the stadium, stickers ride it. */
  wave(_s, stage, text) {
    const l = layer();
    const n = Math.ceil(innerWidth / 44);
    const bars: HTMLElement[] = [];
    for (let i = 0; i < n; i++) {
      const b = document.createElement('i');
      b.style.cssText = `position:absolute;bottom:0;left:${(i / n) * 100}%;width:${100 / n + 0.2}%;height:55%;background:${i % 2 ? GOLD : LIGHT};transform-origin:50% 100%;transform:scaleY(0)`;
      l.appendChild(b);
      bars.push(b);
    }
    const order = [...stage.stickers].sort((a, b) => centre(a).x - centre(b).x);
    const tl = gsap.timeline({ onComplete: () => l.remove() });
    tl.to(bars, { scaleY: 1, duration: 0.35, ease: 'power2.out', stagger: { each: 0.025, from: 'start' } }, 0)
      .to(bars, { scaleY: 0, duration: 0.35, ease: 'power2.in', stagger: { each: 0.025, from: 'start' } }, 0.35);
    order.forEach((st, i) => tl.add(launch(stage, st, 9, 0.05), 0.1 + (i / order.length) * 0.6));
    tl.add(slam(text, LIGHT, GOLD, 0.6), 0.15);
    return tl;
  },

  /** CR7: the sticker spins up, lands with a SIUUU shockwave that blows everything back. */
  siuuu(s, stage, text) {
    const tl = gsap.timeline();
    tl.add(launch(stage, s, 22, 0.5), 0);
    tl.call(() => {
      const c = centre(s);
      const l = layer();
      for (let i = 0; i < 3; i++) {
        const r = document.createElement('i');
        r.style.cssText = `position:absolute;left:${c.x}px;top:${c.y}px;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:999px;border:${6 - i * 2}px solid ${i === 1 ? RED : GOLD}`;
        l.appendChild(r);
        gsap.fromTo(r, { scale: 0.2, opacity: 1 }, { scale: 60, opacity: 0, duration: 1.1, delay: i * 0.12, ease: 'power2.out' });
      }
      gsap.delayedCall(1.5, () => l.remove());
      knock(stage, c, 18, s);
      shake(8);
    }, [], 0.75);
    tl.add(slam(text), 0.78);
    return tl;
  },

  /** Nakama: the sticker stretches like rubber, snaps back, and pulls the crew in around it. */
  stretch(s, stage, text) {
    const dir = centre(s).x > innerWidth / 2 ? -1 : 1;
    const tl = gsap.timeline();
    tl.to(s, { scaleX: 3.2, scaleY: 0.7, x: dir * 160, transformOrigin: dir > 0 ? '0% 50%' : '100% 50%', duration: 0.35, ease: 'power2.out' })
      .to(s, { scaleX: 1, scaleY: 1, x: 0, duration: 0.9, ease: 'elastic.out(1.2, 0.3)', clearProps: 'transform' })
      .call(() => knock(stage, centre(s), 9, s, true), [], 0.45)
      .add(slam(text, GOLD, NIGHT), 0.3);
    return tl;
  },

  /** Believe it: shadow clones burst out across the screen, then vanish in puffs of smoke. */
  clones(s, _stage, text) {
    const l = layer();
    const r = s.getBoundingClientRect();
    const tl = gsap.timeline({ onComplete: () => l.remove() });
    const puff = (x: number, y: number, at: number) => {
      for (let k = 0; k < 5; k++) {
        const p = document.createElement('i');
        p.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:999px;background:rgba(246,243,236,.85)`;
        l.appendChild(p);
        tl.fromTo(p, { scale: 0.2, opacity: 0.95 }, { scale: 2.4, opacity: 0, x: gsap.utils.random(-50, 50), y: gsap.utils.random(-50, 50), duration: 0.6, ease: 'power2.out' }, at);
      }
    };
    const n = innerWidth < 700 ? 6 : 10;
    for (let i = 0; i < n; i++) {
      const c = s.cloneNode(true) as HTMLElement;
      c.removeAttribute('data-sticker');
      c.tabIndex = -1;
      const x = gsap.utils.random(r.width / 2, innerWidth - r.width / 2);
      const y = gsap.utils.random(r.height / 2 + 60, innerHeight - r.height / 2);
      c.style.cssText += `;position:absolute;left:${x - r.width / 2}px;top:${y - r.height / 2}px;width:${r.width}px;margin:0`;
      l.appendChild(c);
      const at = i * 0.05;
      puff(x, y, at);
      tl.fromTo(c, { opacity: 0, scale: 0.4, rotation: gsap.utils.random(-25, 25) }, { opacity: 1, scale: 1, duration: 0.25, ease: 'back.out(3)' }, at + 0.05)
        .to(c, { opacity: 0, scale: 1.3, duration: 0.2 }, 1.2 + i * 0.03);
      puff(x, y, 1.2 + i * 0.03);
    }
    tl.add(slam(text, LIGHT, RED, 0.5), 0.2);
    return tl;
  },

  /** Friendly neighbourhood: web lines shoot to the edges, a web spins up between them, thwip. */
  web(s, stage, text) {
    const c = centre(s);
    const l = layer();
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', String(innerWidth));
    svg.setAttribute('height', String(innerHeight));
    svg.style.cssText = 'position:absolute;inset:0';
    l.appendChild(svg);
    const spokes = 10;
    const ends = Array.from({ length: spokes }, (_, i) => {
      const a = (i / spokes) * Math.PI * 2;
      const len = Math.hypot(innerWidth, innerHeight);
      return { x: c.x + Math.cos(a) * len, y: c.y + Math.sin(a) * len };
    });
    const tl = gsap.timeline({ onComplete: () => l.remove() });
    ends.forEach((e, i) => {
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', String(c.x)); line.setAttribute('y1', String(c.y));
      line.setAttribute('x2', String(e.x)); line.setAttribute('y2', String(e.y));
      line.setAttribute('stroke', LIGHT); line.setAttribute('stroke-width', '2');
      line.setAttribute('pathLength', '1'); line.setAttribute('stroke-dasharray', '1'); line.setAttribute('stroke-dashoffset', '1');
      svg.appendChild(line);
      tl.to(line, { attr: { 'stroke-dashoffset': 0 }, duration: 0.25, ease: 'power3.out' }, i * 0.02);
    });
    [90, 190, 320, 480].forEach((rad, k) => {
      const pts = ends.map((e) => {
        const a = Math.atan2(e.y - c.y, e.x - c.x);
        return `${c.x + Math.cos(a) * rad},${c.y + Math.sin(a) * rad}`;
      });
      const poly = document.createElementNS(NS, 'polygon');
      poly.setAttribute('points', pts.join(' '));
      poly.setAttribute('fill', 'none'); poly.setAttribute('stroke', LIGHT); poly.setAttribute('stroke-width', '1.5');
      poly.setAttribute('pathLength', '1'); poly.setAttribute('stroke-dasharray', '1'); poly.setAttribute('stroke-dashoffset', '1');
      svg.appendChild(poly);
      tl.to(poly, { attr: { 'stroke-dashoffset': 0 }, duration: 0.3, ease: 'power2.out' }, 0.25 + k * 0.08);
    });
    tl.add(launch(stage, s, 16, -0.2), 0.3)
      .add(slam(text, LIGHT, NIGHT, 0.4), 0.2)
      .to(svg, { opacity: 0, duration: 0.4 }, 1.3);
    return tl;
  },

  /** Genius: a repulsor charges, flashes and blasts every other sticker across the pit. */
  blast(s, stage, text) {
    const c = centre(s);
    const l = layer();
    const core = document.createElement('i');
    core.style.cssText = `position:absolute;left:${c.x}px;top:${c.y}px;width:160px;height:160px;margin:-80px 0 0 -80px;border-radius:999px;
      background:radial-gradient(circle,#fff 0%,rgba(255,251,232,.95) 22%,rgba(245,197,66,.6) 45%,rgba(245,197,66,0) 70%)`;
    const flash = document.createElement('i');
    flash.style.cssText = 'position:absolute;inset:0;background:#fff;opacity:0';
    const ring = document.createElement('i');
    ring.style.cssText = `position:absolute;left:${c.x}px;top:${c.y}px;width:60px;height:60px;margin:-30px 0 0 -30px;border-radius:999px;border:10px solid ${GOLD}`;
    l.append(core, ring, flash);
    const tl = gsap.timeline({ onComplete: () => l.remove() });
    tl.fromTo(core, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'power2.in' })
      .fromTo(core, { scale: 1 }, { scale: 1.15, duration: 0.06, yoyo: true, repeat: 3 })
      .to(flash, { opacity: 0.7, duration: 0.05 })
      .to(flash, { opacity: 0, duration: 0.3 })
      .fromTo(ring, { scale: 0.3, opacity: 1 }, { scale: 40, opacity: 0, duration: 0.8, ease: 'power3.out' }, '<-0.3')
      .to(core, { scale: 3, opacity: 0, duration: 0.5 }, '<')
      .call(() => { knock(stage, c, 26, s); shake(10); }, [], '<')
      .add(slam(text, LIGHT, GOLD, 0.5), '<');
    return tl;
  },

  /** Space nerd: a black hole opens, swallows the stickers, and spits them back out. */
  blackhole(s, stage, text) {
    const c = centre(s);
    const l = layer();
    const hole = document.createElement('i');
    hole.style.cssText = `position:absolute;left:${c.x}px;top:${c.y}px;width:520px;height:520px;margin:-260px 0 0 -260px;border-radius:999px;
      background:radial-gradient(circle,#000 0 28%,rgba(0,0,0,.9) 34%,rgba(245,197,66,.85) 37%,rgba(255,74,61,.5) 44%,rgba(8,8,11,0) 62%)`;
    const disk = document.createElement('i');
    disk.style.cssText = `position:absolute;left:${c.x}px;top:${c.y}px;width:640px;height:640px;margin:-320px 0 0 -320px;border-radius:999px;
      background:conic-gradient(from 0deg,rgba(245,197,66,0),rgba(245,197,66,.55),rgba(255,74,61,.2),rgba(245,197,66,0),rgba(246,243,236,.45),rgba(245,197,66,0));
      -webkit-mask:radial-gradient(circle,transparent 0 30%,#000 34% 52%,transparent 62%);mask:radial-gradient(circle,transparent 0 30%,#000 34% 52%,transparent 62%)`;
    const dim = document.createElement('i');
    dim.style.cssText = 'position:absolute;inset:0;background:rgba(8,8,11,.75)';
    l.append(dim, disk, hole);
    // Star streaks falling in.
    const streaks: HTMLElement[] = [];
    for (let i = 0; i < 40; i++) {
      const st = document.createElement('i');
      const a = Math.random() * Math.PI * 2;
      const d = gsap.utils.random(300, 900);
      st.style.cssText = `position:absolute;left:${c.x + Math.cos(a) * d}px;top:${c.y + Math.sin(a) * d}px;width:${gsap.utils.random(20, 60)}px;height:2px;background:${LIGHT};transform:rotate(${a}rad)`;
      st.dataset.a = String(a);
      st.dataset.d = String(d);
      l.appendChild(st);
      streaks.push(st);
    }
    const others = stage.stickers.filter((x) => x !== s);
    const tl = gsap.timeline({ onComplete: () => l.remove() });
    tl.fromTo([dim], { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0)
      .fromTo([hole, disk], { scale: 0 }, { scale: 1, duration: 0.5, ease: 'expo.out' }, 0)
      .to(disk, { rotation: 540, duration: 2.2, ease: 'none' }, 0);
    streaks.forEach((st, i) => {
      const a = Number(st.dataset.a);
      const d = Number(st.dataset.d);
      tl.to(st, { x: -Math.cos(a) * d, y: -Math.sin(a) * d, opacity: 0, duration: 0.7, ease: 'power3.in' }, 0.1 + (i % 10) * 0.05);
    });
    // Swallow: every other sticker spirals into the hole (inner transforms work in both modes).
    others.forEach((o, i) => {
      const oc = centre(o);
      tl.to(o, { x: c.x - oc.x, y: c.y - oc.y, scale: 0.05, rotation: 540, duration: 0.7, ease: 'power3.in' }, 0.25 + i * 0.04);
    });
    tl.to(s, { scale: 0.6, rotation: -30, duration: 0.5, ease: 'power2.in' }, 0.25)
      .add(slam(text, LIGHT, GOLD, 0.3), 0.5)
      // Spit them back out.
      .to(others, { x: 0, y: 0, scale: 1, rotation: 0, duration: 0.9, ease: 'elastic.out(1, 0.5)', stagger: 0.03 }, 1.35)
      .to(s, { scale: 1, rotation: 0, duration: 0.6, ease: 'back.out(2)' }, 1.35)
      .to([hole, disk], { scale: 0, duration: 0.4, ease: 'power3.in' }, 1.35)
      .to(dim, { opacity: 0, duration: 0.4 }, 1.4)
      .set([...others, s], { clearProps: 'x,y,scale,rotation' })
      .call(() => knock(stage, c, 10, s), [], 1.4);
    return tl;
  },

  /** Football: a ball pops out, bounces across the screen and bulges the net. GOAL. */
  goal(s, _stage, text) {
    const c = centre(s);
    const b = ball(54);
    const l = layer(84);
    const net = document.createElement('i');
    net.style.cssText = `position:absolute;inset:0;opacity:0;transform-origin:100% 50%;
      background-image:repeating-linear-gradient(45deg,rgba(246,243,236,.35) 0 2px,transparent 2px 36px),repeating-linear-gradient(-45deg,rgba(246,243,236,.35) 0 2px,transparent 2px 36px)`;
    l.appendChild(net);
    const right = innerWidth + 40;
    const floor = innerHeight - 60;
    const span = right - c.x;
    const tl = gsap.timeline({ onComplete: () => { b.remove(); l.remove(); } });
    tl.set(b, { x: c.x, y: c.y })
      .to(b, { x: c.x + span * 0.33, duration: 0.45, ease: 'none' }, 0)
      .to(b, { keyframes: { y: [c.y - 160, floor], easeEach: 'sine.inOut' }, duration: 0.45 }, 0)
      .to(b, { x: c.x + span * 0.66, duration: 0.4, ease: 'none' }, 0.45)
      .to(b, { keyframes: { y: [floor - 220, floor], easeEach: 'sine.inOut' }, duration: 0.4 }, 0.45)
      .to(b, { x: right - 80, duration: 0.3, ease: 'power1.out' }, 0.85)
      .to(b, { y: innerHeight * 0.45, duration: 0.3, ease: 'power2.out' }, 0.85)
      .to(b, { rotation: 1080, duration: 1.15, ease: 'none' }, 0)
      .fromTo(b, { scaleX: 1.3, scaleY: 0.75 }, { scaleX: 1, scaleY: 1, duration: 0.15 }, 0.45)
      .fromTo(b, { scaleX: 1.3, scaleY: 0.75 }, { scaleX: 1, scaleY: 1, duration: 0.15 }, 0.85)
      // Net bulge from the impact point.
      .to(net, { opacity: 1, duration: 0.1 }, 1.1)
      .fromTo(net, { scaleX: 1 }, { scaleX: 1.06, skewY: 2, duration: 0.12, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 1.1)
      .to(net, { opacity: 0, duration: 0.4 }, 1.7)
      .to(b, { opacity: 0, duration: 0.3 }, 1.5)
      .call(() => { shake(6); }, [], 1.1)
      .add(slam(text), 1.1)
      .add(confetti(50), 1.15);
    return tl;
  },
};
