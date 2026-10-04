# CLAUDE.md: Ayush Yadav portfolio ("Match Day")

## HARD RULES (never break these)

- Copy every project, number, date, and line of text from the spec's content.json verbatim. Never invent, round, or "improve" a metric or a sentence.
- Never display the phone number anywhere: markup, metadata, OG tags, console, or link text. The resume PDF contains it, which is fine, but nothing on the site itself.
- No characters, crests, logos, or likenesses of Real Madrid, Ronaldo, Naruto, One Piece, Spider-Man, Iron Man, or anyone else. Fandoms appear as words and original shapes only, as the spec says.
- `prefers-reduced-motion` gets full content with fades only. Touch devices get no custom cursor, magnetic effect, Lenis, or physics.
- Real HTML text for all content (not canvas). Hit the spec's budgets: LCP < 2.5s on 4G, CLS < 0.05, first-load JS < 200kb gz. Lazy-load OGL, matter-js, and Howler after the intro.
- Where a real project visual doesn't exist yet, use the halftone placeholder and list it as a TODO. Never use stock images.
- Serve `assets/resume.pdf` as `/resume.pdf` and use `assets/portrait.png` in the portrait slot.
- Never read, modify, or delete anything in `~/Downloads` (one-off exception: Ayush approved copying `Ayush_Yadav_Resume_MASTER_FINAL.tex` on 2026-10-03).

## Sources of truth

1. `MATCH_DAY_BUILD_SPEC.md`: behavior, copy, tokens, motion, content.json.
2. `design/boards/*.html`: how each screen looks (extracted from `design/Ayush Yadav Portfolio.html`).
3. If any skill suggests different styles, colors, or fonts, the spec and design win. Every time.
4. If the spec is ambiguous, contradicts the design, or would blow the performance budget: stop and ask Ayush.

## Approved changes to the spec

Ayush changed these after the spec was written. They're applied in the spec, content.json and copy.json:
- GitHub is https://github.com/ayushyadav1783-cmd (2026-10-03).
- The hero resume CTA reads `Resume` (no "1 page, I promise"), and Resume links open the Scouting Report overlay (spec §8.1) instead of the raw PDF (2026-10-03).
- The Scouting Report never embeds the PDF (it contains the phone number); it shows a summary card and links to the PDF (2026-10-03).
- Starting VII: cards on the pitch from the start (no run-out); the fitted pitch tilts up while scrolling in, then a 40vh pin holds and zooms to 100% (2026-10-04).
- Full Time: the chat is replaced by a penalty shootout → transfer bid (spec §5.6 note) (2026-10-04).
- Fan Zone: each sticker gets its own signature full-screen trick on click (2026-10-04).
- Hero: no walkout pin; parallax-only exit. Rule from Ayush: no useless scrolls, no black or plain screens anywhere (2026-10-04).
- Training Ground section with five live drills (spec §5.4b); cards show animated project illustrations; reports link to code (repos.json) (2026-10-04).
- `resume/resume.tex` is the resume source (copied from MASTER_FINAL.tex). Rebuild `assets/resume.pdf` from it; see resume/README.md.

## Fixed decisions (do not reopen)

- Astro + React islands, TypeScript, deployed on Vercel. Not Next.js.
- GSAP 3 (ScrollTrigger, SplitText, Flip) + Lenis. No Framer Motion or any second animation library.
- OGL only, one shared renderer. No three.js / R3F in v1.
- matter-js, desktop only. Howler, off by default, built last.
- CSS custom properties from spec section 3, copied exactly. No framework defaults overriding the tokens.

## Workflow

Build one phase at a time (phases are listed in the plan / README). After each phase: run the dev server, check 1440px and 390px, run a production build, fix errors, commit, give a 3-line summary plus what to look at, then wait for "next".
