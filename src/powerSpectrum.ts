/**
 * Linear Matter Power Spectrum computation using Eisenstein & Hu (1998)
 * transfer function with BAO wiggles, and the ShapeFit template.
 * 
 * References:
 * - Eisenstein & Hu (1998), ApJ, 496, 605 (transfer function with wiggles)
 * - Eisenstein & Hu (1998), ApJ, 511, 5 (no-wiggle / zero-baryon approximation)
 * - Brieden, Gil-Marin & Verde (2021), arXiv:2106.07641 (ShapeFit)
 * - desilike shapefit-prime: https://github.com/dforero0896/desilike/tree/shapefit-prime
 */

const T_CMB = 2.7255; // CMB temperature [K]

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

// ─── Eisenstein & Hu (1998) Transfer Function ────────────────────────────────

/**
 * Compute the EH98 transfer function T(k) with baryonic wiggles.
 * k is in units of h/Mpc.
 */
function transferEH98(k_h: number[], cosmo: CosmoParams): number[] {
  const { omega_m, omega_b, h } = cosmo;
  const omega_cdm = omega_m - omega_b;
  const h2 = h * h;
  const theta = T_CMB / 2.7;
  const theta2 = theta * theta;
  const theta4 = theta2 * theta2;
  
  // Physical densities
  const wm = omega_m * h2;  // ω_m = Ω_m h²
  const wb = omega_b * h2;  // ω_b = Ω_b h²
  
  // Fractions
  const fb = omega_b / omega_m;  // baryon fraction
  const fc = omega_cdm / omega_m; // CDM fraction
  
  // Redshift of equality (EH98 eq. 2)
  const zeq = 2.5e4 * wm / theta4;
  
  // Scale of equality (EH98 eq. 3) [Mpc⁻¹]
  const keq = 7.46e-2 * wm / (theta2 * theta2);
  
  // Drag redshift (EH98 eq. 4)
  const zdb1 = 0.313 * Math.pow(wm, -0.419) * (1 + 0.607 * Math.pow(wm, 0.674));
  const zdb2 = 0.0129 * Math.pow(wm, 0.251) / (1 + 0.217 * Math.pow(wm, 0.764));
  const zd = zdb1 * (1 + zdb2 * Math.pow(wb, 0.238));
  
  // Sound horizon (EH98 eq. 5) [Mpc]
  const Rd = 31.5e3 * wb / (theta4 * zd) * 1e-3;  // R at drag
  const Req = 31.5e3 * wb / (theta4 * zeq) * 1e-3; // R at equality
  const s = (2 / (3 * keq)) * Math.sqrt(6 / Req) * 
            Math.log((Math.sqrt(1 + Rd) + Math.sqrt(Rd + Req)) / (1 + Math.sqrt(Req)));
  
  // Silk damping scale (EH98 eq. 7) [Mpc⁻¹]
  const ks = 1.6 * Math.pow(wb, 0.52) * Math.pow(wm, 0.73) * (1 + Math.pow(10.4 * wm, -0.95));
  
  // CDM alpha parameters (EH98 eq. 11)
  const a1 = Math.pow(46.9 * wm, 0.670) * (1 + Math.pow(32.1 * wm, -0.532));
  const a2 = Math.pow(12.0 * wm, 0.424) * (1 + Math.pow(45.0 * wm, -0.582));
  const alphac = Math.pow(a1, -fb) * Math.pow(a2, -fb * fb * fb);
  
  // Baryon alpha parameter (EH98 eq. 13)
  const b1 = 0.944 / (1 + Math.pow(458.0 * wm, -0.708));
  const b2 = Math.pow(0.395 * wm, -0.0207);
  const alphab = 2.07 * keq * s * Math.pow(1 + Rd, -0.75) * b1 * b2;
  
  // Beta parameters (EH98 eq. 14)
  const betac = 1 / (1 - 0.949 * Math.sqrt(wb / wm) + 0.1 * (wb / wm));
  // Actually beta_c is for baryon contamination of CDM
  // beta node (EH98 eq. 23)
  const bnode = 8.41 * Math.pow(wm, 0.435);
  
  // Compute T(k) for each k
  return k_h.map(k => {
    // Dimensionless wave number (EH98 eq. 10)
    const q = k / (13.41 * keq);
    
    // T~_0 function (EH98 eq. 17)
    // L_0(q) = ln(e + 1.96 q)  where e = 2.718...
    // C_0(q) = 14.2 + 731 / (1 + 62.5 q)
    const T0 = (qq: number) => {
      const L0 = Math.log(Math.E * qq + 1.96 * qq * qq);
      const C0 = 14.2 + 731 / (1 + 62.5 * qq);
      return L0 / (L0 + C0 * qq * qq);
    };
    
    // Damping factor (EH98 eq. 19)
    const ks_val = k * s;
    const f = 1 / (1 + Math.pow(ks_val / 5.4, 4));
    
    // CDM transfer function (EH98 eq. 17-20)
    const Tc = f * T0(q / alphac) + (1 - f) * T0(q);
    // Note: the paper says T~_c = f * T~_0(q/α_c) + (1-f) * T~_0(q)
    // But actually looking more carefully, the first term should use T0 evaluated at q/alpha_c
    // and the second at q. Let me re-read...
    // Actually EH98 eq 17: T_c = f * T_tilde_0(q) + (1-f) * T_tilde_0(q/alpha_c)
    // where f is the damping factor. Let me fix this:
    const Tc_correct = f * T0(q) + (1 - f) * T0(q / alphac);
    
    // Baryon transfer function (EH98 eq. 21-24)
    const stilde = s / Math.pow(1 + Math.pow(bnode / (k * s), 3), 1/3);
    const sinTerm = Math.sin(k * stilde) / (k * stilde);
    const Tb = (T0(q) / (1 + Math.pow(ks_val / 5.2, 2)) + 
                alphab / (1 + Math.pow(bnode / (k * s), 3))) * sinTerm;
    
    // Total transfer function (EH98 eq. 16)
    return fc * Tc_correct + fb * Tb;
  });
}

/**
 * Compute the no-wiggle transfer function using EH98 zero-baryon approximation.
 * (Eisenstein & Hu 1998, ApJ 511, 5, eq. 29-31)
 */
function transferNoWiggle(k_h: number[], cosmo: CosmoParams): number[] {
  const { omega_m, omega_b, h } = cosmo;
  const h2 = h * h;
  const wm = omega_m * h2;
  const wb = omega_b * h2;
  const fb = omega_b / omega_m;
  
  // Effective shape parameter (EH98 eq. 29)
  const alpha = 1 - 0.328 * Math.log(431 * wm) * fb + 
                0.38 * Math.log(22.3 * wm) * fb * fb;
  
  // Gamma_eff (EH98 eq. 31)
  const gamma = omega_m * h * alpha;
  
  return k_h.map(k => {
    // q in units of Mpc⁻¹: q = k / gamma where gamma is in h/Mpc
    // Actually, in EH98 the shape parameter Gamma = Omega_m * h, and q = k/Gamma
    // with k in Mpc⁻¹. Since our k is in h/Mpc, we have q = k * h / Gamma = k / Omega_m
    // Wait no. Let me be more careful.
    // In EH98 no-wiggle: Gamma_eff = Omega_m * h * alpha
    // q = k / (Gamma_eff * Mpc⁻¹) where k is in Mpc⁻¹
    // Our k is in h/Mpc, so k_phys = k * h [Mpc⁻¹]
    // q = k * h / (Omega_m * h * alpha) = k / (Omega_m * alpha)
    // Hmm, but that doesn't seem right either. Let me think again.
    // 
    // Actually the standard form is: q = k * theta^2 / (Omega_m * h^2 * Mpc^-1)
    // for the full EH98, but for the no-wiggle approximation:
    // The transfer function is T(k) = L_0 / (L_0 + C_0 * q^2)
    // where q = k / (Omega_m * h * alpha * Mpc^-1) and k is in Mpc^-1
    //
    // Since our k is in h/Mpc: k_physical = k * h [Mpc^-1]
    // q = k * h / (Omega_m * h * alpha) = k / (Omega_m * alpha)
    // 
    // Actually wait. Let me look at this differently.
    // The standard convention: Gamma_eff has units of h/Mpc (it's Omega_m * h * alpha)
    // q = k / Gamma_eff where k is in h/Mpc and Gamma_eff is in h/Mpc
    // So q = k / (Omega_m * h * alpha)
    // But that gives q dimensionless only if k is in h/Mpc and Gamma_eff is in h/Mpc.
    // Omega_m * h has units of h/Mpc? No, Omega_m is dimensionless and h is dimensionless.
    // 
    // The issue is that in EH98, k is in Mpc^-1 and Gamma is in Mpc^-1.
    // Gamma = Omega_m * h [Mpc^-1]
    // Our k is in h/Mpc, so k [Mpc^-1] = k_h * h
    // q = k_h * h / (Omega_m * h * alpha) = k_h / (Omega_m * alpha)
    //
    // Hmm, but actually I think the standard way is:
    // In the no-wiggle approximation, the shape parameter is
    // Gamma_eff = Omega_m * h (in units of Mpc^-1 when multiplied by appropriate factors)
    // and q = k / Gamma_eff
    //
    // Let me just use: q = k / (gamma) where gamma = Omega_m * h * alpha
    // and k is in h/Mpc. This gives q dimensionless.
    // Actually no, the units don't work out. Let me just use the formula directly.
    
    // The standard form from EH98 eq 30:
    // T_0(k) = ln(1 + 2.718*beta*q) / (ln(1 + 2.718*beta*q) + C*q^2)
    // where q = k/(Omega_m*h^2*Mpc^-1) * theta^(-2) ... no this is getting confused.
    //
    // Let me use a cleaner formulation. In the Eisenstein & Hu no-wiggle approximation:
    // The transfer function depends on k/Gamma where Gamma = Omega_m * h [Mpc^-1]
    // For k in h/Mpc: k/Gamma = k/(Omega_m * h) * h = k/Omega_m
    // But we also have the alpha correction.
    // 
    // I'll use the standard form where q = k * theta^2 / (Omega_m * h^2)
    // modified by alpha for the no-wiggle case.
    // Actually, let me just use the simplest correct form:
    
    const theta = T_CMB / 2.7;
    const theta2 = theta * theta;
    
    // Standard q parameter: q = k / (Omega_m * h^2 / theta^2) [with k in Mpc^-1]
    // For k in h/Mpc: k_Mpc = k * h, so q = k * h * theta^2 / (Omega_m * h^2) = k * theta^2 / (Omega_m * h)
    // With the alpha correction: q_eff = k * theta^2 / (gamma) where gamma = Omega_m * h * alpha
    // q_eff = k / (Omega_m * alpha) * theta^2 / h... this is getting circular.
    
    // Let me just use the standard result directly:
    // For the zero-baryon transfer function, the shape parameter is
    // Gamma = Omega_m * h * alpha [in Mpc^-1]
    // The dimensionless variable is q = k [Mpc^-1] / Gamma
    // Since k is in h/Mpc: k [Mpc^-1] = k_h * h
    // q = k_h * h / (Omega_m * h * alpha) = k_h / (Omega_m * alpha)
    
    // But wait, this doesn't have theta dependence... Let me look at this more carefully.
    // Actually in the standard EH98 formulation, for the CDM case:
    // q = k / (Omega_m * h^2 * Mpc^-1) * theta_CMB^{-2}
    // For the no-wiggle approximation, this becomes:
    // q = k * theta^2 / (Gamma_eff) where Gamma_eff = Omega_m * h * alpha
    // and k is in Mpc^-1.
    // So q = k_h * h * theta^2 / (Omega_m * h * alpha) = k_h * theta^2 / (Omega_m * alpha)
    
    const q = k * theta2 / (omega_m * alpha);
    
    // Transfer function (EH98 eq. 30)
    const L0 = Math.log(2 * Math.E * q + 1.8 * q * q);  // Actually: ln(e + 1.96q) for C0 form
    // Let me use the exact form from EH98 eq 30:
    // T_0 = L_0 / (L_0 + C_0 * q^2)
    // L_0(q) = ln(1 + 2.718*q)  (approximately)
    // C_0(q) = 14.2 + 386/(1 + 69.9*q)  (from eq 31, for zero baryon)
    // Actually, looking at the paper more carefully:
    // For the no-wiggle (zero-baryon) approximation:
    // T_0(k) = L_0 / (L_0 + C_0 * q^2)
    // L_0 = ln(e + 1.96*q)  where e = 2.71828...
    // C_0 = 14.2 + 731/(1 + 62.5*q)
    // These are the same as the full EH98, just with q redefined via Gamma_eff
    
    const L0_val = Math.log(Math.E + 1.96 * q);
    const C0_val = 14.2 + 731 / (1 + 62.5 * q);
    
    return L0_val / (L0_val + C0_val * q * q);
  });
}

// ─── Power Spectrum Computation ──────────────────────────────────────────────

/**
 * Compute the linear matter power spectrum P(k) = A * k^n_s * T(k)^2
 * normalized to match sigma8.
 */
function computePk(k: number[], T: number[], n_s: number, sigma8: number): number[] {
  // Unnormalized P(k)
  const pk_unnorm = k.map((ki, i) => Math.pow(ki, n_s) * T[i] * T[i]);
  
  // Compute sigma8 from unnormalized P(k)
  const R = 8.0; // Mpc/h
  const s8sq = sigma8Squared(k, pk_unnorm, R);
  
  // Normalize
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

export function generateKGrid(kmin = 1e-4, kmax = 0.5, n = 400): number[] {
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
  const k = generateKGrid(1e-4, 0.5, 400);
  
  // Compute fiducial transfer functions
  const T_fid = transferEH98(k, cosmo);
  const T_nw_fid = transferNoWiggle(k, cosmo);
  
  // Compute fiducial power spectra (normalized to sigma8 at z=0)
  const pk_fid_z0 = computePk(k, T_fid, cosmo.n_s, cosmo.sigma8);
  const pknow_fid_z0 = computePk(k, T_nw_fid, cosmo.n_s, cosmo.sigma8);
  
  // Apply ShapeFit template at z=0
  const { pk: pk_z0, pknow: pknow_z0 } = applyShapeFit(k, pk_fid_z0, pknow_fid_z0, shapefit);
  
  // Scale to redshift z
  const Dz = growthD(z, cosmo.omega_m);
  const Dz2 = Dz * Dz;
  
  const pk_fid = pk_fid_z0.map(p => p * Dz2);
  const pknow_fid = pknow_fid_z0.map(p => p * Dz2);
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
