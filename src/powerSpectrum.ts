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

// ─── SYREN-HALOFIT Nonlinear Power Spectrum ─────────────────────────────────

/**
 * Compute nonlinear power spectrum using SYREN-HALOFIT (Bartlett et al. 2024)
 * Based on arXiv:2402.17492
 */
function computeNonlinearPk(k: number[], cosmo: CosmoParams, z: number): number[] {
  const a = 1 / (1 + z);
  
  // Compute halofit parameters
  const ksigma = ksigma_emulated(cosmo.sigma8, cosmo.omega_m, cosmo.omega_b, cosmo.h, cosmo.n_s, a);
  const neff = neff_emulated(cosmo.sigma8, cosmo.omega_m, cosmo.omega_b, cosmo.h, cosmo.n_s, a);
  const C = C_emulated(cosmo.sigma8, cosmo.omega_m, cosmo.omega_b, cosmo.h, cosmo.n_s, a);
  
  // Get linear P(k) at redshift z
  const pk_lin_z0 = computeLinearPk(k, cosmo);
  const Dz = growthD(z, cosmo.omega_m);
  const pk_lin_z = pk_lin_z0.map(p => p * Dz * Dz);
  
  // Bartlett et al. 2024 halofit parameters
  const pars = [1.5358, 2.8533, 2.3692, 0.9916, 0.2244, 0.5862, -0.565, 0.5871,
                0.5757, -1.505, 0.3913, 2.0252, 0.7971, 0.5989, 0.2216, -0.001,
                1.1771, 5.2082, 3.7324, -0.0158, -0.0972, 0.155, 6.1043, 1.3408,
                -0.2138, -5.325, 1.9967, -0.7176, 0.3108, 1.2477, 0.4018, -0.3837];
  
  const y = k.map(ki => ki / ksigma);
  
  // 1-halo term parameters
  const an = Math.pow(10, pars[0] + pars[1] * neff + pars[2] * neff**2 + pars[3] * neff**3 + pars[4] * neff**4 - pars[5] * C);
  const bn = Math.pow(10, pars[6] + pars[7] * neff + pars[8] * neff**2 + pars[9] * C);
  const cn = Math.pow(10, pars[10] + pars[11] * neff + pars[12] * neff**2 + pars[13] * C);
  const gamma = pars[14] + pars[15] * neff + pars[16] * C;
  const nu = Math.pow(10, pars[17] + pars[18] * neff);
  
  const Omz = cosmo.omega_m / (a**3) / (cosmo.omega_m / (a**3) + 1 - cosmo.omega_m);
  const f1 = Math.pow(Omz, pars[19]);
  const f2 = Math.pow(Omz, pars[20]);
  const f3 = Math.pow(Omz, pars[21]);
  
  // 2-halo term parameters
  const alpha = Math.abs(pars[22] + pars[23] * neff + pars[24] * neff**2 + pars[25] * C);
  const beta = pars[26] + pars[27] * neff + pars[28] * neff**2 + pars[29] * neff**3 + pars[30] * neff**4 + pars[31] * C;
  
  // Compute 1-halo and 2-halo terms
  const pk_nl = k.map((ki, i) => {
    const yi = y[i];
    
    // 1-halo term
    const deltaH2 = an * Math.pow(yi, 3 * f1) / (1 + bn * Math.pow(yi, f2) + Math.pow(cn * f3 * yi, 3 - gamma));
    const deltaH2_final = deltaH2 / (1 + nu / (yi**2));
    const ph = deltaH2_final * (2 * Math.PI**2) / (ki**3);
    
    // 2-halo term
    const deltaL2 = (ki**3) * pk_lin_z[i] / (2 * Math.PI**2);
    const pq = pk_lin_z[i] * Math.pow(1 + deltaL2, beta) / (1 + alpha * deltaL2) * Math.exp(-yi/4 - (yi**2)/8);
    
    // Total
    let p_nl = ph + pq;
    
    // Apply SYREN correction (1 + A)
    const A = A_emulated(ki, cosmo.sigma8, cosmo.omega_m, cosmo.omega_b, cosmo.h, cosmo.n_s, a, ksigma, neff, C);
    p_nl *= (1 + A);
    
    return p_nl;
  });
  
  return pk_nl;
}

/**
 * Emulate nonlinear scale k_sigma (Bartlett et al. 2024)
 */
function ksigma_emulated(sigma8: number, Om: number, Ob: number, h: number, ns: number, a: number): number {
  const c = [4.35761588, 0.83576576, 0.43023897, 20.107738, 0.259285, 0.573205,
             1.680897, 20.043272, 0.425699, 0.39078063];
  const ksigma = (
    c[0] * (a * c[1] * (c[2] - sigma8) +
            Math.pow(c[3] * a, -c[4] * a - c[5] * ns) *
            (c[6] * Ob + Math.pow(c[7] * Om, -c[8] * h))) /
    (sigma8 * (a + c[9] * ns))
  );
  return Math.exp(ksigma);
}

/**
 * Emulate effective spectral index n_eff (Bartlett et al. 2024)
 */
function neff_emulated(sigma8: number, Om: number, Ob: number, h: number, ns: number, a: number): number {
  const theta = [1.65139294, 4.88150280, 0.51249900, 0.14884800,
                 15.6499400, 0.23930700, 0.13463100];
  return (theta[0] * ns - theta[1]) * (theta[2] * Ob - theta[3] * h +
         Math.pow(theta[4] * a, -theta[5] * Om - theta[6] * sigma8));
}

/**
 * Emulate curvature C (Bartlett et al. 2024)
 */
function C_emulated(sigma8: number, Om: number, Ob: number, h: number, ns: number, a: number): number {
  const b = [0.335853, 1.42946178682748, 0.115256188211481, 0.057211, 48.072159, 0.194058,
             1.176006, 1.015136, 0.235398, 0.359587, 2.389843, 0.356875, 0.443138];
  return (b[0] * sigma8 - b[1] * Math.sqrt(b[2] * ns + sigma8 * (b[3] * h +
         Math.pow(b[4] * Om, b[5] * a) - b[6])) * (b[7] * Ob + b[8] * a + b[9] * sigma8 -
         Math.pow(b[10] * h, b[11] * Om)) - b[12]);
}

/**
 * SYREN correction factor A (Bartlett et al. 2024)
 */
function A_emulated(k: number, sigma8: number, Om: number, Ob: number, h: number, ns: number, a: number,
                    ksigma: number, neff: number, C: number): number {
  const y = k / ksigma;
  
  const d = [0.0, 0.2011, 1.2983, 16.8733, 3.6428, 1.0622, 0.1023, 2.2204,
             0.0105, 0.487, 0.6151, 0.3377, 3.315, 3.9819, 1.3572, 3.3259,
             0.3872, 4.1175, 2.6795, 5.3394, 0.0338];
  
  return (d[0] - d[1] / Math.sqrt(1 + Math.pow(d[2] * y, -d[3] * C)) *
         (y - d[4] * (y - d[5] * ns) / Math.sqrt(Math.pow(y - d[6] * Math.log(d[7] * C), 2) + d[8]) +
          d[9] * neff / Math.sqrt(d[10] + sigma8**2) / Math.sqrt(Math.pow(d[11] * y - Math.cos(d[12] * neff), 2) + 1) +
          (d[13] + d[14] * neff - d[15] * C - d[16] * y) * (d[17] * neff + d[18] * y + Math.cos(d[19] * neff)) /
          Math.sqrt(y**2 + d[20])));
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface PowerSpectrumResult {
  k: number[];
  pk_fid: number[];
  pknow_fid: number[];
  pk: number[];
  pknow: number[];
  pk_nl_fid: number[];  // Nonlinear fiducial
  pk_nl: number[];      // Nonlinear with ShapeFit
  kPk_fid: number[];
  kPk: number[];
  kPk_nl_fid: number[];
  kPk_nl: number[];
  kPk3_fid: number[];
  kPk3: number[];
  kPk3_nl_fid: number[];
  kPk3_nl: number[];
  r: number[];
  xi_fid: number[];
  xi: number[];
  xi_nl_fid: number[];
  xi_nl: number[];
  k_bispectrum: number[];
  bispectrum_fid: number[];
  bispectrum: number[];
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
  
  // Compute nonlinear spectra
  const pk_nl_fid_z0 = computeNonlinearPk(k, cosmo, 0.0);
  const { pk: pk_nl_z0 } = applyShapeFit(k, pk_nl_fid_z0, pknow_fid_z0_norm, shapefit);
  const pk_nl_fid = pk_nl_fid_z0.map(p => p * Dz2);
  const pk_nl = pk_nl_z0.map(p => p * Dz2);
  
  // Growth rate (modified by ShapeFit df and dA)
  const f0 = growthRateF(z, cosmo.omega_m);
  const f = f0 * shapefit.df / Math.sqrt(shapefit.dA);
  
  // sigma8 at z
  const sigma8_z = cosmo.sigma8 * Dz;
  
  // Compute correlation functions using extended k-grid
  // Need much higher k_max for accurate Hankel transform
  const k_xi = generateKGrid(0.0001, 10.0, 1000);
  
  // Interpolate power spectra to extended k-grid
  const pk_fid_xi = interpolatePowerSpectrum(k, pk_fid, k_xi);
  const pk_xi = interpolatePowerSpectrum(k, pk, k_xi);
  const pk_nl_fid_xi = interpolatePowerSpectrum(k, pk_nl_fid, k_xi);
  const pk_nl_xi = interpolatePowerSpectrum(k, pk_nl, k_xi);
  
  const r = generateRGrid(1, 200, 200);
  const xi_fid = computeCorrelationFunction(k_xi, pk_fid_xi, r);
  const xi = computeCorrelationFunction(k_xi, pk_xi, r);
  const xi_nl_fid = computeCorrelationFunction(k_xi, pk_nl_fid_xi, r);
  const xi_nl = computeCorrelationFunction(k_xi, pk_nl_xi, r);
  
  // Compute tree-level bispectrum for isosceles right triangle (k1, k1, k1*√2)
  const k_bispectrum = generateKGrid(0.01, 0.3, 100);
  const bispectrum_fid = computeTreeLevelBispectrum(k_bispectrum, pk_fid, 1.0, Math.sqrt(2));
  const bispectrum = computeTreeLevelBispectrum(k_bispectrum, pk, 1.0, Math.sqrt(2));
  
  return {
    k,
    pk_fid,
    pknow_fid,
    pk,
    pknow,
    pk_nl_fid,
    pk_nl,
    kPk_fid: k.map((ki, i) => ki * pk_fid[i]),
    kPk: k.map((ki, i) => ki * pk[i]),
    kPk_nl_fid: k.map((ki, i) => ki * pk_nl_fid[i]),
    kPk_nl: k.map((ki, i) => ki * pk_nl[i]),
    kPk3_fid: k.map((ki, i) => ki * ki * ki * pk_fid[i] / (2 * Math.PI * Math.PI)),
    kPk3: k.map((ki, i) => ki * ki * ki * pk[i] / (2 * Math.PI * Math.PI)),
    kPk3_nl_fid: k.map((ki, i) => ki * ki * ki * pk_nl_fid[i] / (2 * Math.PI * Math.PI)),
    kPk3_nl: k.map((ki, i) => ki * ki * ki * pk_nl[i] / (2 * Math.PI * Math.PI)),
    r,
    xi_fid,
    xi,
    xi_nl_fid,
    xi_nl,
    k_bispectrum,
    bispectrum_fid,
    bispectrum,
    f,
    sigma8_z,
  };
}

/**
 * Interpolate power spectrum to a new k-grid using log-log interpolation
 */
function interpolatePowerSpectrum(k_old: number[], pk_old: number[], k_new: number[]): number[] {
  const pk_new = new Array(k_new.length).fill(0);
  
  for (let i = 0; i < k_new.length; i++) {
    const k = k_new[i];
    
    // Find bracketing indices
    if (k <= k_old[0]) {
      pk_new[i] = pk_old[0];
    } else if (k >= k_old[k_old.length - 1]) {
      pk_new[i] = pk_old[k_old.length - 1];
    } else {
      // Binary search for interval
      let lo = 0, hi = k_old.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (k_old[mid] <= k) lo = mid;
        else hi = mid;
      }
      
      // Log-log interpolation
      const t = (Math.log(k) - Math.log(k_old[lo])) / (Math.log(k_old[hi]) - Math.log(k_old[lo]));
      const log_pk = Math.log(pk_old[lo]) + t * (Math.log(pk_old[hi]) - Math.log(pk_old[lo]));
      pk_new[i] = Math.exp(log_pk);
    }
  }
  
  return pk_new;
}



/**
 * Compute two-point correlation function ξ(s) from power spectrum P(k)
 * using direct integration with trapezoidal rule:
 * ξ(s) = (1/2π²) ∫ k² P(k) j₀(ks) dk
 * where j₀(x) = sin(x)/x
 * 
 * Returns s²*ξ(s) for better visualization
 */
export function computeCorrelationFunction(k: number[], pk: number[], s: number[]): number[] {
  const xi_scaled = new Array(s.length).fill(0);
  
  for (let is = 0; is < s.length; is++) {
    const si = s[is];
    const N = k.length;
    
    let integral = 0;
    
    // Trapezoidal rule for log-spaced k grid
    for (let i = 0; i < N - 1; i++) {
      const k1 = k[i];
      const k2 = k[i + 1];
      const pk1 = pk[i];
      const pk2 = pk[i + 1];
      
      // Spherical Bessel function j₀(x) = sin(x)/x
      const x1 = k1 * si;
      const x2 = k2 * si;
      const j0_1 = x1 < 1e-6 ? 1 - x1*x1/6 : Math.sin(x1) / x1;
      const j0_2 = x2 < 1e-6 ? 1 - x2*x2/6 : Math.sin(x2) / x2;
      
      // Integrand: k² P(k) j₀(ks)
      const f1 = k1 * k1 * pk1 * j0_1;
      const f2 = k2 * k2 * pk2 * j0_2;
      
      // Trapezoidal rule
      const dk = k2 - k1;
      integral += 0.5 * (f1 + f2) * dk;
    }
    
    // ξ(s) = integral / (2π²)
    const xi = integral / (2 * Math.PI * Math.PI);
    
    // Return s²*ξ(s) for better visualization
    // Guard against NaN/Infinity
    if (isFinite(xi)) {
      xi_scaled[is] = si * si * xi;
    } else {
      xi_scaled[is] = 0;
    }
  }
  
  return xi_scaled;
}

/**
 * Generate r grid for correlation function (logarithmically spaced)
 */
export function generateRGrid(rmin: number = 1, rmax: number = 200, n: number = 200): number[] {
  const r: number[] = [];
  const log_rmin = Math.log10(rmin);
  const log_rmax = Math.log10(rmax);
  
  for (let i = 0; i < n; i++) {
    const log_r = log_rmin + (log_rmax - log_rmin) * i / (n - 1);
    r.push(Math.pow(10, log_r));
  }
  
  return r;
}

/**
 * Compute second-order perturbation theory kernel F2(k1, k2)
 * F2(k1, k2) = 5/7 + (1/2)(k1·k2)(1/k1² + 1/k2²) + (2/7)(k1·k2)²/(k1²k2²)
 */
function F2kernel(k1: number, k2: number, cosAngle: number): number {
  const k1k2 = k1 * k2 * cosAngle;
  const k1sq = k1 * k1;
  const k2sq = k2 * k2;
  
  return 5/7 + 0.5 * k1k2 * (1/k1sq + 1/k2sq) + (2/7) * k1k2 * k1k2 / (k1sq * k2sq);
}

/**
 * Compute tree-level bispectrum B(k1, k2, k3)
 * B(k1, k2, k3) = 2[F2(k1,k2)P(k1)P(k2) + F2(k2,k3)P(k2)P(k3) + F2(k1,k3)P(k1)P(k3)]
 * 
 * For a triangle configuration with k1 + k2 + k3 = 0:
 * cos(k1,k2) = (k3² - k1² - k2²) / (2*k1*k2)
 */
export function computeTreeLevelBispectrum(
  k: number[],
  pk: number[],
  k2_ratio: number = 1.0,  // k2/k1 ratio
  k3_ratio: number = 1.414 // k3/k1 ratio (√2 for isosceles right triangle)
): number[] {
  const bispectrum = new Array(k.length).fill(0);
  
  for (let i = 0; i < k.length; i++) {
    const k1 = k[i];
    const k2 = k1 * k2_ratio;
    const k3 = k1 * k3_ratio;
    
    // Interpolate P(k) at k2 and k3
    const pk1 = pk[i];
    const pk2 = interpolatePowerSpectrum(k, pk, [k2])[0];
    const pk3 = interpolatePowerSpectrum(k, pk, [k3])[0];
    
    // Compute angles from triangle condition: k1 + k2 + k3 = 0
    // cos(k1,k2) = (k3² - k1² - k2²) / (2*k1*k2)
    const cos12 = (k3*k3 - k1*k1 - k2*k2) / (2 * k1 * k2);
    const cos23 = (k1*k1 - k2*k2 - k3*k3) / (2 * k2 * k3);
    const cos13 = (k2*k2 - k1*k1 - k3*k3) / (2 * k1 * k3);
    
    // Clamp cosines to [-1, 1] to avoid numerical issues
    const cos12_clamped = Math.max(-1, Math.min(1, cos12));
    const cos23_clamped = Math.max(-1, Math.min(1, cos23));
    const cos13_clamped = Math.max(-1, Math.min(1, cos13));
    
    // Compute F2 kernels
    const F2_12 = F2kernel(k1, k2, cos12_clamped);
    const F2_23 = F2kernel(k2, k3, cos23_clamped);
    const F2_13 = F2kernel(k1, k3, cos13_clamped);
    
    // Tree-level bispectrum
    bispectrum[i] = 2 * (F2_12 * pk1 * pk2 + F2_23 * pk2 * pk3 + F2_13 * pk1 * pk3);
  }
  
  return bispectrum;
}
