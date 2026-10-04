// Motion entry point. Content is fully rendered without this script; it only adds motion.
import { initScroll } from './scroll';
import { runIntro } from './intro';
import { initBroadcast } from './broadcast';
import { initReveals } from './reveals';
import { initScouting } from './scouting';

initScroll();
initReveals();
initScouting();
// The bar's clock and bugs start once the walkout is over.
runIntro().then(initBroadcast);
