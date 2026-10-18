/**
 * Representative DESI DR1 matter power spectrum data points from
 * Cereskaite et al. (2025), arXiv:2507.16590
 * "Inference of the linear matter power spectrum at z=0 using DESI DR1 Full-Shape data"
 * 
 * Data reconstructed at z=0 from DESI Year 1 galaxy clustering (BGS, LRG, ELG, QSO)
 * and Planck 2018 CMB observations, assuming ΛCDM.
 * 
 * Full data available at: https://zenodo.org/records/19788154
 * 
 * These are approximate representative points based on the published Figure 1.
 * The DESI galaxy clustering points are at intermediate scales (k ~ 0.01-0.2 h/Mpc),
 * while CMB points from Planck cover the largest scales (k ~ 2e-4 to 0.01 h/Mpc).
 */

export interface DESIDataPoint {
  k: number;        // wavenumber [h/Mpc]
  pk: number;       // P(k) [(Mpc/h)^3]
  err: number;      // 1σ error on P(k)
  k_lo: number;     // lower k bound (20th percentile)
  k_hi: number;     // upper k bound (80th percentile)
  source: 'CMB' | 'DESI';
  tracer?: string;  // DESI tracer name
}

// CMB data points from Planck 2018 (reconstructed to z=0)
// These represent the large-scale constraints from CMB temperature + polarization
const cmbData: DESIDataPoint[] = [
  { k: 0.00025, pk: 3200, err: 800, k_lo: 0.00015, k_hi: 0.0004, source: 'CMB' },
  { k: 0.00045, pk: 5100, err: 1100, k_lo: 0.0003, k_hi: 0.0007, source: 'CMB' },
  { k: 0.00075, pk: 7200, err: 1400, k_lo: 0.0005, k_hi: 0.0011, source: 'CMB' },
  { k: 0.0012, pk: 9500, err: 1600, k_lo: 0.0008, k_hi: 0.0018, source: 'CMB' },
  { k: 0.002, pk: 12000, err: 1800, k_lo: 0.0014, k_hi: 0.003, source: 'CMB' },
  { k: 0.0035, pk: 14500, err: 2000, k_lo: 0.0025, k_hi: 0.005, source: 'CMB' },
  { k: 0.006, pk: 16000, err: 2200, k_lo: 0.004, k_hi: 0.009, source: 'CMB' },
  { k: 0.009, pk: 17000, err: 2500, k_lo: 0.006, k_hi: 0.013, source: 'CMB' },
];

// DESI galaxy clustering data (combined all tracers, monopole+quadrupole)
// Reconstructed to z=0 using transfer functions, assuming ΛCDM
// Based on Figure 1 of Cereskaite et al. (2025)
const desiData: DESIDataPoint[] = [
  // BGS (z~0.2)
  { k: 0.012, pk: 17500, err: 2800, k_lo: 0.009, k_hi: 0.016, source: 'DESI', tracer: 'BGS' },
  { k: 0.018, pk: 18200, err: 2500, k_lo: 0.014, k_hi: 0.023, source: 'DESI', tracer: 'BGS' },
  { k: 0.027, pk: 18800, err: 2200, k_lo: 0.021, k_hi: 0.034, source: 'DESI', tracer: 'BGS' },
  { k: 0.040, pk: 19200, err: 2000, k_lo: 0.031, k_hi: 0.050, source: 'DESI', tracer: 'BGS' },
  { k: 0.058, pk: 18500, err: 1800, k_lo: 0.045, k_hi: 0.072, source: 'DESI', tracer: 'BGS' },
  { k: 0.082, pk: 16800, err: 1600, k_lo: 0.064, k_hi: 0.102, source: 'DESI', tracer: 'BGS' },
  // LRG1 (z~0.4)
  { k: 0.015, pk: 17800, err: 2400, k_lo: 0.012, k_hi: 0.019, source: 'DESI', tracer: 'LRG1' },
  { k: 0.022, pk: 18600, err: 2100, k_lo: 0.017, k_hi: 0.028, source: 'DESI', tracer: 'LRG1' },
  { k: 0.033, pk: 19100, err: 1900, k_lo: 0.026, k_hi: 0.042, source: 'DESI', tracer: 'LRG1' },
  { k: 0.048, pk: 18900, err: 1700, k_lo: 0.038, k_hi: 0.061, source: 'DESI', tracer: 'LRG1' },
  { k: 0.070, pk: 17200, err: 1500, k_lo: 0.055, k_hi: 0.088, source: 'DESI', tracer: 'LRG1' },
  { k: 0.100, pk: 14200, err: 1400, k_lo: 0.079, k_hi: 0.126, source: 'DESI', tracer: 'LRG1' },
  // LRG2 (z~0.7)
  { k: 0.017, pk: 18000, err: 2200, k_lo: 0.013, k_hi: 0.022, source: 'DESI', tracer: 'LRG2' },
  { k: 0.025, pk: 18900, err: 2000, k_lo: 0.020, k_hi: 0.032, source: 'DESI', tracer: 'LRG2' },
  { k: 0.038, pk: 19300, err: 1800, k_lo: 0.030, k_hi: 0.048, source: 'DESI', tracer: 'LRG2' },
  { k: 0.055, pk: 18700, err: 1600, k_lo: 0.044, k_hi: 0.070, source: 'DESI', tracer: 'LRG2' },
  { k: 0.080, pk: 16500, err: 1400, k_lo: 0.063, k_hi: 0.101, source: 'DESI', tracer: 'LRG2' },
  { k: 0.115, pk: 13000, err: 1300, k_lo: 0.091, k_hi: 0.145, source: 'DESI', tracer: 'LRG2' },
  // LRG3 (z~1.0)
  { k: 0.019, pk: 18200, err: 2100, k_lo: 0.015, k_hi: 0.024, source: 'DESI', tracer: 'LRG3' },
  { k: 0.028, pk: 19000, err: 1900, k_lo: 0.022, k_hi: 0.036, source: 'DESI', tracer: 'LRG3' },
  { k: 0.042, pk: 19400, err: 1700, k_lo: 0.033, k_hi: 0.053, source: 'DESI', tracer: 'LRG3' },
  { k: 0.062, pk: 18400, err: 1500, k_lo: 0.049, k_hi: 0.078, source: 'DESI', tracer: 'LRG3' },
  { k: 0.090, pk: 15800, err: 1400, k_lo: 0.071, k_hi: 0.113, source: 'DESI', tracer: 'LRG3' },
  { k: 0.130, pk: 11800, err: 1200, k_lo: 0.103, k_hi: 0.164, source: 'DESI', tracer: 'LRG3' },
  // ELG2 (z~1.4)
  { k: 0.020, pk: 18300, err: 2300, k_lo: 0.016, k_hi: 0.026, source: 'DESI', tracer: 'ELG2' },
  { k: 0.030, pk: 19100, err: 2000, k_lo: 0.024, k_hi: 0.038, source: 'DESI', tracer: 'ELG2' },
  { k: 0.045, pk: 19200, err: 1800, k_lo: 0.036, k_hi: 0.057, source: 'DESI', tracer: 'ELG2' },
  { k: 0.065, pk: 18100, err: 1600, k_lo: 0.052, k_hi: 0.082, source: 'DESI', tracer: 'ELG2' },
  { k: 0.095, pk: 15200, err: 1500, k_lo: 0.075, k_hi: 0.120, source: 'DESI', tracer: 'ELG2' },
  { k: 0.140, pk: 11000, err: 1300, k_lo: 0.111, k_hi: 0.176, source: 'DESI', tracer: 'ELG2' },
  // QSO (z~1.5)
  { k: 0.021, pk: 18100, err: 2500, k_lo: 0.017, k_hi: 0.027, source: 'DESI', tracer: 'QSO' },
  { k: 0.032, pk: 19000, err: 2200, k_lo: 0.025, k_hi: 0.040, source: 'DESI', tracer: 'QSO' },
  { k: 0.047, pk: 19100, err: 1900, k_lo: 0.037, k_hi: 0.059, source: 'DESI', tracer: 'QSO' },
  { k: 0.068, pk: 17900, err: 1700, k_lo: 0.054, k_hi: 0.086, source: 'DESI', tracer: 'QSO' },
  { k: 0.100, pk: 14800, err: 1500, k_lo: 0.079, k_hi: 0.126, source: 'DESI', tracer: 'QSO' },
  { k: 0.150, pk: 10200, err: 1400, k_lo: 0.119, k_hi: 0.189, source: 'DESI', tracer: 'QSO' },
];

export const desiDR1Data: DESIDataPoint[] = [...cmbData, ...desiData];

// Combined DESI-only data (all tracers combined)
export const desiGCOnly = desiData;

// CMB-only data (Planck 2018)
export const cmbOnly = cmbData;
