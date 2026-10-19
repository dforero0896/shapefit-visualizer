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
  const { dm, dn, dc, deps, dgam, dA, kp, a, qpar, qper } = sf;
  
  // For the no-wiggle spectrum, use the isotropic AP scaling
  // q_ap = (qpar * qper^2)^(1/3) for the monopole
  const q_ap = Math.pow(qpar * qper * qper, 1/3);
  
  // Compute modified no-wiggle spectrum
  const pknow = k.map((ki, i) => {
    const k_ap = ki * q_ap;
    
    const logRatio = Math.log(k_ap / kp);
    const tanhVal = Math.tanh(a * logRatio);
    
    const tilt = Math.exp(
      (dm / a) * tanhVal +
      dn * logRatio +
      (dc / (2 * a * a)) * tanhVal * tanhVal
    );
    
    const k_shifted = k_ap * Math.exp(-deps);
    const pknow_shifted = interpLog(k, pknow_fid, k_shifted);
    const broadbandRatio = pknow_shifted / pknow_fid[i];
    
    return pknow_fid[i] * dA * tilt * broadbandRatio;
  });
  
  // For the full power spectrum with wiggles, we need to properly account
  // for the anisotropic AP effect by integrating over μ
  // P(k) = (1/2) ∫_{-1}^{1} P(k, μ) dμ
  // where P(k, μ) is evaluated at the AP-rescaled k'
  
  const n_mu = 20; // Number of μ integration points
  const mu_grid = Array.from({length: n_mu}, (_, i) => (i + 0.5) / n_mu); // μ from 0 to 1
  const mu_weights = Array(n_mu).fill(1.0 / n_mu); // Simple uniform weights
  
  const pk = k.map((ki, i) => {
    let pk_integral = 0;
    
    // Integrate over μ
    for (let imu = 0; imu < n_mu; imu++) {
      const mu = mu_grid[imu];
      const w_mu = mu_weights[imu];
      
      // AP rescaling for this μ
      // k' = k * sqrt((μ/q_∥)² + ((1-μ²)/q_⊥²))
      const k_ap_mu = ki * Math.sqrt(
        (mu * mu) / (qpar * qpar) + 
        (1 - mu * mu) / (qper * qper)
      );
      
      // Interpolate fiducial spectra at the anisotropically rescaled k
      const pk_fid_mu = interpLog(k, pk_fid, k_ap_mu);
      const pknow_fid_mu = interpLog(k, pknow_fid, k_ap_mu);
      
      // Wiggle factor at this μ
      const logWiggle_mu = Math.log(pk_fid_mu / pknow_fid_mu);
      
      // Contribution to the integral
      // Note: pknow[i] is already computed with isotropic scaling
      pk_integral += w_mu * pknow[i] * Math.exp((1 + dgam) * logWiggle_mu);
    }
    
    return pk_integral;
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
  // Generate wide k-grid for computation to avoid edge effects when ShapeFit shifts spectrum
  const k_wide = generateKGrid(1e-4, 10.0, 800);
  
  // Display range (what we actually plot)
  const k_display = generateKGrid(0.005, 0.5, 500);
  
  // Compute fiducial no-wiggle spectrum (EH98 zero-baryon) on wide grid
  const T_nw_fid = transferEH98NoWiggle(k_wide, cosmo);
  const pknow_fid_z0 = k_wide.map((ki, i) => Math.pow(ki, cosmo.n_s) * T_nw_fid[i] * T_nw_fid[i]);
  
  // Normalize no-wiggle to sigma8
  const s8sq_nw = sigma8Squared(k_wide, pknow_fid_z0, 8.0);
  const norm_nw = (cosmo.sigma8 * cosmo.sigma8) / s8sq_nw;
  const pknow_fid_z0_norm = pknow_fid_z0.map(p => p * norm_nw);
  
  // Compute full fiducial spectrum with Syren correction on wide grid
  const pk_fid_z0 = computeLinearPk(k_wide, cosmo);
  
  // Apply ShapeFit template at z=0 on wide grid
  const { pk: pk_z0, pknow: pknow_z0 } = applyShapeFit(k_wide, pk_fid_z0, pknow_fid_z0_norm, shapefit);
  
  // Scale to redshift z
  const Dz = growthD(z, cosmo.omega_m);
  const Dz2 = Dz * Dz;
  
  // Apply growth rate modification from df
  // df modifies the amplitude of the power spectrum
  const df2 = shapefit.df * shapefit.df;
  
  const pk_fid_wide = pk_fid_z0.map(p => p * Dz2);
  const pknow_fid_wide = pknow_fid_z0_norm.map(p => p * Dz2);
  const pk_wide = pk_z0.map(p => p * Dz2 * df2);
  const pknow_wide = pknow_z0.map(p => p * Dz2 * df2);
  
  // Compute nonlinear spectra on wide grid
  const pk_nl_fid_z0 = computeNonlinearPk(k_wide, cosmo, 0.0);
  const { pk: pk_nl_z0 } = applyShapeFit(k_wide, pk_nl_fid_z0, pknow_fid_z0_norm, shapefit);
  const pk_nl_fid_wide = pk_nl_fid_z0.map(p => p * Dz2);
  const pk_nl_wide = pk_nl_z0.map(p => p * Dz2 * df2);
  
  // Interpolate to display range
  const pk_fid = k_display.map(ki => interpLog(k_wide, pk_fid_wide, ki));
  const pknow_fid = k_display.map(ki => interpLog(k_wide, pknow_fid_wide, ki));
  const pk = k_display.map(ki => interpLog(k_wide, pk_wide, ki));
  const pknow = k_display.map(ki => interpLog(k_wide, pknow_wide, ki));
  const pk_nl_fid = k_display.map(ki => interpLog(k_wide, pk_nl_fid_wide, ki));
  const pk_nl = k_display.map(ki => interpLog(k_wide, pk_nl_wide, ki));
  
  // Growth rate (modified by ShapeFit df and dA)
  const f0 = growthRateF(z, cosmo.omega_m);
  const f = f0 * shapefit.df / Math.sqrt(shapefit.dA);
  
  // sigma8 at z
  const sigma8_z = cosmo.sigma8 * Dz;
  
  return {
    k: k_display,
    pk_fid,
    pknow_fid,
    pk,
    pknow,
    pk_nl_fid,
    pk_nl,
    kPk_fid: k_display.map((ki, i) => ki * pk_fid[i]),
    kPk: k_display.map((ki, i) => ki * pk[i]),
    kPk_nl_fid: k_display.map((ki, i) => ki * pk_nl_fid[i]),
    kPk_nl: k_display.map((ki, i) => ki * pk_nl[i]),
    kPk3_fid: k_display.map((ki, i) => ki * ki * ki * pk_fid[i] / (2 * Math.PI * Math.PI)),
    kPk3: k_display.map((ki, i) => ki * ki * ki * pk[i] / (2 * Math.PI * Math.PI)),
    kPk3_nl_fid: k_display.map((ki, i) => ki * ki * ki * pk_nl_fid[i] / (2 * Math.PI * Math.PI)),
    kPk3_nl: k_display.map((ki, i) => ki * ki * ki * pk_nl[i] / (2 * Math.PI * Math.PI)),
    f,
    sigma8_z,
  };
}

/**
 * Compute tree-level bispectrum using geofptax implementation
 * Based on dforero0896/geofptax with B1=0 and all biases=0
 * 
 * @param k Array of wavenumbers (diagonal configuration k1=k2=k)
 * @param pk Linear power spectrum (modified by ShapeFit)
 * @param cosmo Cosmological parameters
 * @param shapefit ShapeFit parameters
 * @param z Redshift
 * @param basis 'scoccimarro' or 'sugiyama'
 * @returns Bispectrum monopole B_0(k) scaled by k²
 */
function computeTreeLevelBispectrumGeofpt(
  k: number[],
  pk: number[],
  cosmo: CosmoParams,
  shapefit: ShapeFitParams,
  z: number,
  basis: 'scoccimarro' | 'sugiyama'
): number[] {
  const f = growthRateF(z, cosmo.omega_m);
  const b1 = 1.0; // Linear bias = 1 (matter)
  const b2 = 0.0; // Second-order bias = 0
  const bs = 0.0; // Tidal bias = 0
  const alpha_par = shapefit.qpar; // AP parameter
  const alpha_perp = shapefit.qper; // AP parameter
  const sigma_fog = 5.0; // Finger-of-God damping scale
  
  // GEO-FPT coefficients (from geofptax/constants.py F_VALS_FULL)
  const f1 = [1.00334041, -3.97587153e-03, 2.39676798e-02, -5.68098245e-02, 1.32544359e-02];
  const f2 = [1.01798746, -4.10578402e-03, 1.48808466e-02, -5.46660187e-02, 1.11441504e-02];
  const f3 = [1.03745852, 1.95019784e-03, 5.56349564e-03, -4.83637541e-02, 8.06689225e-03];
  
  // Interpolate GEO-FPT coefficients at the given redshift
  const a = 1.0 / (1.0 + z);
  const a_vals = [1.0/3.0, 1.0/2.0, 2.0/3.0]; // z=2, 1, 0.5
  const af = interpolateGeoCoeffs(a, [f3, f2, f1], a_vals);
  
  // Compute bispectrum for each k
  const B0 = k.map((ki, i) => {
    const k1 = ki;
    const k2 = ki; // Diagonal configuration
    const k3 = ki * Math.sqrt(2); // For equilateral-like triangle
    
    // Get power spectrum values
    const pk1 = pk[i];
    const pk2 = pk[i];
    const pk3 = interpLog(k, pk, k3);
    
    // Integration over angles using Gauss-Legendre quadrature
    // Reduced to 10 points for stability and speed
    const n_mu = 10;
    const n_phi = 10;
    const n_x = 10;
    
    // Get quadrature points and weights
    const [mu_nodes, mu_weights] = gaussLegendre(n_mu);
    const [phi_nodes, phi_weights] = gaussLegendre(n_phi, 0, 2 * Math.PI);
    const [x_nodes, x_weights] = gaussLegendre(n_x);
    
    let integral = 0.0;
    
    // 3D integration over (x, mu, phi)
    for (let ix = 0; ix < n_x; ix++) {
      const x = x_nodes[ix]; // cos(angle between k1 and k2)
      const wx = x_weights[ix];
      
      for (let imu = 0; imu < n_mu; imu++) {
        const mu = mu_nodes[imu]; // cos(angle between k1 and LOS)
        const wmu = mu_weights[imu];
        
        for (let iphi = 0; iphi < n_phi; iphi++) {
          const phi = phi_nodes[iphi]; // azimuthal angle
          const wphi = phi_weights[iphi];
          
          // Compute angles for the triangle
          const mu2 = mu * x + Math.sqrt(1 - mu*mu) * Math.sqrt(1 - x*x) * Math.cos(phi);
          const mu3 = -(k1 * mu + k2 * mu2) / k3;
          
          // Apply AP transformations
          const Fsq = 1.0 / (alpha_par / alpha_perp) ** 2;
          const k1_rs = k1 * Math.sqrt(1 + mu*mu * (Fsq - 1)) / alpha_perp;
          const k2_rs = k2 * Math.sqrt(1 + mu2*mu2 * (Fsq - 1)) / alpha_perp;
          const k3_rs = k3 * Math.sqrt(1 + mu3*mu3 * (Fsq - 1)) / alpha_perp;
          
          const mu1_rs = mu * alpha_perp / (alpha_par * Math.sqrt(1 + mu*mu * (Fsq - 1)));
          const mu2_rs = mu2 * alpha_perp / (alpha_par * Math.sqrt(1 + mu2*mu2 * (Fsq - 1)));
          const mu3_rs = mu3 * alpha_perp / (alpha_par * Math.sqrt(1 + mu3*mu3 * (Fsq - 1)));
          
          // Compute GEO-FPT factor
          const geo_factor = computeGeoFactor(k1_rs, k2_rs, k3_rs, af, 1.0);
          
          // Compute FoG damping
          const k_par_sq_sum = (k1_rs * mu1_rs)**2 + (k2_rs * mu2_rs)**2 + (k3_rs * mu3_rs)**2;
          const D_fog = 1.0 / (1 + 0.5 * k_par_sq_sum**2 * (sigma_fog / 1.0)**4)**2;
          
          // Compute Z1 kernels
          const z1_1 = b1 + f * mu1_rs**2;
          const z1_2 = b1 + f * mu2_rs**2;
          const z1_3 = b1 + f * mu3_rs**2;
          
          // Compute F2 and G2 kernels
          const f2_12 = computeF2Kernel(k1_rs, k2_rs, k3_rs);
          const f2_23 = computeF2Kernel(k2_rs, k3_rs, k1_rs);
          const f2_13 = computeF2Kernel(k1_rs, k3_rs, k2_rs);
          
          const g2_12 = computeG2Kernel(k1_rs, k2_rs, k3_rs);
          const g2_23 = computeG2Kernel(k2_rs, k3_rs, k1_rs);
          const g2_13 = computeG2Kernel(k1_rs, k3_rs, k2_rs);
          
          // Compute Z2 kernels with GEO-FPT correction
          const z2_12 = computeZ2Kernel(k1_rs, k2_rs, k3_rs, f2_12, g2_12, mu1_rs, mu2_rs, f, b1, b2, bs) * geo_factor;
          const z2_23 = computeZ2Kernel(k2_rs, k3_rs, k1_rs, f2_23, g2_23, mu2_rs, mu3_rs, f, b1, b2, bs) * geo_factor;
          const z2_13 = computeZ2Kernel(k1_rs, k3_rs, k2_rs, f2_13, g2_13, mu1_rs, mu3_rs, f, b1, b2, bs) * geo_factor;
          
          // Form tree-level bispectrum terms
          const B12 = 2 * z1_1 * z1_2 * z2_12 * pk1 * pk2;
          const B23 = 2 * z1_2 * z1_3 * z2_23 * pk2 * pk3;
          const B31 = 2 * z1_1 * z1_3 * z2_13 * pk1 * pk3;
          
          const tree_level = B12 + B23 + B31;
          
          // Apply FoG damping and normalization
          const result = D_fog * tree_level / (alpha_par**2 * alpha_perp**4);
          
          // Apply basis function for the multipole
          let basis_func = 1.0;
          if (basis === 'sugiyama') {
            // Sugiyama B000 basis
            basis_func = 1.0 / (8 * Math.PI);
          }
          
          integral += wx * wmu * wphi * result * basis_func;
        }
      }
    }
    
    // Return k² * B(k) for plotting (as in the examples)
    return ki * ki * integral;
  });
  
  return B0;
}

/**
 * Interpolate GEO-FPT coefficients at a given scale factor
 */
function interpolateGeoCoeffs(a: number, f_vals: number[][], a_vals: number[]): number[] {
  const result = new Array(5).fill(0);
  for (let i = 0; i < 5; i++) {
    const vals = f_vals.map(f => f[i]);
    result[i] = linearInterp(a, a_vals, vals);
  }
  return result;
}

/**
 * Linear interpolation
 */
function linearInterp(x: number, x_vals: number[], y_vals: number[]): number {
  if (x <= x_vals[0]) return y_vals[0];
  if (x >= x_vals[x_vals.length - 1]) return y_vals[y_vals.length - 1];
  
  for (let i = 0; i < x_vals.length - 1; i++) {
    if (x >= x_vals[i] && x <= x_vals[i + 1]) {
      const t = (x - x_vals[i]) / (x_vals[i + 1] - x_vals[i]);
      return y_vals[i] + t * (y_vals[i + 1] - y_vals[i]);
    }
  }
  return y_vals[y_vals.length - 1];
}

/**
 * Compute GEO-FPT correction factor
 */
function computeGeoFactor(k1: number, k2: number, k3: number, af: number[], hh: number): number {
  const kmax = Math.max(k1, k2, k3);
  const kmin = Math.min(k1, k2, k3);
  const kmed = k1 + k2 + k3 - kmax - kmin;
  
  const cosmax = (kmed**2 + kmin**2 - kmax**2) / (2 * kmed * kmin);
  const cosmed = (kmax**2 + kmin**2 - kmed**2) / (2 * kmax * kmin);
  const cosmin = (kmax**2 + kmed**2 - kmin**2) / (2 * kmax * kmed);
  
  // Compute area using Heron's formula
  const perim = (k1 + k2 + k3) / 2;
  const area = Math.sqrt(perim * (perim - k1) * (perim - k2) * (perim - k3)) / (hh**2 * 0.001);
  
  return af[0] + af[1] * cosmed / cosmin + af[2] * cosmax / cosmin + af[3] * area + af[4] * area**2;
}

/**
 * Compute F2 kernel
 */
function computeF2Kernel(ka: number, kb: number, kc: number): number {
  const cab = (kc**2 - ka**2 - kb**2) / (2 * ka * kb);
  return 5/7 + 0.5 * cab * (ka/kb + kb/ka) + 2/7 * cab**2;
}

/**
 * Compute G2 kernel
 */
function computeG2Kernel(ka: number, kb: number, kc: number): number {
  const cab = (kc**2 - ka**2 - kb**2) / (2 * ka * kb);
  return 3/7 + 0.5 * cab * (ka/kb + kb/ka) + 4/7 * cab**2;
}

/**
 * Compute Z2 kernel
 */
function computeZ2Kernel(
  ka: number, kb: number, kc: number,
  f2: number, g2: number,
  mua: number, mub: number,
  f: number, b1: number, b2: number, bs: number
): number {
  const cab = (kc**2 - ka**2 - kb**2) / (2 * ka * kb);
  const ksq = Math.sqrt(ka**2 + kb**2 + 2 * ka * kb * cab);
  const mu12 = (ka * mua + kb * mub) / ksq;
  
  const s2 = cab**2 - 1/3;
  
  const b1_terms = b1 * (f2 + 0.5 * f * mu12 * ksq * (mua/ka + mub/kb));
  const g_term = f * mu12**2 * g2;
  const fsq_term = 0.5 * f**2 * mu12 * ksq * mua * mub * (mub/ka + mua/kb);
  const b_terms = 0.5 * (b2 + bs * s2);
  
  return b1_terms + g_term + fsq_term + b_terms;
}

/**
 * Gauss-Legendre quadrature points and weights
 */
function gaussLegendre(n: number, a: number = -1, b: number = 1): [number[], number[]] {
  // Use precomputed values for common n
  if (n === 20) {
    const nodes = [
      -0.9931285991850949, -0.9639719272779138, -0.9122344282513259,
      -0.8391169718222188, -0.7463319064601508, -0.6360536807265150,
      -0.5108670019508271, -0.3737060887154195, -0.2277858511416451,
      -0.0765265211334973, 0.0765265211334973, 0.2277858511416451,
      0.3737060887154195, 0.5108670019508271, 0.6360536807265150,
      0.7463319064601508, 0.8391169718222188, 0.9122344282513259,
      0.9639719272779138, 0.9931285991850949
    ];
    const weights = [
      0.0176140071391521, 0.0406014298003869, 0.0626720483341091,
      0.0832767415767048, 0.1019301198172404, 0.1181945319615184,
      0.1316886384491766, 0.1420961093183867, 0.1491729864726037,
      0.1527533871307258, 0.1527533871307258, 0.1491729864726037,
      0.1420961093183867, 0.1316886384491766, 0.1181945319615184,
      0.1019301198172404, 0.0832767415767048, 0.0626720483341091,
      0.0406014298003869, 0.0176140071391521
    ];
    
    // Scale from [-1, 1] to [a, b]
    const scaled_nodes = nodes.map(x => 0.5 * (b - a) * x + 0.5 * (b + a));
    const scaled_weights = weights.map(w => 0.5 * (b - a) * w);
    
    return [scaled_nodes, scaled_weights];
  }
  
  // Fallback: simple approximation for other n
  const nodes = [];
  const weights = [];
  for (let i = 0; i < n; i++) {
    const x = Math.cos(Math.PI * (i + 0.5) / n);
    nodes.push(0.5 * (b - a) * x + 0.5 * (b + a));
    weights.push(0.5 * (b - a) * 2 / n);
  }
  return [nodes, weights];
}




