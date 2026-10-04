// Full Time Whistle (spec §5.6): whistle flash, headline slam + type-on, chat with typing indicator
// and quick replies, mailto submit, copy-email, split-flap scoreboard.
import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { reducedMotion } from './env';

gsap.registerPlugin(Flip, ScrollTrigger, SplitText);

const TYPING_MS = 700;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function initFullTime() {
  const section = document.querySelector<HTMLElement>('[data-fulltime]');
  if (!section) return;
  if (!reducedMotion) {
    whistle(section);
    headline(section);
    scoreboard();
  }
  chat(section);
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

/** Chat: messages one at a time with a typing indicator; quick replies pop in; replies fly to the thread. */
function chat(section: HTMLElement) {
  const thread = section.querySelector<HTMLElement>('[data-chat-thread]');
  const chips = section.querySelector<HTMLElement>('[data-chat-chips]');
  const form = section.querySelector<HTMLFormElement>('[data-chat-form]');
  if (!thread || !chips || !form) return;
  const opening = [...thread.querySelectorAll<HTMLElement>('[data-chat-msg]')];
  const chipEls = [...chips.querySelectorAll<HTMLButtonElement>('[data-chip]')];

  // Fixed-height thread with room for replies, so new messages never push the layout (CLS).
  thread.style.height = `${thread.scrollHeight + 150}px`;
  thread.style.overflowY = 'auto';

  let busy = false;
  const typing = () => {
    const t = document.createElement('span');
    t.className = 'typing';
    t.setAttribute('aria-hidden', 'true');
    t.innerHTML = '<i></i><i></i><i></i>';
    return t;
  };
  const dots = (t: HTMLElement) =>
    gsap.to(t.querySelectorAll('i'), { y: -4, duration: 0.25, stagger: { each: 0.12, repeat: -1, yoyo: true }, ease: 'sine.inOut' });

  /** Shows the typing indicator where `bubble` will appear, then reveals it. */
  async function say(bubble: HTMLElement) {
    if (reducedMotion) { gsap.set(bubble, { autoAlpha: 1 }); return; }
    const t = typing();
    thread!.appendChild(t);
    t.style.left = `${bubble.offsetLeft}px`;
    t.style.top = `${bubble.offsetTop}px`;
    const anim = dots(t);
    thread!.scrollTo({ top: bubble.offsetTop - 20 });
    await wait(TYPING_MS);
    anim.kill();
    t.remove();
    gsap.fromTo(bubble, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'expo.out' });
  }

  // Opening sequence on enter.
  if (!reducedMotion) {
    gsap.set(opening, { autoAlpha: 0 });
    gsap.set(chipEls, { autoAlpha: 0, scale: 0.6 });
    ScrollTrigger.create({
      trigger: thread,
      start: 'top 75%',
      once: true,
      onEnter: async () => {
        busy = true;
        for (const m of opening) await say(m);
        await wait(200);
        gsap.to(chipEls, { autoAlpha: 1, scale: 1, duration: 0.5, stagger: 0.08, ease: 'back.out(2.4)' });
        busy = false;
      },
    });
  }

  // Quick replies: the user bubble flies from the chip into the thread, then Ayush types back.
  chipEls.forEach((chip) => {
    chip.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      const i = chip.dataset.chip!;
      const answer = chips.querySelector<HTMLTemplateElement>(`template[data-answer="${i}"]`)!.content.textContent ?? '';

      const you = document.createElement('p');
      you.className = 'bubble bubble--you';
      you.textContent = chip.textContent;
      const me = document.createElement('p');
      me.className = 'bubble bubble--me';
      me.textContent = answer;

      const state = Flip.getState(chip);
      chip.dataset.flipId = `chip-${i}`;
      you.dataset.flipId = `chip-${i}`;
      thread.appendChild(you);
      thread.appendChild(me);
      gsap.set(me, { autoAlpha: 0 });
      thread.scrollTo({ top: thread.scrollHeight });
      chip.disabled = true;
      chip.style.visibility = 'hidden';

      if (!reducedMotion) {
        await Flip.from(state, { targets: you, duration: 0.5, ease: 'expo.out', absolute: true, scale: true }).then();
      }
      // Used chips leave the row; the rest stay.
      gsap.to(chip, { width: 0, paddingLeft: 0, paddingRight: 0, marginLeft: -8, borderWidth: 0, duration: reducedMotion ? 0 : 0.25, onComplete: () => chip.remove() });
      await say(me);
      thread.scrollTo({ top: thread.scrollHeight });
      busy = false;
    });
  });

  // Input: open the visitor's email client with the message (spec: mailto with subject + body).
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = form.querySelector<HTMLInputElement>('input[name="body"]')!;
    const body = input.value.trim();
    const url = `mailto:${form.dataset.email}?subject=${encodeURIComponent(form.dataset.subject ?? '')}&body=${encodeURIComponent(body)}`;
    if (body) {
      const you = document.createElement('p');
      you.className = 'bubble bubble--you';
      you.textContent = body;
      thread.appendChild(you);
      thread.scrollTo({ top: thread.scrollHeight });
      if (!reducedMotion) gsap.from(you, { autoAlpha: 0, y: 12, duration: 0.35, ease: 'expo.out' });
      input.value = '';
    }
    window.location.href = url;
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
