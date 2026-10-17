/**
 * Linear Matter Power Spectrum using Eisenstein & Hu (1998) zero-baryon approximation
 * with Syren (Bartlett et al. 2023) correction for baryon wiggles.
 * 
 * References:
 * - Eisenstein & Hu (1998), ApJ, 511, 5 (zero-baryon approximation)
 * - Bartlett et al. (2023), arXiv:2311.15865 (Syren emulator)
 * - Brieden, Gil-Marin & Verde (2021), arXiv:2106.07641 (ShapeFit)
 * - desilike shapefit-prime: https://github.com/dforero0896/desilike/tree/shapefit-prime
 */

const T_CMB = 2.7255; // CMB temperature [K]
const THETA_27 = T_CMB / 2.7;

export interface CosmoParams {
  omega_m: number;   // Total matter density Ω_m
  omega_b: number;   // Baryon density Ω_b
  h: number;         // Hubble parameter h = H₀/100
  n_s: number;       // Scalar spectral index
  sigma8: number;    // RMS fluctuation amplitude at 8 Mpc/h
}

export interface ShapeFitParams {
  dm: number;        // δm: log-slope of P_now at pivot
  dn: number;        // δn: spectral index shift
  dA: number;        // δA: amplitude at pivot
  deps: number;      // δε: broadband (equality) scale shift
  dgam: number;      // δγ: wiggle depth
  dc: number;        // δc: curvature of ln P at pivot
  df: number;        // δf: growth rate
  qpar: number;      // AP parallel
  qper: number;      // AP perpendicular
  kp: number;        // Pivot wavenumber [h/Mpc]
  a: number;         // Steepness parameter
}

export const DEFAULT_COSMO: CosmoParams = {
  omega_m: 0.3106,
  omega_b: 0.04922,
  h: 0.6766,
  n_s: 0.9665,
  sigma8: 0.8102,
};

export const DEFAULT_SHAPEFIT: ShapeFitParams = {
  dm: 0.0,
  dn: 0.0,
  dA: 1.0,
  deps: 0.0,
  dgam: 0.0,
  dc: 0.0,
  df: 1.0,
  qpar: 1.0,
  qper: 1.0,
  kp: 0.03,
  a: 0.6,
};

// ─── Eisenstein & Hu (1998) Zero-Baryon Transfer Function ────────────────────

/**
 * Compute the EH98 zero-baryon (no-wiggle) transfer function.
 * This is the smooth component without BAO wiggles.
 * 
 * k is in h/Mpc.
 */
function transferEH98NoWiggle(k: number[], cosmo: CosmoParams): number[] {
  const { omega_m, omega_b, h } = cosmo;
  const om0h2 = omega_m * h * h;
  const ombh2 = omega_b * h * h;
  const ombom0 = omega_b / omega_m;
  
  // Sound horizon scale [Mpc]
  const s = 44.5 * Math.log(9.83 / om0h2) / Math.sqrt(1.0 + 10.0 * Math.pow(ombh2, 0.75));
  
  // Alpha parameter for effective shape
  const alphaGamma = 1.0 - 0.328 * Math.log(431.0 * om0h2) * ombom0 +
                     0.38 * Math.log(22.3 * om0h2) * ombom0 * ombom0;
  
  return k.map(ki => {
    // Effective shape parameter (dimensionless)
    const Gamma = omega_m * h * (alphaGamma + (1.0 - alphaGamma) / 
                    (1.0 + Math.pow(0.43 * ki * h * s, 4)));
    
    // Dimensionless wavenumber
    const q = ki * THETA_27 * THETA_27 / Gamma;
    
    // Transfer function
    const C0 = 14.2 + 731.0 / (1.0 + 62.5 * q);
    const L0 = Math.log(2.0 * Math.E + 1.8 * q);
    const tk = L0 / (L0 + C0 * q * q);
    
    return tk;
  });
}

// ─── Syren Correction for Baryon Wiggles ─────────────────────────────────────

/**
 * Compute the Syren (Bartlett et al. 2023) correction factor logF.
 * This adds the BAO wiggles and other baryonic effects to the no-wiggle spectrum.
 * 
 * P_lin(k) = P_EH_noWiggle(k) * exp(logF(k))
 */
function syrenLogF(k: number[], cosmo: CosmoParams): number[] {
  const { omega_m, omega_b, h } = cosmo;
  const Om = omega_m;
  const Ob = omega_b;
  
  // Syren fiducial coefficients (from Bartlett et al. 2023)
  const b = [0.05448654, 0.00379, 0.0396711937097927, 0.127733431568858, 1.35,
             4.053543862744234, 0.0008084539054750851, 1.8852431049189666,
             0.11418372931475675, 3.798, 14.909, 5.56, 15.8274343004709, 0.0230755621512691,
             0.86531976, 0.8425442636372944, 4.553956000000005, 5.116999999999995,
             70.0234239999998, 0.01107, 5.35, 6.421, 134.309, 5.324, 21.532,
             4.741999999999985, 16.68722499999999, 3.078, 16.987, 0.05881491,
             0.0006864690561825617, 195.498, 0.0038454457516892, 0.276696018851544,
             7.385, 12.3960625361899, 0.0134114370723638];
  
  return k.map(ki => {
    const line1 = b[0] * h - b[1];
    
    const line2 = (
      Math.pow((Ob * b[2]) / Math.sqrt(h * h + b[3]), b[4] * Om) *
      (
        (b[5] * ki - Ob) / Math.sqrt(b[6] + Math.pow(Ob - b[7] * ki, 2)) *
        b[8] * Math.pow(b[9] * ki, -b[10] * ki) * Math.cos(Om * b[11] - (b[12] * ki) / Math.sqrt(b[13] + Ob * Ob))
        - b[14] * ((b[15] * ki) / Math.sqrt(1 + b[16] * ki * ki) - Om) *
        Math.cos(b[17] * h / Math.sqrt(1 + b[18] * ki * ki))
      )
    );
    
    const line3 = (
      b[19] * (b[20] * Om + b[21] * h - Math.log(b[22] * ki) +
      Math.pow(b[23] * ki, -b[24] * ki)) * Math.cos(b[25] / Math.sqrt(1 + b[26] * ki * ki))
    );
    
    const line4 = (
      Math.pow(b[27] * ki, -b[28] * ki) * (b[29] * ki - (b[30] * Math.log(b[31] * ki)) /
      Math.sqrt(b[32] + Math.pow(Om - b[33] * h, 2))) *
      Math.cos(Om * b[34] - (b[35] * ki) / Math.sqrt(Ob * Ob + b[36]))
    );
    
    return line1 + line2 + line3 + line4;
  });
}

// ─── Power Spectrum Computation ──────────────────────────────────────────────

/**
 * Compute the linear matter power spectrum using EH98 + Syren.
 * P(k) = A * k^n_s * T(k)^2 * exp(logF(k))
 * 
 * Normalized to match sigma8.
 */
function computeLinearPk(k: number[], cosmo: CosmoParams): number[] {
  const { n_s, sigma8 } = cosmo;
  
  // Get transfer function and Syren correction
  const T_nw = transferEH98NoWiggle(k, cosmo);
  const logF = syrenLogF(k, cosmo);
  
  // Unnormalized P(k) = k^n_s * T^2 * exp(logF)
  const pk_unnorm = k.map((ki, i) => 
    Math.pow(ki, n_s) * T_nw[i] * T_nw[i] * Math.exp(logF[i])
  );
  
  // Compute sigma8 from unnormalized P(k)
  const R = 8.0; // Mpc/h
  const s8sq = sigma8Squared(k, pk_unnorm, R);
  
  // Normalize to match sigma8
  const norm = (sigma8 * sigma8) / s8sq;
  return pk_unnorm.map(p => p * norm);
}

/**
 * Compute sigma8^2 = 1/(2pi^2) * integral k^2 P(k) W^2(kR) dk
 */
function sigma8Squared(k: number[], pk: number[], R: number): number {
  let integral = 0;
  for (let i = 0; i < k.length - 1; i++) {
    const k1 = k[i], k2 = k[i + 1];
    const p1 = pk[i], p2 = pk[i + 1];
    const w1 = windowFunc(k1 * R);
    const w2 = windowFunc(k2 * R);
    const f1 = k1 * k1 * p1 * w1 * w1;
    const f2 = k2 * k2 * p2 * w2 * w2;
    integral += 0.5 * (f1 + f2) * (k2 - k1);
  }
  return integral / (2 * Math.PI * Math.PI);
}

/**
 * Spherical top-hat window function W(x) = 3(sin(x) - x*cos(x))/x^3
 */
function windowFunc(x: number): number {
  if (x < 1e-4) return 1 - x * x / 10;
  return 3 * (Math.sin(x) - x * Math.cos(x)) / (x * x * x);
}

// ─── Growth Factor ──────────────────────────────────────────────────────────

/**
 * Linear growth factor D(z) normalized to D(0) = 1, using Carroll et al. (1992).
 */
function growthD(z: number, omega_m: number): number {
  const omega_l = 1 - omega_m; // flat
  const a = 1 / (1 + z);
  const Omz = omega_m * Math.pow(1 + z, 3) / (omega_m * Math.pow(1 + z, 3) + omega_l);
  const Olz = omega_l / (omega_m * Math.pow(1 + z, 3) + omega_l);
  const Dz = (5 / 2) * Omz / (Math.pow(Omz, 4/7) - Olz + (1 + Omz/2) * (1 + Olz/70));
  const D0 = (() => {
    const Om0 = omega_m;
    const Ol0 = omega_l;
    return (5/2) * Om0 / (Math.pow(Om0, 4/7) - Ol0 + (1 + Om0/2) * (1 + Ol0/70));
  })();
  return (Dz * a) / D0;
}

/**
 * Growth rate f(z) ≈ Omega_m(z)^0.55
 */
function growthRateF(z: number, omega_m: number): number {
  const omega_l = 1 - omega_m;
  const Omz = omega_m * Math.pow(1 + z, 3) / (omega_m * Math.pow(1 + z, 3) + omega_l);
  return Math.pow(Omz, 0.55);
}

// ─── ShapeFit Template ──────────────────────────────────────────────────────

/**
 * Apply the ShapeFit template to modify the fiducial power spectrum.
 * 
 * From desilike/theories/galaxy_clustering/template.py (ShapeFitSpectrum2Template):
 * 
 * P_now(k) -> dA * P_now(k*e^{-deps}) * tilt(k)
 * P(k) = P_now(k) * [W(k)]^(1 + dgam)
 * 
 * where tilt(k) = exp[dm/a * tanh(a*ln(k/kp)) + dn*ln(k/kp) + dc/(2a^2) * tanh^2(a*ln(k/kp))]
 * and W(k) = P_fid(k) / P_now_fid(k)
 */
function applyShapeFit(
  k: number[],
  pk_fid: number[],
  pknow_fid: number[],
  sf: ShapeFitParams
): { pk: number[]; pknow: number[] } {
  const { dm, dn, dc, deps, dgam, dA, kp, a } = sf;
  
  // Compute modified no-wiggle spectrum
  const pknow = k.map((ki, i) => {
    const logRatio = Math.log(ki / kp);
    const tanhVal = Math.tanh(a * logRatio);
    
    // Tilt factor
    const tilt = Math.exp(
      (dm / a) * tanhVal +
      dn * logRatio +
      (dc / (2 * a * a)) * tanhVal * tanhVal
    );
    
    // Broadband dilation: evaluate pknow_fid at k*exp(-deps)
    const k_shifted = ki * Math.exp(-deps);
    const pknow_shifted = interpLog(k, pknow_fid, k_shifted);
    const broadbandRatio = pknow_shifted / pknow_fid[i];
    
    return pknow_fid[i] * dA * tilt * broadbandRatio;
  });
  
  // Apply wiggle factor
  const pk = k.map((ki, i) => {
    const logWiggle = Math.log(pk_fid[i] / pknow_fid[i]);
    return pknow[i] * Math.exp((1 + dgam) * logWiggle);
  });
  
  return { pk, pknow };
}

/**
 * Interpolate in log-log space
 */
function interpLog(x: number[], y: number[], x_target: number): number {
  if (x_target <= x[0]) return y[0];
  if (x_target >= x[x.length - 1]) return y[y.length - 1];
  
  let lo = 0, hi = x.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (x[mid] <= x_target) lo = mid;
    else hi = mid;
  }
  
  const t = (Math.log(x_target) - Math.log(x[lo])) / (Math.log(x[hi]) - Math.log(x[lo]));
  return Math.exp(Math.log(y[lo]) + t * (Math.log(y[hi]) - Math.log(y[lo])));
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface PowerSpectrumResult {
  k: number[];
  pk_fid: number[];
  pknow_fid: number[];
  pk: number[];
  pknow: number[];
  kPk_fid: number[];
  kPk: number[];
  kPk3_fid: number[];
  kPk3: number[];
  f: number;
  sigma8_z: number;
}

export function generateKGrid(kmin = 0.005, kmax = 0.5, n = 400): number[] {
  const k: number[] = [];
  const lmin = Math.log10(kmin);
  const lmax = Math.log10(kmax);
  for (let i = 0; i < n; i++) {
    k.push(Math.pow(10, lmin + i * (lmax - lmin) / (n - 1)));
  }
  return k;
}

export function computePowerSpectrum(
  cosmo: CosmoParams,
  shapefit: ShapeFitParams,
  z: number = 0.0
): PowerSpectrumResult {
  // Focus on k = 0.02 to 0.5 as requested, with some padding
  const k = generateKGrid(0.005, 0.5, 500);
  
  // Compute fiducial no-wiggle spectrum (EH98 zero-baryon)
  const T_nw_fid = transferEH98NoWiggle(k, cosmo);
  const pknow_fid_z0 = k.map((ki, i) => Math.pow(ki, cosmo.n_s) * T_nw_fid[i] * T_nw_fid[i]);
  
  // Normalize no-wiggle to sigma8
  const s8sq_nw = sigma8Squared(k, pknow_fid_z0, 8.0);
  const norm_nw = (cosmo.sigma8 * cosmo.sigma8) / s8sq_nw;
  const pknow_fid_z0_norm = pknow_fid_z0.map(p => p * norm_nw);
  
  // Compute full fiducial spectrum with Syren correction
  const pk_fid_z0 = computeLinearPk(k, cosmo);
  
  // Apply ShapeFit template at z=0
  const { pk: pk_z0, pknow: pknow_z0 } = applyShapeFit(k, pk_fid_z0, pknow_fid_z0_norm, shapefit);
  
  // Scale to redshift z
  const Dz = growthD(z, cosmo.omega_m);
  const Dz2 = Dz * Dz;
  
  const pk_fid = pk_fid_z0.map(p => p * Dz2);
  const pknow_fid = pknow_fid_z0_norm.map(p => p * Dz2);
  const pk = pk_z0.map(p => p * Dz2);
  const pknow = pknow_z0.map(p => p * Dz2);
  
  // Growth rate (modified by ShapeFit df and dA)
  const f0 = growthRateF(z, cosmo.omega_m);
  const f = f0 * shapefit.df / Math.sqrt(shapefit.dA);
  
  // sigma8 at z
  const sigma8_z = cosmo.sigma8 * Dz;
  
  return {
    k,
    pk_fid,
    pknow_fid,
    pk,
    pknow,
    kPk_fid: k.map((ki, i) => ki * pk_fid[i]),
    kPk: k.map((ki, i) => ki * pk[i]),
    kPk3_fid: k.map((ki, i) => ki * ki * ki * pk_fid[i] / (2 * Math.PI * Math.PI)),
    kPk3: k.map((ki, i) => ki * ki * ki * pk[i] / (2 * Math.PI * Math.PI)),
    f,
    sigma8_z,
  };
}
