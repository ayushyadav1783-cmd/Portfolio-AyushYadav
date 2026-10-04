// Custom cursor (spec §4.4, board 06): an 8px gold dot that follows exactly and a 36px ring that follows
// with lerp .18, morphing by context. Fine pointers only, never for reduced motion. The native cursor is
// hidden only once this has mounted; keyboard focus never depends on it.
import { gsap } from 'gsap';

type State = 'default' | 'kick' | 'scout' | 'throw' | 'grabbed' | 'copy' | 'text' | 'ball' | 'drag' | 'shoot' | 'drone';

const STYLES: Record<State, { size: number; bg: string; border: string; color: string; label: string; radius: string }> = {
  default: { size: 36, bg: 'transparent', border: '1.5px solid rgba(246,243,236,.6)', color: '#120d02', label: '', radius: '999px' },
  kick: { size: 64, bg: '#f5c542', border: '0 solid transparent', color: '#120d02', label: 'KICK', radius: '999px' },
  scout: { size: 84, bg: 'transparent', border: '1.5px solid #f5c542', color: '#f5c542', label: 'SCOUT ↗', radius: '999px' },
  throw: { size: 64, bg: '#ff4a3d', border: '0 solid transparent', color: '#08080b', label: 'THROW', radius: '999px' },
  grabbed: { size: 72, bg: '#ff4a3d', border: '0 solid transparent', color: '#08080b', label: 'GRABBED', radius: '999px' },
  copy: { size: 64, bg: '#f6f3ec', border: '0 solid transparent', color: '#08080b', label: 'COPY', radius: '999px' },
  text: { size: 34, bg: '#f5c542', border: '0 solid transparent', color: '#120d02', label: '', radius: '2px' },
  ball: { size: 30, bg: '#f6f3ec', border: '0 solid transparent', color: '#08080b', label: '', radius: '999px' },
  drag: { size: 64, bg: 'transparent', border: '1.5px solid #f5c542', color: '#f5c542', label: 'DRAG', radius: '999px' },
  shoot: { size: 56, bg: '#ff4a3d', border: '0 solid transparent', color: '#08080b', label: 'SHOOT', radius: '999px' },
  drone: { size: 18, bg: 'transparent', border: '1.5px solid #f5c542', color: '#f5c542', label: '', radius: '999px' },
};

/** Which state an element under the pointer asks for. Explicit data-cursor wins. */
function stateFor(el: Element | null, dragging: boolean): State {
  if (!el) return 'default';
  const explicit = el.closest<HTMLElement>('[data-cursor]');
  const interactive = el.closest('a, button, label, select, summary, input, textarea, [role="tab"]');
  if (explicit && !(interactive && explicit.contains(interactive) && interactive !== explicit)) return explicit.dataset.cursor as State;
  if (el.closest('[data-sticker]')) return dragging ? 'grabbed' : 'throw';
  if (el.closest('[data-card]')) return 'scout';
  if (el.closest('[data-copy]')) return 'copy';
  if (el.closest('.pen__zone')) return 'shoot';
  if (el.closest('input[type="text"], input:not([type]), textarea')) return 'text';
  if (el.closest('a, button, label, select, summary, [role="tab"]')) return 'kick';
  if (el.closest('[data-fan]')) return 'ball';
  return 'default';
}

export function initCursor() {
  const root = document.documentElement;
  const dot = document.createElement('div');
  const ring = document.createElement('div');
  const label = document.createElement('span');
  dot.setAttribute('aria-hidden', 'true');
  ring.setAttribute('aria-hidden', 'true');
  dot.className = 'cur-dot';
  ring.className = 'cur-ring';
  label.className = 'cur-label';
  ring.appendChild(label);
  // A pentagon for the Fan Zone football.
  const panel = document.createElement('i');
  panel.className = 'cur-ball';
  ring.appendChild(panel);
  document.body.append(ring, dot);
  root.classList.add('has-cursor');

  let state: State = 'default';
  let down = false;
  let shown = false;
  const pos = { x: -100, y: -100 }, ringPos = { x: -100, y: -100 }, last = { x: 0, y: 0 };
  let spin = 0;

  const apply = (s: State) => {
    if (s === state) return;
    state = s;
    const st = STYLES[s];
    gsap.to(ring, { width: st.size, height: st.size, backgroundColor: st.bg, color: st.color, borderRadius: st.radius, duration: 0.25, ease: 'power3.out' });
    ring.style.border = st.border;
    label.textContent = st.label;
    ring.classList.toggle('is-ball', s === 'ball');
    ring.classList.toggle('is-text', s === 'text');
    dot.style.opacity = s === 'kick' || s === 'throw' || s === 'grabbed' || s === 'copy' || s === 'shoot' || s === 'text' ? '0' : '1';
  };

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    pos.x = e.clientX; pos.y = e.clientY;
    if (!shown) { shown = true; ringPos.x = pos.x; ringPos.y = pos.y; gsap.to([dot, ring], { autoAlpha: 1, duration: 0.2 }); }
    apply(stateFor(e.target as Element, down));
  }, { passive: true });
  window.addEventListener('pointerdown', (e) => { down = true; apply(stateFor(e.target as Element, true)); gsap.to(ring, { scale: 0.85, duration: 0.12 }); });
  window.addEventListener('pointerup', (e) => { down = false; apply(stateFor(e.target as Element, false)); gsap.to(ring, { scale: 1, duration: 0.25, ease: 'back.out(3)' }); });
  document.addEventListener('pointerleave', () => { shown = false; gsap.to([dot, ring], { autoAlpha: 0, duration: 0.2 }); });
  // Overlays opened by keyboard should never leave a stale morph behind.
  window.addEventListener('scroll', () => apply(stateFor(document.elementFromPoint(pos.x, pos.y), down)), { passive: true });

  gsap.ticker.add(() => {
    ringPos.x += (pos.x - ringPos.x) * 0.18;
    ringPos.y += (pos.y - ringPos.y) * 0.18;
    const v = pos.x - last.x;
    last.x = pos.x; last.y = pos.y;
    spin += v * 2;
    dot.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
    ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0) rotate(${state === 'ball' ? spin : 0}deg)`;
  });
}
