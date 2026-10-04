# Match Day at My Stadium — Build Spec

Portfolio for **Ayush Yadav**. Hand this file to Claude Code with the design canvas ("Ayush Yadav Portfolio", 6 boards). The canvas shows what every screen looks like. This file says how everything moves, what triggers it, and exactly what the copy says.

**Hard rules**

1. The resume is the single source of truth for every project, number and date. All of them are in `content.json` below. Never invent or round a metric.
2. **Never display the phone number** anywhere: not in markup, metadata, the resume link text or the console.
3. No characters, crests, logos or likenesses of real people or franchises (Real Madrid, Ronaldo, Naruto, One Piece, Spider-Man, Iron Man). Fandom shows up as **words and original shapes only**: typographic stickers, tickers, colors.
4. Everything works without motion. `prefers-reduced-motion: reduce` gets the full content with fades only.

---

## 1. Concept

The whole site is one match day at Ayush's stadium. Scrolling is the walkout: tunnel, floodlights, pitch, dressing room, stands, final whistle. A **match clock** in the broadcast bar is driven by scroll progress, so the scrollbar is literally the game.

| Zone | Section | Clock | Job |
|---|---|---|---|
| Tunnel Walkout | Hero | 0' | Name, tagline, wow |
| Warm-Up | About | 15' | Who he is, funny, plus the facts |
| Starting VII | Projects | 30' | 7 projects as a 7-a-side lineup |
| Dressing Room | Skills ("Power-ups") | 40' | Skills as power-up cards |
| Fan Zone | Interests | HT | Personality, chaos |
| Full Time Whistle | Contact | 90'+ | Chat, copy email, socials |

"Starting **VII**" not "XI": the resume has 7 projects, 7-a-side is a real format, and 7 is his number. Never pad to 11.

---

## 2. Stack (recommended)

- **Astro + React islands** (or Next.js App Router if you prefer). The page is static, so ship HTML first.
- **GSAP 3** with ScrollTrigger, SplitText and Flip (all GSAP plugins are free now).
- **Lenis** for inertia scrolling, synced to the GSAP ticker.
- **OGL** (about 8kb) for the WebGL bits: starfield, card ripple, transitions, halftone. Only reach for three.js / R3F if you do the 3D stadium stretch goal.
- **matter-js** for Fan Zone sticker physics, desktop only.
- **Howler** for optional sound (off by default).
- Deploy on Vercel. Resume served as `/resume.pdf`.

---

## 3. Design tokens

```css
:root {
  /* colour */
  --night: #08080b;      /* page ground */
  --stand: #121218;      /* cards, chat, panels */
  --tunnel: #1c1c25;     /* chips, inner tiles, card art ground */
  --pitch: #0e1310;      /* Starting VII pitch */
  --floodlight: #f6f3ec; /* primary text (18:1 on night) */
  --muted: #a3a1ab;      /* secondary text (7.8:1 on night, 6.6:1 on tunnel) */
  --line: rgba(246,243,236,.14); /* decorative pitch lines only */
  --control: #6e6d7a;    /* control borders, 3:1+ */
  --trophy: #f5c542;     /* THE accent: CTAs, stats, the 7 (12:1 on night) */
  --on-trophy: #120d02;  /* text on gold (11.9:1) */
  --red-card: #ff4a3d;   /* secondary: LIVE, drama, Fan Zone bg (6:1 on night) */
  --on-red: #08080b;     /* text on red (6:1). Never white on red (4.7:1) */

  /* type */
  --font-display: 'Big Shoulders Display', 'Arial Narrow', sans-serif; /* 800-900, UPPERCASE */
  --font-body: 'Instrument Sans', system-ui, sans-serif;               /* 400-600 */
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;              /* stats, labels, clock */

  /* radius */
  --r-chip: 4px; --r-card: 22px; --r-panel: 28px; --r-pill: 999px;

  /* motion */
  --ease-out: cubic-bezier(.16,1,.3,1);   /* expo.out: reveals */
  --ease-spring: cubic-bezier(.3,1.6,.5,1); /* stickers, pops */
  --dur-fast: 200ms; --dur-base: 450ms; --dur-slow: 900ms;
}
```

**Type scale (fluid, clamp on viewport or container width):**

| Role | Desktop 1440 | Mobile 390 | Notes |
|---|---|---|---|
| Hero name | 272px / .8 | 88px | weight 900, "YADAV" is a 2px outline stroke, red full stop |
| Section title | 168px / .82 | 64px | weight 900 |
| Sub-headline | 92px / .9 | 48px | weight 800 |
| Card title | 24–34px / 1 | same | weight 800 |
| Lead | 28px / 1.3 | 20px | body font, weight 500 |
| Body | 20px / 1.6 | 17px | |
| Label | 12px, tracking .14em | same | mono, uppercase |
| Stat | 15–32px | same | mono, weight 700, `--trophy` |

**Layout:** max content width 1280px, gutters 40px desktop / 16px mobile, sections 140–168px apart desktop / 72–96px mobile.

---

## 4. Global systems

### 4.1 Preloader: tunnel walkout (2.6s, see the "Intro sequence storyboard" board)

| t | What | How |
|---|---|---|
| 0–0.9s | Black tunnel in perspective. The light at the end grows 0→120px. `SQUAD LOADING 01/07` ticks once per loaded asset group. | Real loading progress: fonts, hero textures, WebGL init. Hold at 07/07 until ready, max 4s, then continue anyway. |
| 0.6s | "Skip intro →" fades in | Click/Enter/Esc jumps to the final state |
| 0.9–1.6s | Camera exits the tunnel: scale 1.4→1, blur 8→0px. 4 floodlights switch on 140ms apart. | Each light: 60ms white overexposure flash (a full-screen white layer at opacity .15), then its beam fades in over 300ms. |
| 1.6–2.3s | "AYUSH" chars rise from a mask (y 110%→0, expo.out 0.8s, 28ms stagger). The "YADAV" outline draws its stroke left→right. Planet scales .6→1 and its glow pulses once. Red full stop lands last with a bounce. | SplitText chars plus an overflow mask. Stroke draw = `stroke-dasharray` on an SVG text copy. |
| 2.3–2.6s | Broadcast bar slides down (y −100%→0). Highlights pill pops in last (scale .6→1, spring). Tagline fades up word by word (40ms stagger), CTAs follow. | Then `lenis.start()`. |

Plays once per session (`sessionStorage`, wrapped in try/catch). Reduced motion: no tunnel, a 300ms fade-in of the final hero.

### 4.2 Broadcast bar (sticky header)

- Left: the **7 button** (gold-outlined circle, easter-egg trigger), the `LIVE` red tag, the scoreline `AYUSH 7 – 0 BUGS`, and the match clock.
- **Match clock:** scroll progress maps to minutes. 0–80% of the page runs 0'→45' (the first half), Fan Zone shows `HT`, and contact runs 46'→90'+. Mono digits tick, never tween. On entering each zone, a lower-third "bug" slides in for 1.6s (`15' · WARM-UP`) and then collapses into the clock.
- Center: stadium map nav (anchor links, Lenis `scrollTo` with a 1.2s expo ease).
- Right: red **"In a hurry? Highlights ››"** pill. Always visible, every viewport.
- Hides on scroll down after the hero (y −100%), shows on scroll up. Never hides while the match clock bug is animating.
- Mobile: 7 button + LIVE + clock on the left, highlights pill on the right. Nav moves into a full-screen "Stadium map" menu.

### 4.3 Smooth scroll

Lenis with `lerp: 0.1`, `wheelMultiplier: 1`, synced via `gsap.ticker.add((t)=>lenis.raf(t*1000))`. Disable on touch devices (native momentum is better) and with reduced motion.

### 4.4 Custom cursor (desktop, `pointer: fine` only)

A two-part cursor: an 8px gold dot (follows exactly) and a 36px ring (follows with lerp .18). States are set via `data-cursor` on elements:

| Context | Cursor |
|---|---|
| default | dot + ring |
| link / button | gold filled 64px disc, label `KICK` |
| player card | 84px gold ring, label `SCOUT ↗` |
| sticker | red 64px disc, `THROW` (`GRABBED` while dragging) |
| email button | floodlight 64px disc, `COPY` |
| text / input | 2px gold caret bar |
| Fan Zone background | small football (white disc, dark pentagon) that spins with velocity |

Morphs use GSAP over 250ms. Hide the native cursor only when the custom one has mounted. Keyboard focus never depends on the cursor.

### 4.5 Section transitions

- **MVP:** a "floodlight sweep". A white band at 15% opacity wipes diagonally across the viewport as each section's top crosses 60% of the viewport. CSS clip-path plus GSAP, 600ms.
- **Into Fan Zone:** the background floods red from the center via an expanding circle clip-path, scrubbed to scroll over 40vh.
- **Into Full Time:** the red drains back to night and the stadium lights dim to 60% brightness.
- **v2:** replace the sweeps with one OGL full-screen shader pass (noise-displaced wipe plus halftone dissolve) that every section shares.

### 4.6 Sound (optional, off by default)

The toggle sits in the broadcast bar ("Crowd: off"). Sounds: a low crowd bed, floodlight "thunk"s, a whistle at full time, a roar for SIUUU. Never autoplay before a user gesture. Use licensed or CC0 assets only.

---

## 5. Sections

### 5.1 Tunnel Walkout (Hero)

**Layout (desktop):** a full-bleed night sky with a starfield. A glowing planet (gold core → burnt orange → deep red rim) sits top right with a tilted gold ring. Two floodlight towers stand left and right with diagonal beams. A halftone stadium-stand silhouette arcs across the bottom, and the tunnel mouth glows bottom center. Text is left-aligned over all of it. The gold ticker band below the hero is rotated −1.2°.

**Mobile:** the planet shrinks to 160px and moves to the top right, behind the bar. The name is 88px on two lines and the towers are cropped at the edges.

**Copy**

- Eyebrow: `NOW ENTERING THE PITCH · NO. 7 · MS IN AI, NJIT`
- Name: `AYUSH` / `YADAV.`
- Tagline: **I teach robots to see the world in 3D.** *Defenders mostly just see my back.* (the second sentence in gold)
- Sub: `AI Research Assistant @ Aegean AI Lab · Free agent from May 2027`
- CTA primary: `Walk out with me ↓` (scrolls to Warm-Up)
- CTA secondary: `Resume` (opens the Scouting Report overlay, see §8.1; `/resume.pdf` is the no-JS fallback)
- Scroll cue: `SCROLL TO WALK OUT`
- Ticker: `Computer vision ✦ 3D Gaussian Splatting ✦ Robotics ✦ Camera geometry ✦ Sim-to-real ✦ Open-vocab perception ✦ Kickoff May 2027 ✦`

**Motion**

| Element | Animation | Trigger |
|---|---|---|
| Starfield | OGL point field (about 1,500 points, 3 depth layers), slow drift, twinkle via per-point sin. Mouse parallax: layer offsets of 4/10/18px. | always, paused when off-screen |
| Planet | Glow breathes (6s loop). Parallax: rises 0.3× scroll speed, rotates 8° over the hero. | scroll scrub |
| Towers + beams | Beams sway ±2° slowly (8s). Beams intensify to 1.4× as you start scrolling. | load / scroll |
| Name | **Walkout scrub:** over the first 100vh of scroll the name scales 1→1.6 and letter-spacing opens up, while the stands rise to fill the screen (camera moving forward through the tunnel). At 100% the stands become the Warm-Up background. | ScrollTrigger pin hero for 100vh, scrub: true |
| Tagline / CTAs | Fade + y 20px out at 30% of the pin | scrub |
| Ticker | Marquee 28s per loop. Scroll velocity speeds it up (up to 3×) and skews it ±6°. | always + velocity |
| Buttons | Magnetic (see 6.4) | hover |

### 5.2 Warm-Up (About)

**Layout:** a giant outlined `WARM-UP` word sits behind (1px stroke at 12% opacity). Left column: headline, two paragraphs, the "Today's drills" checklist card. Right column: a 4:5 portrait in red halftone + grayscale with a gold `7` top right, and a player-profile list under it. Mobile stacks: text, drills, portrait, profile.

**Copy**

- Bug: `15' · WARM-UP · PRE-MATCH INTERVIEW`
- Headline: **Stretching, hydrating, over-engineering a camera calibration.** ("over-engineering" in gold)
- P1: Hey, I'm Ayush. Third semester of an MS in AI at NJIT, research assistant at the Aegean AI Lab, and the guy who turns "the robot can't find the cup" into a geometry problem he can win.
- P2: I build the eyes for robots: 3D Gaussian Splatting, camera geometry, and the alignment math that makes an arm grab the cup instead of the table. Off the clock it's football, anime, and space documentaries at 2 a.m. I treat bugs like defenders. Study the tape, find the gap, finish.
- **Today's drills**
  - ✓ Register 621 of 621 frames
  - ✓ Reconstruct a whole lab at 29.60 dB PSNR
  - ✓ Catch ICP lying about a 28° tilt
  - ✓ Find 9 of 10 objects in 3D from plain words
  - ☐ Sign a new-grad contract (May 2027, your club?)
- **Player profile**
  - POSITION: Computer vision · 3D vision · Robotics
  - PREFERRED FOOT: Python. C++ when it gets serious.
  - CURRENT CLUB: NJIT, MS in AI · GPA 3.83/4.00
  - ON LOAN AT: Aegean AI Lab, Summer of Agents 2026 (3 spots, got one)
  - ACADEMY: B.Tech Computer Engineering, Ramrao Adik Institute of Technology, 2021–2025
  - HOME GROUND: Harrison, NJ
  - CONTRACT: Free agent from May 2027

**Motion**

| Element | Animation | Trigger |
|---|---|---|
| Background word | Moves horizontally −15% → +5% across the section | scroll scrub |
| Headline | SplitText lines rise from masks, 80ms stagger | enters at 75% of the viewport |
| Paragraphs | Fade + y 24px, 100ms stagger | enter |
| Drills | Each box ticks in sequence as the card scrolls through (box fills gold, the ✓ draws via stroke, a small scale pop). The last box stays empty and wiggles once. | scroll scrub, one tick per 8% of progress |
| Portrait | Halftone dots shader (OGL) or CSS fallback. On hover the dot size shrinks to 0 from the cursor outward, revealing full color (radial reveal, 500ms). Slight 3D tilt (max 6°). | hover |
| Gold 7 | Rotates in from −20° when the portrait enters | enter |
| Profile rows | Typewriter value reveal, mono, 12ms/char | enter |

### 5.3 Starting VII (Projects)

**Layout:** a header row with the huge "STARTING VII" title and a short intro on the right. Below it, a dark pitch with white lines at 14% opacity (outline, halfway line, center circle, both boxes). The 7 player cards sit in a **1-1-2-3 formation**, attackers at the top: LW · ST · RW / CAM · CM / CB / GK. On mobile the pitch becomes a vertical lineup, one card per row, in the same order, with the position tag kept.

**Card anatomy (256px wide):** a 150px art area (the project visual; halftone placeholder until real assets exist) with the shirt number top left in display 54px, the position + role nickname in gold mono, and the club tag top right. Below that: title (display 24px), a one-line role, then 3 "attributes" in a 3-column stat row (gold mono value + tiny muted label).

**Copy**

- Bug: `30' · TEAM SHEET · 1-1-2-3`
- Intro: Seven projects, one formation. Seven because 7-a-side is a real format. Also, look at my shirt. Hover a card to scout it, click to read the full match report.
- Cards and full match reports: see `content.json → projects`.

**Motion**

| Element | Animation | Trigger |
|---|---|---|
| Pitch | **Changed on Ayush's feedback (2026-10-04):** pin is 70vh; all 7 cards are on the pitch from the first frame (no empty pitch, no run-out); the pitch is fitted to the screen, tilts up, the 7 flashes gold, then the camera zooms to 100% as the pin releases. Original: **Pinned sequence (desktop):** the section pins for 150vh. The pitch starts flat and far (rotateX 60°, scale .7), then tilts up to face the camera (rotateX 0, scale 1) over the first 40%. | ScrollTrigger pin + scrub |
| Cards | During 30–90% of the pin, cards "run out" from the tunnel position (bottom center) to their formation spots one by one in kickoff order: GK, CB, CM, CAM, LW, RW, ST (the 7 lands last with a gold flash). Flip plugin or a computed path, 0.6s each, overlapping. | scrub |
| Card hover | 3D tilt following the pointer (max 12°, spring damping .15). A glare band tracks the pointer. **Image ripple:** a shared OGL canvas renders the art area with a pointer-centered ripple displacement. Gold rim + glow. Neighbor cards dim to 60%. | pointermove |
| Card click | Flip (rotateY 180°, 500ms) to a gold "Match report" teaser, then a shared-element expand into the full-screen report (Flip plugin, 700ms expo). The URL updates to `#report-7` so it can be shared. Esc / close / back button returns. | click / Enter |
| Match report | Two columns: the art goes big on the left (video or GIF loop when available), and on the right: title, club + date, summary, a full stats grid (count-up numbers, 900ms), a "What happened out there" list, stack chips, and prev/next player. | open |
| Mobile | No pin. Cards slide in from alternating sides as they enter. Tap tilts once (a gyroscope tilt is a stretch goal), tap again opens the report. | enter |

### 5.4 Dressing Room: Power-ups (Skills)

**Layout:** title "POWER-UPS" (red hyphen) plus intro. A 3×3 grid of power-up cards: a type label (color-coded: gold = Vision/3D/Robotics, red = Perception/MLOps, floodlight = Deep learning), "PLAYED BY #x #y" (the shirt numbers of the projects that used it), the skill name, a "Special move" proof line, and a **power level meter of 7 segments**. Below the grid: the BASE STATS chip row with languages. Mobile is 1 column.

**Power level = the number of resume projects that used the skill (out of 7).** Not a self-rating. The intro says so and it's the joke. Keep it honest: engineers reading this will check.

**Copy**

- Bug: `40' · DRESSING ROOM`
- Intro: Every skill here was unlocked in a real mission. Power level = how many of my seven projects it carried. No self-rated stars. I'm not that guy.
- Cards: see `content.json → powerups`.
- Base stats: Python · C/C++ · SQL · Java · Bash

**Motion**

| Element | Animation | Trigger |
|---|---|---|
| Grid | Cards deal in like a hand of cards: from a stacked deck at the center to grid positions, rotation −8°→0, 50ms stagger | enter at 70% |
| Meter | Segments fill left to right, 60ms apart, with a scale pop. Cards at 5+ emit a one-time aura burst (a red/gold particle ring, 400ms). | when each card enters |
| Hover / focus | Lift −10px + scale 1.02 on a spring. The aura radial grows and brightens. Gold rim + glow (`0 0 48px gold/35%, 0 0 120px red/18%`). Speed lines (thin gradient strokes) streak behind the card for 300ms. | hover / focus |
| Spring grid | The pointer pushes neighbor cards away (max 6px, inverse distance), and they settle with damping | pointermove |
| Title | "POWER-UPS" letters jitter once on enter like an anime power-up flash: a 2-frame white flash and a ±4px shake | enter |

### 5.5 Fan Zone (Interests)

**Layout:** a full-bleed **red** section with a dark halftone dot overlay, black text. The title "FAN ZONE" plus a line of copy. Two crossing ticker bands: a black band with gold text (rotated −4°) and a cream band with black text (rotated +3°, opposite direction). Then a cluster of 8 rotated typographic **stickers** (thick black border, hard offset shadow, mixed shapes: pill, rounded, sharp). Hint text below.

**Copy**

- Bug: `HT · HALF-TIME · FAN ZONE`
- Line: Things I will talk about for 90 minutes plus stoppage time. You've been warned.
- Ticker 1: `Real Madrid ✦ CR7 ✦ One Piece ✦ Naruto ✦ Spider-Man ✦ Iron Man ✦ Space ✦ Football ✦`
- Ticker 2: `SIUUU ✦ Hala Madrid ✦ Believe it ✦ Nakama ✦ Friendly neighbourhood ✦ To infinity and the Kármán line ✦`
- Stickers: see `content.json → stickers`
- Hint: `STICKERS ARE DRAGGABLE. THROW THEM. THEY BOUNCE.`

**Motion**

| Element | Animation | Trigger |
|---|---|---|
| Section entry | The red floods from the center (circle clip-path 0→150%), scrubbed | scroll |
| Tickers | Opposite marquees. Scroll velocity speeds them up and skews them. Hovering a band pauses it. | always |
| Stickers | **Desktop:** matter-js bodies drop in from above on enter (gravity, bounce .5), land in a loose pile, and are draggable and throwable, colliding with each other and the section walls. **Mobile / reduced motion:** static rotated grid, tap to wobble. | enter / drag |
| Sticker hover | Straightens to 0° and scales 1.08 (spring) | hover |
| Double-click sticker | Peels: a corner curls via a CSS 3D transform and reveals a hidden one-liner on the back | dblclick |
| Cursor | Turns into the spinning football | in section |

### 5.6 Full Time Whistle (Contact)

**Layout:** a massive "FULL TIME. / YOUR MOVE." headline (red full stop, gold second line). Below it, two columns. Left is a chat window: header with avatar, name and status; the message thread; quick-reply chips; an input with a send button. Right is "OR SKIP THE SMALL TALK": a big gold copy-email button, then GitHub / LinkedIn / Resume rows with playful descriptions, then the availability line. Footer: the final scoreboard `AYUSH 7 – 0 BUGS · FT` plus credits and "back to kickoff ↑".

**Copy**

- Bug: `90'+ · FULL TIME WHISTLE`
- Chat header: `Ayush Yadav` · `● ONLINE · REPLIES FASTER THAN A COUNTER-ATTACK`
- Opening messages (from Ayush):
  1. Yo. Final whistle, but the game's not over.
  2. I graduate in May 2027 and I'm hunting new-grad roles in computer vision, 3D vision and robotics.
  3. Recruiter, engineer, fellow Madridista? Pick a reply.
- Quick replies and responses:
  - **We're hiring** → "Music to my ears. ayushyadav1783@gmail.com, I reply fast. Or tap copy on the right."
  - **Send the resume** → "One page, no fluff. It's the 'Resume' link right there. Highlight reel included."
  - **SIUUU** → "SIUUUUU. You're one of us now. Hint: tap the 7 up top seven times."
- Input placeholder: `Slide into my DMs (opens your email)…` Submit opens `mailto:ayushyadav1783@gmail.com?subject=Saw your portfolio&body=<message>`.
- Copy button: `ayushyadav1783@gmail.com` / `TAP TO COPY` → `Copied. GOOOAL.` / `✓ IN YOUR CLIPBOARD` (2.2s)
- Links (the tooltip/description on the right of each row):
  - GitHub → https://github.com/ayushyadav1783-cmd — "where the code lives"
  - LinkedIn → https://www.linkedin.com/in/ayush-yadav-87ab581a5 — "the version of me with capital letters"
  - Resume → /resume.pdf — "the 1-page highlight reel"
- Availability: Graduating May 2027. Open to new-grad roles in computer vision, 3D vision and robotics. Based in Harrison, NJ.
- Footer: `© 2026 Ayush Yadav · built with caffeine and a few million Gaussians · back to kickoff ↑`

**Motion**

| Element | Animation | Trigger |
|---|---|---|
| Whistle | Optional whistle sound; the screen does a 2-frame white flash | section top hits 50% |
| Headline | "FULL TIME." slams in (scale 1.3→1, 300ms, a 4px screen shake). "YOUR MOVE." types in after it. | enter |
| Chat | Messages appear one at a time with a typing indicator (3 dots, 700ms) between them. Quick replies pop in with a spring after the last message. | enter, then on reply |
| Reply | The user bubble flies from the chip to the thread (Flip). Typing dots, then Ayush's reply. | click |
| Copy email | The label rolls up (y 100%→0), a net-ripple shader bulges the button once, and 12 gold particles burst from the cursor | click |
| Social rows | Magnetic pull. The description slides in from the right on hover (it's always visible on mobile). | hover |
| Scoreboard | The digits flip like a split-flap board when the footer enters | enter |

---

## 6. Components

### 6.1 Buttons

- **Primary:** gold pill, `--on-trophy` text, 52px tall. Hover: background turns floodlight, y −2px.
- **Ghost:** 1px `--control` border. Hover: gold border + gold text.
- **Hurry pill:** red, `--on-red` text, 44px. Hover: y −2px and rotate −1°.
- **Magnetic (all buttons, desktop):** within an 80px radius the shell moves up to 10px toward the pointer and the label 14px (1.4×), via a lerp. Spring back on leave.

### 6.2 Player card

See 5.3. States: rest → hover (tilt + glare + ripple) → flipped teaser → expanded report. Keyboard: Enter opens the report directly (no flip), and focus gets the hover glow.

### 6.3 Power-up card

See 5.4. States: rest (meter empty) → charged (meter filled on enter) → hover/focus (lift + aura).

### 6.4 Chat

Bubbles max-width 82%. Ayush's bubbles: `--tunnel`, radius `18 18 18 4`. User bubbles: gold, radius `18 18 4 18`. The thread is an `aria-live="polite"` region.

### 6.5 Stickers

3px black border, `6px 6px 0` black hard shadow, rotation −6° to +6°, 4 shape variants. Draggable elements expose `aria-roledescription="draggable sticker"`, but they're decorative: all the info is also in the tickers.

---

## 7. Easter eggs

| Egg | Trigger | Payoff |
|---|---|---|
| **SIUUU** | Tap the **7** in the broadcast bar 7 times within 4s. A tiny `n MORE…` counter appears from the 2nd tap. | Full-screen night takeover: gold/red/white confetti burst, a rotating sunburst, giant "SIUUU!" type with a red hard shadow that pops in, a 4px screen shake, and a crowd roar if sound is on. Copy: "You found it. Seven taps on the 7. Respect." / "Now imagine how thorough I'd be on your codebase." Button: "Back to the match". Esc closes. |
| **Anime mode** | Konami code ↑↑↓↓←→←→BA | The whole site gets a halftone + ink filter, all headings pick up red manga-style speed lines, every click spawns a big comic SFX word ("DOOON", "BAM", "SIUU"), and a toast reads "Anime mode unlocked. Power level: rising." Konami again turns it off. |
| **GOAL** | Type `goal` anywhere (not in an input) | The scoreboard increments to `AYUSH 8 – 0 BUGS`, with a net-ripple across the broadcast bar and a short crowd cheer. |
| **Houston** | Hover the planet for 3s | The planet zooms slightly and a tooltip says "Houston, we have a portfolio." Click it: a warp-speed starfield streak for 1s, then back. |
| **Devtools** | Console on load | `%c` styled message: "You opened devtools. Respect. Let's talk: ayushyadav1783@gmail.com" |

Keep every egg skippable and harmless: no blocking dialogs, Esc always exits.

---

## 8. Recruiter escape hatch: Match Highlights

The red pill opens an overlay (dialog, focus trapped, Esc closes, URL `#highlights`). See the "Recruiter escape hatch" board.

- Kicker: `▶ MATCH HIGHLIGHTS · THE 30-SECOND VERSION`
- Title: **For people with calendars.**
- Summary: **Ayush Yadav.** MS in AI at NJIT (GPA 3.83/4.00, graduating May 2027). AI Research Assistant at NJIT's Aegean AI Lab, building language-grounded 3D Gaussian Splatting for real-robot manipulation on an AR4 arm. *Looking for new-grad roles in computer vision, 3D vision and robotics.*
- 5 stats: 29.60 dB (PSNR, 3DGS recon) · 0.46 mm (registration, synth GT) · 621/621 (frames registered) · 9/10 (3D queries correct) · 3.83 (GPA, MS in AI)
- Top 3 goals: see `content.json → highlights.top3`
- Stack: PyTorch · CUDA · gsplat · COLMAP · CLIP · YOLOv8 · ROS2 · Gazebo · Optuna · W&B · Docker · AWS
- Buttons: Download resume · email · LinkedIn
- Exit link: "Actually, I have time. Take me back to the match."

Motion: a broadcast "replay" wipe opens it (a red stripe sweeps across, 400ms, then the content fades up). There's no other choreography, because recruiters are busy.

### 8.1 Scouting Report (resume viewer). Added on Ayush's request, 2026-10-03

Every "Resume" link (hero CTA, Full Time row) opens an in-page **Scouting Report** instead of jumping straight to the PDF. `/resume.pdf` stays the `href`, so it still works without JS.

- Dialog: native `<dialog>`, focus contained, Esc closes, URL `#resume`.
- Kicker: `VAR CHECK · SCOUTING REPORT` · Title: **Scouting report** · Sub: `Ayush Yadav · No. 7`
- All viewports: a summary card built from `content.json → person` (headline, education, experience). The PDF is never embedded, because it contains the phone number, which the site never displays. It's one click away via the buttons.
- Buttons: `Download PDF` (download attribute) · `Open in new tab` · `Back to the match`
- Stamp: `CLEARED ✓`

**Motion:** a red "VAR CHECK IN PROGRESS" stripe sweeps across (400ms) → the sheet rises from below with a rotateX 25°→0 tilt (expo.out, 700ms) → a gold scanline sweeps down the sheet (800ms) → the `CLEARED ✓` stamp thumps in (scale 2→1, −12°, spring) with a 3px shake. Closing drops the sheet back down. Reduced motion: fades only.

---

## 9. Accessibility and performance

- Real `<a>` / `<button>` / `<input>` + `<label>` everywhere. Visible focus: a 2px gold outline, 3px offset.
- Every text pair meets 4.5:1 (see the tokens). Never white text on red.
- `prefers-reduced-motion`: no preloader tunnel, no pins, no marquees, no physics, no cursor, no shaders. Fades only. All content stays reachable.
- Touch devices: no custom cursor, no magnetic effect, no matter-js, no Lenis. Tilt only on tap.
- WebGL: **one** shared OGL renderer for the starfield, card ripples and transitions (never one context per card). Pause the render loop when the tab is hidden or the canvas is off-screen. Cap DPR at 1.5 for the starfield. Fall back to CSS when WebGL fails.
- Budgets: LCP < 2.5s on 4G, CLS < 0.05, JS < 200kb gz for the first load. Lazy-load WebGL, matter-js and Howler after the intro.
- SEO: real text in HTML (not canvas). Title "Ayush Yadav — Computer Vision & Robotics Engineer". OG image = the hero still.

---

## 10. Heavy-build flags (scope these)

| # | Item | Weight | Recommendation |
|---|---|---|---|
| 1 | **Explorable 3D stadium** (Bruno Simon-style, drive or walk around) | Very heavy (weeks, 3D modeling, performance risk) | **Skip for v1.** The 2.5D layered parallax plus the pinned walkout scrub gives the same feeling at a fraction of the cost. A stretch goal at most. |
| 2 | WebGL shader section transitions | Heavy | v1: CSS clip-path floodlight sweeps. v2: one shared OGL wipe shader. |
| 3 | Image ripple/distortion on player cards | Medium-heavy | One shared OGL canvas positioned over the hovered card. Needs real project images first. |
| 4 | Pinned Starting VII sequence (pitch tilt + cards running into formation) | Medium-heavy | Build it. It's the money shot. Desktop only, with a simple stagger on mobile. |
| 5 | Starfield shader | Medium | OGL points. Canvas2D fallback. |
| 6 | Sticker physics (matter-js) | Medium | Desktop only. Static grid elsewhere. |
| 7 | Anime mode (Konami) global restyle | Medium | A CSS class on `<html>` swapping filters plus an SFX spawner. Do it last. |
| 8 | Halftone portrait reveal shader | Light-medium | The CSS dot overlay + mask is fine for v1. |
| 9 | Real chat sending | Light-heavy | v1 = mailto. A real form needs a backend (Resend / Formspree) and spam protection. |
| 10 | Sound | Light (code), but needs licensed assets | Off by default. Ship last. |
| 11 | **Project visuals** | **Blocker, not code** | Each card needs a real render, GIF or short loop from the actual work (splat fly-through, ICP before/after, query heatmap, tracking overlay, pipeline diagram, UMAP plot, Optuna plot). Halftone placeholders until then. |

**Suggested build order:** tokens + static layout + content → Lenis + reveals + match clock → preloader → Starting VII pin + cards → power-ups → contact chat + copy → Fan Zone stickers → highlights overlay → starfield shader → eggs → shaders/sound polish.

---

## 11. content.json (source of truth: copy verbatim)

```json
{
  "person": {
    "name": "Ayush Yadav",
    "fullName": "Ayush Ramashankar Yadav",
    "email": "ayushyadav1783@gmail.com",
    "github": "https://github.com/ayushyadav1783-cmd",
    "linkedin": "https://www.linkedin.com/in/ayush-yadav-87ab581a5",
    "location": "Harrison, NJ",
    "resume": "/resume.pdf",
    "headline": "Computer Vision & Robotics Researcher",
    "tagline": "I teach robots to see the world in 3D. Defenders mostly just see my back.",
    "education": [
      { "school": "New Jersey Institute of Technology (NJIT)", "place": "Newark, NJ", "degree": "M.S. in Artificial Intelligence", "gpa": "3.83/4.00", "dates": "2025 – 2027 (Expected)", "focus": "Computer Vision, Deep Learning, AI for Robotics, ML" },
      { "school": "Ramrao Adik Institute of Technology (D.Y. Patil University)", "place": "India", "degree": "B.Tech. in Computer Engineering", "gpa": "CGPA 8.66/10.00", "dates": "2021 – 2025" }
    ],
    "experience": [
      { "org": "Aegean AI Lab, NJIT", "place": "Newark, NJ", "role": "AI Research Assistant", "program": "Summer of Agents 2026 (competitive program, 3 positions)", "dates": "Jun 2026 – Present" }
    ]
  },
  "projects": [
    {
      "kit": 7, "pos": "ST", "nickname": "The Finisher", "club": "Aegean AI Lab", "date": "Jun 2026 – Present",
      "title": "Language-Grounded 3D Gaussian Splatting for Robotic Manipulation",
      "short": "Language-Grounded 3DGS",
      "role": "Text in, robot target out: CLIP-embedded splats driving a SmolVLA planner on an AR4 arm.",
      "attrs": [["29.60", "PSNR dB"], [".952", "SSIM"], ["621/621", "FRAMES"]],
      "stats": [["29.60 dB", "PSNR"], ["0.952", "SSIM"], ["0.078", "LPIPS"], ["621/621", "Frames at 0.96 px"], ["+2.1 dB", "Over baseline"]],
      "report": [
        "Building an end-to-end pipeline from natural-language query to robot action: text → CLIP-embedded 3DGS scene → 3D object localization → XYZ manipulation targets for a SmolVLA motion planner on a physical AR4 arm.",
        "Achieved 29.60 dB PSNR / 0.952 SSIM / 0.078 LPIPS lab-scene reconstruction (621/621 gimbal-captured frames registered at 0.96 px), a +2.1 dB improvement over baseline, trained with gsplat MCMC on an NVIDIA RTX PRO 6000 Blackwell (96GB).",
        "Two documented ablations: per-folder COLMAP camera mode for mixed video/still captures (14 dB → 29 dB on identical images), and Gaussian budget vs. training length (1M @ 30K steps outperforms 3M @ 100K).",
        "Diagnosed a catastrophically broken scene scale (~5M units), traced it to sequential matching on unordered captures, and resolved it via exhaustive feature matching."
      ],
      "stack": ["gsplat", "COLMAP", "CLIP", "SmolVLA", "AR4", "PyTorch", "CUDA"],
      "asset": "Splat fly-through loop"
    },
    {
      "kit": 11, "pos": "LW", "nickname": "The Scout", "club": "Aegean AI Lab", "date": "Jun 2026 – Present",
      "title": "Open-Vocabulary Semantic 3D Queries",
      "short": "Open-Vocab 3D Queries",
      "role": "Ask the scene for an object in plain words, get its 3D position back.",
      "attrs": [["9/10", "FOUND"], ["4/5", "OPEN-VOCAB"], ["304", "KEYFRAMES"]],
      "stats": [["9/10", "Correct 3D localizations"], ["4/5", "Open-vocabulary"], ["304", "Auto-captured keyframes"]],
      "report": [
        "Engineered CLIP ViT-B/32 feature distillation into trained Gaussians with a semantic query engine.",
        "Achieved 9/10 correct 3D object localizations on real captures (4/5 open-vocabulary, beyond closed-set detectors).",
        "Built a ROS2 + Gazebo autonomous capture pipeline (304 keyframes) feeding sim-side training data collection."
      ],
      "stack": ["CLIP ViT-B/32", "3DGS", "ROS2", "Gazebo", "PyTorch"],
      "asset": "Query heatmap on splat"
    },
    {
      "kit": 19, "pos": "RW", "nickname": "The Speedster", "club": "Project", "date": "Mar 2026",
      "title": "UAV Drone Detection & Multi-Object Tracking",
      "short": "UAV Detection + MOT",
      "role": "Fine-tuned YOLOv8n and an 8-state Kalman tracker for drones in flight.",
      "attrs": [["3,000+", "IMAGES"], ["8", "KF STATES"], ["HUNG.", "MATCHING"]],
      "stats": [["3,000+", "Drone images"], ["8-state", "Kalman tracker"]],
      "report": [
        "Fine-tuned YOLOv8n on 3,000+ drone images.",
        "Built a custom 8-state Kalman tracker [cx, cy, w, h, vx, vy, vw, vh] with Hungarian-algorithm assignment.",
        "Built a full annotation pipeline overlaying tracks, predictions and trajectory polylines."
      ],
      "stack": ["YOLOv8", "Kalman filter", "Hungarian algorithm", "OpenCV"],
      "asset": "Tracks + trajectory GIF"
    },
    {
      "kit": 10, "pos": "CAM", "nickname": "The Playmaker", "club": "Aegean AI Lab", "date": "Jun 2026 – Present",
      "title": "Sim-to-Real Geometric Alignment",
      "short": "Sim-to-Real Alignment",
      "role": "Puts the splat in the robot's frame. Caught ICP faking a clean result. Merged.",
      "attrs": [["0.46mm", "SYNTH GT"], ["28°", "TILT CAUGHT"], ["12", "YAW SEEDS"]],
      "stats": [["0.46 mm", "On synthetic GT"], ["28°", "Hidden mis-tilt found"], ["5.8 mm", "RMSE that hid it"], ["12", "Yaw seeds in sweep"]],
      "report": [
        "Built and validated a Umeyama similarity-transform engine (sub-mm synthetic accuracy) and a scale-aware robust ICP engine with FPFH+RANSAC global initialization (0.46 mm on synthetic ground truth) for 3DGS-to-robot-frame registration.",
        "Found that unconstrained 7-DOF ICP silently converges to a 28° mis-tilt (5.8 mm RMSE) on quasi-symmetric geometry.",
        "Designed a gravity-constrained pipeline (table-plane leveling, closed-form yaw/scale/translation, 12-seed yaw sweep), proving low RMSE alone cannot validate registration."
      ],
      "note": "Code-reviewed and merged to aegean-ai/ar4-physical-ai",
      "stack": ["Umeyama", "ICP", "FPFH+RANSAC", "Python"],
      "asset": "Before/after registration overlay"
    },
    {
      "kit": 8, "pos": "CM", "nickname": "Box-to-Box", "club": "Project", "date": "Mar 2026",
      "title": "Robotics Semantic Perception Pipeline",
      "short": "Semantic Perception",
      "role": "TurtleBot3 to ROS2 to YOLOv8 to Zenoh to Postgres. Sensor to database, end to end.",
      "attrs": [["500+", "EVENTS"], ["512", "EMB DIMS"], ["AGE", "GRAPH"]],
      "stats": [["500+", "Detection events ingested"], ["512-dim", "Embeddings in pgvector"]],
      "report": [
        "Built an end-to-end sensor-to-database pipeline (TurtleBot3/Gazebo → ROS2 → YOLOv8 → Zenoh → PostgreSQL) ingesting 500+ detection events.",
        "Extended it with 512-dim embeddings in pgvector and a semantic graph enabling object re-localization."
      ],
      "stack": ["ROS2", "YOLOv8", "Zenoh", "PostgreSQL", "pgvector", "Apache AGE"],
      "asset": "Pipeline diagram"
    },
    {
      "kit": 4, "pos": "CB", "nickname": "Reads the Game", "club": "Project", "date": "Mar 2026",
      "title": "Temporal Cycle-Consistency Self-Supervised Video Learning",
      "short": "TCC Video Learning",
      "role": "Temporal cycle-consistency from scratch. Literally learns to read the timing.",
      "attrs": [["0.589", "ALIGN"], ["128", "BEST D"], ["3", "DIMS SWEPT"]],
      "stats": [["0.589", "Best alignment (D=128)"], ["3", "Embedding sizes swept"]],
      "report": [
        "Implemented TCC loss and temporal segmentation from scratch.",
        "Swept embedding dimensions D = {32, 64, 128}, with D = 128 achieving the best alignment (0.589).",
        "Analyzed embeddings via PCA, UMAP and t-SNE visualizations."
      ],
      "stack": ["PyTorch", "TCC", "PCA", "UMAP", "t-SNE"],
      "asset": "UMAP embedding plot"
    },
    {
      "kit": 1, "pos": "GK", "nickname": "The Shot-Stopper", "club": "Project", "date": "Feb 2026",
      "title": "Faster R-CNN Hyperparameter Optimization",
      "short": "Faster R-CNN HPO",
      "role": "Saved 22 minutes per trial. Best save of the season.",
      "attrs": [["30→8", "MIN/TRIAL"], ["+5%", "mAP"], ["4", "STAGES"]],
      "stats": [["30→8 min", "Per-trial runtime"], ["+5%", "Tuned mAP on VisDrone"], ["4", "HPO stages"]],
      "report": [
        "Built a 4-stage Optuna HPO pipeline (training, RPN anchors, RoI sampling, inference) on COCO-2017.",
        "Cut per-trial runtime from 30 min to 8 min via deferred evaluation.",
        "Improved tuned mAP 5% over baseline on VisDrone, with a custom VOC-to-COCO converter."
      ],
      "stack": ["PyTorch", "Optuna", "W&B", "COCO", "VisDrone"],
      "asset": "Optuna search plot"
    }
  ],
  "powerups": [
    { "type": "VISION · 3D", "name": "3D Gaussian Splatting", "move": "29.60 dB on a real lab scene, +2.1 dB over baseline.", "playedBy": [7, 10, 11], "level": 3 },
    { "type": "VISION · 3D", "name": "Camera Geometry & COLMAP", "move": "621 of 621 frames registered at 0.96 px.", "playedBy": [7], "level": 1 },
    { "type": "VISION · 3D", "name": "Point-Cloud Registration", "move": "Caught a 28° tilt hiding behind a 5.8 mm RMSE.", "playedBy": [10], "level": 1 },
    { "type": "PERCEPTION", "name": "Open-Vocab with CLIP", "move": "9 of 10 objects found in 3D from plain words.", "playedBy": [7, 11], "level": 2 },
    { "type": "PERCEPTION", "name": "Detection & Tracking", "move": "YOLOv8 plus an 8-state Kalman tracker, built from scratch.", "playedBy": [1, 8, 19], "level": 3 },
    { "type": "DEEP LEARNING", "name": "PyTorch & CUDA", "move": "Trained on a 96GB RTX PRO 6000 Blackwell. Mixed precision, multi-GPU.", "playedBy": [1, 4, 7, 11, 19], "level": 5 },
    { "type": "DEEP LEARNING", "name": "Self-Supervised Video", "move": "TCC loss from scratch, best alignment 0.589.", "playedBy": [4], "level": 1 },
    { "type": "ROBOTICS", "name": "ROS2 · Gazebo · Zenoh", "move": "Autonomous capture pipeline, 304 keyframes, zero hands.", "playedBy": [8, 11], "level": 2 },
    { "type": "MLOPS", "name": "Optuna · W&B · Docker", "move": "Trial time cut from 30 minutes to 8.", "playedBy": [1], "level": 1 }
  ],
  "baseStats": ["Python", "C/C++", "SQL", "Java", "Bash"],
  "stickers": [
    { "big": "Hala Madrid", "small": "Real Madrid till the final whistle. And after it." },
    { "big": "CR7", "small": "Why my shirt says 7. Obviously." },
    { "big": "Nakama wanted", "small": "One Piece fan. Building a crew. Engineers welcome." },
    { "big": "Believe it", "small": "Naruto taught me the never-give-up debugging style." },
    { "big": "Friendly neighbourhood ML engineer", "small": "Spider-Man fan. Swings between CUDA errors." },
    { "big": "Genius. Ex-B.Tech. Future new-grad.", "small": "Iron Man fan. Suit pending funding." },
    { "big": "Space nerd", "small": "Will explain black holes for 45 min. No extra time needed." },
    { "big": "Football", "small": "I play too. Not just a keyboard winger." }
  ],
  "highlights": {
    "stats": [["29.60 dB", "PSNR, 3DGS recon"], ["0.46 mm", "Registration, synth GT"], ["621/621", "Frames registered"], ["9/10", "3D queries correct"], ["3.83", "GPA, MS in AI"]],
    "top3": [
      ["Language-grounded 3D Gaussian Splatting", "Text to CLIP-embedded 3DGS to XYZ targets for a SmolVLA planner on a physical AR4 arm. 29.60 dB / 0.952 SSIM / 0.078 LPIPS."],
      ["Sim-to-real geometric alignment", "Umeyama + robust ICP with FPFH+RANSAC, 0.46 mm on synthetic GT. Caught a 28° ICP failure. Merged to aegean-ai/ar4-physical-ai."],
      ["Open-vocabulary semantic 3D queries", "CLIP ViT-B/32 distilled into Gaussians: 9/10 correct 3D localizations, 4/5 open-vocabulary."]
    ]
  }
}
```

---

## 12. Assets Ayush needs to provide

- `resume.pdf` (current version)
- The portrait (already in the design, 800×800 crop)
- One visual per project (see `asset` in each project). 16:10, ideally a 4–6s silent MP4/WebM loop plus a poster JPG.
- Optional: a short clip of him playing football for the Fan Zone (his own footage only)
- Optional: CC0/licensed crowd, whistle and floodlight sounds
