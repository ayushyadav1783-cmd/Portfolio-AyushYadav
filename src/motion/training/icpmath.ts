// Point-cloud registration maths for the VAR Alignment drill (pure functions, no DOM).
// Horn's closed-form absolute orientation (quaternion), similarity scale, brute-force nearest
// neighbours, RANSAC plane fit, and a gravity-constrained (yaw + scale + translation) solver.
export type V3 = [number, number, number];
export type M3 = [number, number, number, number, number, number, number, number, number]; // row-major
export type Sim = { s: number; R: M3; t: V3 };

export const I3: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
export const apply = (T: Sim, p: V3): V3 => {
  const [a, b, c, d, e, f, g, h, i] = T.R;
  return [T.s * (a * p[0] + b * p[1] + c * p[2]) + T.t[0], T.s * (d * p[0] + e * p[1] + f * p[2]) + T.t[1], T.s * (g * p[0] + h * p[1] + i * p[2]) + T.t[2]];
};
export const mulM = (A: M3, B: M3): M3 => {
  const r = new Array(9).fill(0) as M3;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += A[i * 3 + k] * B[k * 3 + j];
  return r;
};
export const mulMV = (A: M3, v: V3): V3 => [A[0] * v[0] + A[1] * v[1] + A[2] * v[2], A[3] * v[0] + A[4] * v[1] + A[5] * v[2], A[6] * v[0] + A[7] * v[1] + A[8] * v[2]];
/** Compose: apply B, then A. */
export const compose = (A: Sim, B: Sim): Sim => ({ s: A.s * B.s, R: mulM(A.R, B.R), t: apply(A, B.t) });
export const rotX = (a: number): M3 => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
export const rotY = (a: number): M3 => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
export const mean = (P: V3[]): V3 => { const m: V3 = [0, 0, 0]; for (const p of P) { m[0] += p[0]; m[1] += p[1]; m[2] += p[2]; } return [m[0] / P.length, m[1] / P.length, m[2] / P.length]; };
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V3): V3 => { const n = norm(a) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };

/** Rotation angle (degrees) of a rotation matrix. */
export const angleOf = (R: M3) => (Math.acos(Math.max(-1, Math.min(1, (R[0] + R[4] + R[8] - 1) / 2))) * 180) / Math.PI;
/** Angle (degrees) between two vectors. */
export const angleBetween = (a: V3, b: V3) => (Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) * 180) / Math.PI;

/** Jacobi eigen-decomposition of a symmetric 4x4. Returns the eigenvector of the largest eigenvalue. */
function maxEigVec4(A: number[][]): number[] {
  const a = A.map((r) => [...r]);
  const V = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < 4; p++) for (let q = p + 1; q < 4; q++) off += a[p][q] * a[p][q];
    if (off < 1e-18) break;
    for (let p = 0; p < 4; p++) for (let q = p + 1; q < 4; q++) {
      if (Math.abs(a[p][q]) < 1e-15) continue;
      const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const tt = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(tt * tt + 1), s = tt * c;
      for (let k = 0; k < 4; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
      for (let k = 0; k < 4; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
      for (let k = 0; k < 4; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
    }
  }
  let best = 0;
  for (let i = 1; i < 4; i++) if (a[i][i] > a[best][best]) best = i;
  return [V[0][best], V[1][best], V[2][best], V[3][best]];
}

/** Horn (1987) closed-form similarity: finds s, R, t minimising Σ |b - (sRa + t)|². */
export function horn(A: V3[], B: V3[]): Sim {
  const ma = mean(A), mb = mean(B);
  let Sxx = 0, Sxy = 0, Sxz = 0, Syx = 0, Syy = 0, Syz = 0, Szx = 0, Szy = 0, Szz = 0, na = 0;
  for (let i = 0; i < A.length; i++) {
    const a = sub(A[i], ma), b = sub(B[i], mb);
    Sxx += a[0] * b[0]; Sxy += a[0] * b[1]; Sxz += a[0] * b[2];
    Syx += a[1] * b[0]; Syy += a[1] * b[1]; Syz += a[1] * b[2];
    Szx += a[2] * b[0]; Szy += a[2] * b[1]; Szz += a[2] * b[2];
    na += dot(a, a);
  }
  const N = [
    [Sxx + Syy + Szz, Syz - Szy, Szx - Sxz, Sxy - Syx],
    [Syz - Szy, Sxx - Syy - Szz, Sxy + Syx, Szx + Sxz],
    [Szx - Sxz, Sxy + Syx, -Sxx + Syy - Szz, Syz + Szy],
    [Sxy - Syx, Szx + Sxz, Syz + Szy, -Sxx - Syy + Szz],
  ];
  const [w, x, y, z] = maxEigVec4(N);
  const R: M3 = [
    w * w + x * x - y * y - z * z, 2 * (x * y - w * z), 2 * (x * z + w * y),
    2 * (x * y + w * z), w * w - x * x + y * y - z * z, 2 * (y * z - w * x),
    2 * (x * z - w * y), 2 * (y * z + w * x), w * w - x * x - y * y + z * z,
  ];
  let num = 0;
  for (let i = 0; i < A.length; i++) num += dot(sub(B[i], mb), mulMV(R, sub(A[i], ma)));
  const s = na > 0 ? num / na : 1;
  const Rma = mulMV(R, ma);
  return { s, R, t: [mb[0] - s * Rma[0], mb[1] - s * Rma[1], mb[2] - s * Rma[2]] };
}

/** Brute-force nearest neighbours of `src` points into `dst`; returns indices and RMSE. */
export function nearest(src: V3[], dst: V3[]) {
  const idx = new Array<number>(src.length);
  let se = 0;
  for (let i = 0; i < src.length; i++) {
    const p = src[i];
    let best = 0, bd = Infinity;
    for (let j = 0; j < dst.length; j++) {
      const q = dst[j];
      const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
      if (d < bd) { bd = d; best = j; }
    }
    idx[i] = best; se += bd;
  }
  return { idx, rmse: Math.sqrt(se / src.length) };
}

/** One unconstrained 7-DOF ICP iteration. Returns the updated estimate and the RMSE before the step. */
export function icpStep(src: V3[], dst: V3[], T: Sim) {
  const moved = src.map((p) => apply(T, p));
  const { idx, rmse } = nearest(moved, dst);
  const step = horn(moved, idx.map((j) => dst[j]));
  return { T: compose(step, T), rmse };
}

/** RANSAC plane fit on P. Returns a unit normal oriented towards the majority of `orientBy` (e.g. the whole cloud). */
export function ransacPlane(P: V3[], rnd: () => number, iters = 120, thr = 0.02, orientBy: V3[] = P): V3 {
  let best: V3 = [0, 1, 0], bestIn = -1, bestD = 0;
  for (let k = 0; k < iters; k++) {
    const a = P[Math.floor(rnd() * P.length)], b = P[Math.floor(rnd() * P.length)], c = P[Math.floor(rnd() * P.length)];
    const n = unit(cross(sub(b, a), sub(c, a)));
    if (!Number.isFinite(n[0]) || norm(n) < 0.5) continue;
    const d = dot(n, a);
    let inl = 0;
    for (const p of P) if (Math.abs(dot(n, p) - d) < thr) inl++;
    if (inl > bestIn) { bestIn = inl; best = n; bestD = d; }
  }
  let above = 0;
  for (const p of orientBy) above += Math.sign(dot(best, p) - bestD);
  return above >= 0 ? best : [-best[0], -best[1], -best[2]];
}

/** Rotation taking unit vector a onto unit vector b (Rodrigues). */
export function alignVectors(a: V3, b: V3): M3 {
  const v = cross(a, b), c = dot(a, b);
  if (c < -0.9999) return rotX(Math.PI);
  const k = 1 / (1 + c);
  return [
    v[0] * v[0] * k + c, v[0] * v[1] * k - v[2], v[0] * v[2] * k + v[1],
    v[1] * v[0] * k + v[2], v[1] * v[1] * k + c, v[1] * v[2] * k - v[0],
    v[2] * v[0] * k - v[1], v[2] * v[1] * k + v[0], v[2] * v[2] * k + c,
  ];
}

/** Closed-form yaw (about +Y) + scale + translation between matched, already-levelled point sets. */
export function yawScaleTrans(A: V3[], B: V3[]): Sim {
  const ma = mean(A), mb = mean(B);
  let sc = 0, ss = 0, na = 0;
  for (let i = 0; i < A.length; i++) {
    const a = sub(A[i], ma), b = sub(B[i], mb);
    sc += a[0] * b[0] + a[2] * b[2];
    ss += a[2] * b[0] - a[0] * b[2];
    na += dot(a, a);
  }
  const th = Math.atan2(ss, sc);
  const R = rotY(th);
  let num = 0;
  for (let i = 0; i < A.length; i++) num += dot(sub(B[i], mb), mulMV(R, sub(A[i], ma)));
  const s = na > 0 ? num / na : 1;
  const Rma = mulMV(R, ma);
  return { s, R, t: [mb[0] - s * Rma[0], mb[1] - s * Rma[1], mb[2] - s * Rma[2]] };
}

/** One gravity-constrained iteration (yaw + scale + translation only). */
export function constrainedStep(src: V3[], dst: V3[], T: Sim) {
  const moved = src.map((p) => apply(T, p));
  const { idx, rmse } = nearest(moved, dst);
  const step = yawScaleTrans(moved, idx.map((j) => dst[j]));
  return { T: compose(step, T), rmse };
}
