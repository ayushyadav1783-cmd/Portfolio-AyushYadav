import content from './content.json';
import copy from './copy.json';
import reposJson from './repos.json';

export type Repo = { url?: string; label: string; private?: boolean };
export const repos = reposJson as unknown as Record<string, Repo>;

export type Project = (typeof content.projects)[number];
export type PowerUp = (typeof content.powerups)[number];
export type Sticker = (typeof content.stickers)[number];

export { content, copy };

/** Prefix a root path ('/resume.pdf') with the deploy base (GitHub Pages serves under /Portfolio-AyushYadav). */
export const withBase = (path: string) => `${import.meta.env.BASE_URL.replace(/\/$/, '')}${path}`;
export const resumeUrl = withBase(content.person.resume);

/** Projects keyed by formation position (LW, ST, RW, CAM, CM, CB, GK). */
export const byPos = Object.fromEntries(content.projects.map((p) => [p.pos, p])) as Record<string, Project>;

/** Formation rows, attackers first (spec §5.3: 1-1-2-3). */
export const formation: Project[][] = copy.xi.formation.map((row) => row.map((pos) => byPos[pos]));
