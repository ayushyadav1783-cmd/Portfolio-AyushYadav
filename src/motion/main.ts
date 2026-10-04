// Motion entry point. Content is fully rendered without this script; it only adds motion.
import { initScroll } from './scroll';
import { initBroadcast } from './broadcast';
import { initReveals } from './reveals';

initScroll();
initReveals();
initBroadcast();
