import content from './content.json';
import copy from './copy.json';

export type Project = (typeof content.projects)[number];
export type PowerUp = (typeof content.powerups)[number];
export type Sticker = (typeof content.stickers)[number];

export { content, copy };

/** Projects keyed by formation position (LW, ST, RW, CAM, CM, CB, GK). */
export const byPos = Object.fromEntries(content.projects.map((p) => [p.pos, p])) as Record<string, Project>;

/** Formation rows, attackers first (spec §5.3: 1-1-2-3). */
export const formation: Project[][] = copy.xi.formation.map((row) => row.map((pos) => byPos[pos]));
