// Motion entry point. Content is fully rendered without this script; it only adds motion.
import { initScroll } from './scroll';
import { runIntro } from './intro';
import { initBroadcast } from './broadcast';
import { initReveals } from './reveals';
import { initScouting } from './scouting';
import { initStartingVII } from './starting7';
import { initPowerUps } from './powerups';
import { initFullTime } from './fulltime';
import { initShootout } from './shootout';
import { initFanZone } from './fanzone';
import { initHighlights } from './highlights';
import { initCardArt } from './cardart';
import { initTraining } from './training';
import { initCursor } from './cursor';
import { initMagnetic } from './magnetic';
import { finePointer, reducedMotion } from './env';

initScroll();
initReveals();
initScouting();
initStartingVII();
initPowerUps();
initFullTime();
initShootout();
initFanZone();
initHighlights();
initCardArt();
initTraining();
// The bar's clock and bugs start once the walkout is over; heavier extras load after it.
runIntro().then(() => {
  initBroadcast();
  if (!reducedMotion) {
    const hero = document.querySelector<HTMLElement>('[data-hero]');
    if (hero) import('./gl/sky').then((m) => m.startSky(hero, document.querySelector<HTMLElement>('[data-planet]')));
  }
  if (finePointer && !reducedMotion) {
    initCursor();
    initMagnetic();
  }
});
