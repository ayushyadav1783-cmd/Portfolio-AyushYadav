// Halftone placeholder per formation position (dot colour, dot pitch in px), from the desktop board.
// TODO(asset): replace with the real project visual named in content.json → projects[].asset.
export const art: Record<string, [string, number]> = {
  ST: ['rgba(245,197,66,.55)', 7],
  LW: ['rgba(246,243,236,.4)', 6],
  RW: ['rgba(255,74,61,.6)', 7],
  CAM: ['rgba(245,197,66,.45)', 5],
  CM: ['rgba(246,243,236,.35)', 8],
  CB: ['rgba(255,74,61,.45)', 6],
  GK: ['rgba(245,197,66,.4)', 9],
};
