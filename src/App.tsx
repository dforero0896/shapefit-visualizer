import { useState, useMemo, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import {
  computePowerSpectrum,
  DEFAULT_COSMO,
  DEFAULT_SHAPEFIT,
  type CosmoParams,
  type ShapeFitParams,
  type PowerSpectrumResult,
} from './powerSpectrum';

// ─── Slider Component ───────────────────────────────────────────────────────

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  latex?: string;
  description?: string;
}

function Slider({ label, value, min, max, step, onChange, latex, description }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-gray-300">
          {latex ? <span dangerouslySetInnerHTML={{ __html: latex }} /> : label}
        </label>
        <span className="text-sm font-mono text-blue-400 bg-gray-800 px-2 py-0.5 rounded">
          {value.toFixed(step < 0.01 ? 3 : step < 0.1 ? 2 : 3)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${pct}%, #374151 ${pct}%, #374151 100%)`
        }}
      />
      {description && <p className="text-xs text-gray-500 mt-0.5 italic">{description}</p>}
    </div>
  );
}

// ─── Tab Component ──────────────────────────────────────────────────────────

function Tabs({ activeTab, onChange }: { activeTab: string; onChange: (id: string) => void }) {
  const tabs = [
    { id: 'cosmo', label: '🌌 Cosmological' },
    { id: 'shapefit', label: '📐 ShapeFit' },
  ];
  return (
    <div className="flex border-b border-gray-700 mb-4">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2 text-sm font-medium transition-all ${
            activeTab === tab.id
              ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-700/50'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/30'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── Viridis-like colormap ──────────────────────────────────────────────────

function viridisColor(t: number): string {
  // Simplified viridis colormap (blue -> green -> yellow)
  t = Math.max(0, Math.min(1, t));
  const r = Math.round(255 * Math.max(0, Math.min(1, -0.35 + 2.5 * t * t)));
  const g = Math.round(255 * Math.max(0, Math.min(1, 0.05 + 0.95 * t)));
  const b = Math.round(255 * Math.max(0, Math.min(1, 0.55 + 0.45 * Math.cos(3.5 * t * Math.PI))));
  return `rgb(${r},${g},${b})`;
}

// ─── Download helper ────────────────────────────────────────────────────────

function downloadSVG(elementId: string, filename: string) {
  const svgElement = document.querySelector(`#${elementId} svg`);
  if (!svgElement) return;
  
  const clone = svgElement.cloneNode(true) as SVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  
  // Add white background
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', '100%');
  bg.setAttribute('height', '100%');
  bg.setAttribute('fill', '#111827');
  clone.insertBefore(bg, clone.firstChild);
  
  const svgData = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Main App ───────────────────────────────────────────────────────────────

export default function App() {
  const [cosmo, setCosmo] = useState<CosmoParams>({ ...DEFAULT_COSMO });
  const [shapefit, setShapefit] = useState<ShapeFitParams>({ ...DEFAULT_SHAPEFIT });
  const [redshift, setRedshift] = useState(0.5);
  const [activeTab, setActiveTab] = useState('cosmo');
  const [plotMode, setPlotMode] = useState<'pk' | 'kpk' | 'dkpk'>('kpk');
  const [useNonlinear, setUseNonlinear] = useState(false);
  const [showSweep, setShowSweep] = useState(false);
  const [sweepParam, setSweepParam] = useState('omega_m');
  const [sweepType, setSweepType] = useState<'cosmo' | 'shapefit'>('cosmo');

  const result = useMemo(() => {
    return computePowerSpectrum(cosmo, shapefit, redshift);
  }, [cosmo, shapefit, redshift]);

  const updateCosmo = useCallback((key: keyof CosmoParams, value: number) => {
    setCosmo(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateShapefit = useCallback((key: keyof ShapeFitParams, value: number) => {
    setShapefit(prev => ({ ...prev, [key]: value }));
  }, []);

  // Prepare chart data — focus on k = 0.02 to 0.5
  const chartData = useMemo(() => {
    const { k, pk_fid, pknow_fid, pk, pknow, pk_nl_fid, pk_nl, 
            kPk_fid, kPk, kPk_nl_fid, kPk_nl, kPk3_fid, kPk3, kPk3_nl_fid, kPk3_nl } = result;
    
    return k.map((ki, i) => {
      let y_fid: number, y_mod: number;
      
      if (useNonlinear) {
        if (plotMode === 'pk') {
          y_fid = pk_nl_fid[i];
          y_mod = pk_nl[i];
        } else if (plotMode === 'kpk') {
          y_fid = kPk_nl_fid[i];
          y_mod = kPk_nl[i];
        } else {
          y_fid = kPk3_nl_fid[i];
          y_mod = kPk3_nl[i];
        }
      } else {
        if (plotMode === 'pk') {
          y_fid = pk_fid[i];
          y_mod = pk[i];
        } else if (plotMode === 'kpk') {
          y_fid = kPk_fid[i];
          y_mod = kPk[i];
        } else {
          y_fid = kPk3_fid[i];
          y_mod = kPk3[i];
        }
      }
      
      return {
        k: ki,
        logk: Math.log10(ki),
        fiducial: y_fid,
        modified: y_mod,
        noWiggleFid: plotMode === 'pk' ? pknow_fid[i] : 
                     plotMode === 'kpk' ? ki * pknow_fid[i] : 
                     ki * ki * ki * pknow_fid[i] / (2 * Math.PI * Math.PI),
        noWiggleMod: plotMode === 'pk' ? pknow[i] : 
                     plotMode === 'kpk' ? ki * pknow[i] : 
                     ki * ki * ki * pknow[i] / (2 * Math.PI * Math.PI),
        ratio: y_mod / y_fid,
      };
    });
  }, [result, plotMode, useNonlinear]);

  const ratioData = useMemo(() => {
    return chartData.map(d => ({
      k: d.k,
      ratio: d.ratio,
    }));
  }, [chartData]);

  // Parameter sweep data - optimized for performance
  const sweepData = useMemo(() => {
    if (!showSweep) return { lines: [], combinedData: [] };
    
    const nLines = 8; // Reduced from 12 for better performance
    const paramRanges: Record<string, { min: number; max: number; label: string }> = {
      // Cosmological parameters
      omega_m: { min: 0.2, max: 0.4, label: 'Ω_m' },
      omega_b: { min: 0.03, max: 0.07, label: 'Ω_b' },
      h: { min: 0.55, max: 0.8, label: 'h' },
      n_s: { min: 0.85, max: 1.1, label: 'n_s' },
      sigma8: { min: 0.6, max: 1.0, label: 'σ₈' },
      // ShapeFit parameters
      dm: { min: -0.3, max: 0.3, label: 'δm' },
      dn: { min: -0.3, max: 0.3, label: 'δn' },
      dA: { min: 0.7, max: 1.3, label: 'δA' },
      deps: { min: -0.15, max: 0.15, label: 'δε' },
      dgam: { min: -0.5, max: 0.5, label: 'δγ' },
      dc: { min: -0.5, max: 0.5, label: 'δc' },
    };
    
    const range = paramRanges[sweepParam];
    if (!range) return { lines: [], combinedData: [] };
    
    const values = Array.from({ length: nLines }, (_, i) => 
      range.min + (range.max - range.min) * i / (nLines - 1)
    );
    
    const lines = values.map((val, idx) => ({
      value: val,
      label: range.label,
      color: viridisColor(idx / (nLines - 1)),
      dataKey: `line_${idx}`,
    }));
    
    // Compute power spectrum once per parameter value (only 8 calls)
    // Use linear only for sweep to improve performance
    const results = values.map((val) => {
      const testCosmo = sweepType === 'cosmo' ? { ...cosmo, [sweepParam]: val } : { ...cosmo };
      const testShapefit = sweepType === 'shapefit' ? { ...shapefit, [sweepParam]: val } : { ...shapefit };
      return computePowerSpectrum(testCosmo, testShapefit, redshift);
    });
    
    // Build combined data array from pre-computed results
    // Use a subset of k-points for better performance
    const kGrid = results[0].k;
    const stride = Math.max(1, Math.floor(kGrid.length / 100)); // Use ~100 points
    const combinedData = [];
    
    for (let i = 0; i < kGrid.length; i += stride) {
      const ki = kGrid[i];
      const point: Record<string, number> = { k: ki };
      
      results.forEach((testResult, idx) => {
        let y: number;
        // Always use linear for sweep (much faster)
        if (plotMode === 'pk') y = testResult.pk[i];
        else if (plotMode === 'kpk') y = testResult.kPk[i];
        else y = testResult.kPk3[i];
        
        point[`line_${idx}`] = y;
      });
      
      combinedData.push(point);
    }
    
    return { lines, combinedData };
  }, [showSweep, sweepParam, sweepType, cosmo, shapefit, redshift, plotMode]);

  // Compute ratio to fiducial (middle line) for sweep plot
  const sweepRatioData = useMemo(() => {
    if (!showSweep || sweepData.lines.length === 0) return { lines: [], combinedData: [] };
    
    // Use middle line as fiducial reference
    const fiducialIdx = Math.floor(sweepData.lines.length / 2);
    const fiducialKey = sweepData.lines[fiducialIdx].dataKey;
    
    const ratioData = sweepData.combinedData.map((point) => {
      const ratioPoint: Record<string, number> = { k: point.k };
      const fiducialValue = point[fiducialKey];
      
      sweepData.lines.forEach((line) => {
        const value = point[line.dataKey];
        ratioPoint[line.dataKey] = fiducialValue !== 0 ? value / fiducialValue : 1;
      });
      
      return ratioPoint;
    });
    
    return { lines: sweepData.lines, combinedData: ratioData };
  }, [showSweep, sweepData]);

  const plotLabel = (useNonlinear ? 'Nonlinear ' : 'Linear ') + 
                    (plotMode === 'pk' ? 'P(k) [(Mpc/h)³]' :
                     plotMode === 'kpk' ? 'k·P(k) [(Mpc/h)²]' :
                     'Δ²(k) = k³P(k)/(2π²)');

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <header className="bg-gray-800/80 backdrop-blur-sm border-b border-gray-700 px-4 sm:px-6 py-3 sticky top-0 z-10">
        <div className="max-w-[1800px] mx-auto">
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">📊</span>
            Linear Power Spectrum Explorer
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
            Linear (EH98 + Syren) & Nonlinear (SYREN-HALOFIT) power spectrum with ShapeFit template from{' '}
            <a href="https://github.com/dforero0896/desilike/tree/shapefit-prime" target="_blank" rel="noopener" className="text-blue-400 hover:underline">
              desilike/shapefit-prime
            </a>
          </p>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row max-w-[1800px] mx-auto">
        {/* Left Panel: Controls */}
        <aside className="w-full lg:w-[380px] xl:w-[420px] bg-gray-800/50 border-r border-gray-700 p-4 overflow-y-auto lg:max-h-[calc(100vh-72px)] lg:sticky lg:top-[72px]">
          {/* Redshift */}
          <div className="mb-4 p-3 bg-gray-800 rounded-lg border border-gray-600">
            <Slider
              label="Redshift"
              value={redshift}
              min={0}
              max={3}
              step={0.05}
              onChange={setRedshift}
              latex="z"
              description="Effective redshift for power spectrum evaluation"
            />
            <div className="flex items-center justify-between text-xs text-gray-400 mt-1 px-1">
              <span>f(z) = {result.f.toFixed(4)}</span>
              <span>σ₈(z) = {result.sigma8_z.toFixed(4)}</span>
            </div>
          </div>

          <Tabs activeTab={activeTab} onChange={setActiveTab} />

          {/* Cosmological Parameters */}
          {activeTab === 'cosmo' && (
            <div className="space-y-1">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold text-gray-300">Cosmological Parameters</h3>
                <button onClick={() => setCosmo({ ...DEFAULT_COSMO })} className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition-colors">
                  ↺ Reset
                </button>
              </div>
              
              <Slider label="Ω_m" value={cosmo.omega_m} min={0.1} max={0.6} step={0.005}
                onChange={(v) => updateCosmo('omega_m', v)}
                latex="Ω<sub>m</sub>" description="Total matter density (CDM + baryons)" />
              <Slider label="Ω_b" value={cosmo.omega_b} min={0.01} max={0.1} step={0.001}
                onChange={(v) => updateCosmo('omega_b', v)}
                latex="Ω<sub>b</sub>" description="Baryon density parameter" />
              <Slider label="h" value={cosmo.h} min={0.5} max={0.9} step={0.005}
                onChange={(v) => updateCosmo('h', v)}
                latex="h = H₀/(100 km/s/Mpc)" description="Dimensionless Hubble parameter" />
              <Slider label="n_s" value={cosmo.n_s} min={0.8} max={1.2} step={0.005}
                onChange={(v) => updateCosmo('n_s', v)}
                latex="n<sub>s</sub>" description="Scalar spectral index" />
              <Slider label="σ₈" value={cosmo.sigma8} min={0.5} max={1.2} step={0.005}
                onChange={(v) => updateCosmo('sigma8', v)}
                latex="σ<sub>8</sub>" description="Amplitude of matter fluctuations at 8 Mpc/h" />

              <div className="mt-4 p-3 bg-blue-900/20 border border-blue-800/50 rounded-lg">
                <h4 className="text-xs font-semibold text-blue-300 mb-1">Power Spectrum Calculation</h4>
                <div className="text-xs text-gray-400 space-y-1">
                  <p>• <b>No-wiggle</b>: EH98 zero-baryon transfer function (smooth)</p>
                  <p>• <b>Full P(k)</b>: No-wiggle × exp(logF<sub>Syren</sub>) (adds BAO wiggles)</p>
                  <p>• Normalized to σ₈ via top-hat window at R=8 Mpc/h</p>
                  <p>• k range: 0.005 – 0.5 h/Mpc (Syren valid: 0.009 – 9 h/Mpc)</p>
                </div>
              </div>
            </div>
          )}

          {/* ShapeFit Parameters */}
          {activeTab === 'shapefit' && (
            <div className="space-y-1">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold text-gray-300">ShapeFit Template Parameters</h3>
                <button onClick={() => setShapefit({ ...DEFAULT_SHAPEFIT })} className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition-colors">
                  ↺ Reset
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Modify the power spectrum shape relative to the fiducial cosmology, following the ShapeFit parameterization 
                (<a href="https://arxiv.org/abs/2106.07641" target="_blank" rel="noopener" className="text-blue-400 hover:underline">Brieden et al. 2021</a>).
              </p>
              
              <div className="mb-3 p-2 bg-purple-900/20 border border-purple-800/30 rounded">
                <p className="text-xs text-purple-300 font-semibold">Shape parameters (modify spectrum shape):</p>
              </div>
              
              <Slider label="δm" value={shapefit.dm} min={-0.5} max={0.5} step={0.01}
                onChange={(v) => updateShapefit('dm', v)}
                latex="δm" description="Log-slope of P_now(k) at pivot k_p" />
              <Slider label="δn" value={shapefit.dn} min={-0.5} max={0.5} step={0.01}
                onChange={(v) => updateShapefit('dn', v)}
                latex="δn = n<sub>s</sub> − n<sub>s,fid</sub>" description="Scale-free spectral tilt" />
              <Slider label="δc" value={shapefit.dc} min={-1.0} max={1.0} step={0.01}
                onChange={(v) => updateShapefit('dc', v)}
                latex="δc" description="Curvature of ln P at the pivot" />
              <Slider label="δε" value={shapefit.deps} min={-0.3} max={0.3} step={0.005}
                onChange={(v) => updateShapefit('deps', v)}
                latex="δε" description="Broadband (equality) scale shift" />
              <Slider label="δγ" value={shapefit.dgam} min={-1.0} max={1.0} step={0.01}
                onChange={(v) => updateShapefit('dgam', v)}
                latex="δγ" description="Wiggle depth (BAO amplitude)" />

              <div className="mb-3 mt-4 p-2 bg-orange-900/20 border border-orange-800/30 rounded">
                <p className="text-xs text-orange-300 font-semibold">Amplitude & growth:</p>
              </div>

              <Slider label="δA" value={shapefit.dA} min={0.5} max={1.5} step={0.01}
                onChange={(v) => updateShapefit('dA', v)}
                latex="δA<sub>p</sub>" description="Amplitude of P_now at the pivot" />
              <Slider label="δf" value={shapefit.df} min={0.5} max={1.5} step={0.01}
                onChange={(v) => updateShapefit('df', v)}
                latex="δf" description="Growth rate parameter" />

              <div className="mb-3 mt-4 p-2 bg-green-900/20 border border-green-800/30 rounded">
                <p className="text-xs text-green-300 font-semibold">AP & pivot:</p>
              </div>

              <Slider label="q_∥" value={shapefit.qpar} min={0.8} max={1.2} step={0.005}
                onChange={(v) => updateShapefit('qpar', v)}
                latex="q<sub>∥</sub>" description="Alcock-Paczynski parallel scaling. Rescales k_∥ = k·μ to account for distance errors along the line-of-sight. Shifts BAO wiggles anisotropically." />
              <Slider label="q_⊥" value={shapefit.qper} min={0.8} max={1.2} step={0.005}
                onChange={(v) => updateShapefit('qper', v)}
                latex="q<sub>⊥</sub>" description="Alcock-Paczynski perpendicular scaling. Rescales k_⊥ = k·√(1-μ²) to account for distance errors in the transverse direction. Shifts BAO wiggles anisotropically." />
              <Slider label="k_p" value={shapefit.kp} min={0.01} max={0.1} step={0.001}
                onChange={(v) => updateShapefit('kp', v)}
                latex="k<sub>p</sub> [h/Mpc]" description="Pivot wavenumber" />

              <div className="mt-4 p-3 bg-gray-800 rounded-lg border border-gray-600">
                <h4 className="text-xs font-semibold text-gray-400 mb-2">ShapeFit Template Formula</h4>
                <div className="text-xs text-gray-300 font-mono leading-relaxed bg-gray-900 p-2 rounded">
                  <div className="mb-1 text-gray-400">No-wiggle (isotropic AP):</div>
                  <div>P<sup>now</sup>(k) → δA · P<sup>now</sup>(k·q<sub>ap</sub>·e<sup>−δε</sup>) · T(k)</div>
                  <div className="mt-1">q<sub>ap</sub> = (q<sub>∥</sub> · q<sub>⊥</sub><sup>2</sup>)<sup>1/3</sup></div>
                  <div className="mt-1">T(k) = exp[δm/a · tanh(a·ln(k·q<sub>ap</sub>/k<sub>p</sub>))</div>
                  <div className="ml-4">+ δn·ln(k·q<sub>ap</sub>/k<sub>p</sub>)</div>
                  <div className="ml-4">+ δc/(2a²) · tanh²(a·ln(k·q<sub>ap</sub>/k<sub>p</sub>))]</div>
                  <div className="mt-2 mb-1 text-gray-400">Full P(k) (anisotropic AP):</div>
                  <div>P(k) = ½∫P(k,μ)dμ</div>
                  <div className="mt-1">k'(μ) = k·√[(μ/q<sub>∥</sub>)² + ((1-μ²)/q<sub>⊥</sub>)²]</div>
                  <div className="mt-1">P(k) = P<sup>now</sup>(k) · [W(k)]<sup>1+δγ</sup></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  where W(k) = P<sub>fid</sub>(k) / P<sup>now</sup><sub>fid</sub>(k)
                </p>
              </div>
            </div>
          )}
        </aside>

        {/* Right Panel: Plots */}
        <main className="flex-1 p-4 overflow-y-auto">
          {/* Plot mode selector */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="text-sm text-gray-400">Plot quantity:</span>
            <div className="flex gap-1">
              {[
                { id: 'dkpk' as const, label: 'Δ²(k)' },
                { id: 'kpk' as const, label: 'k·P(k)' },
                { id: 'pk' as const, label: 'P(k)' },
              ].map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setPlotMode(mode.id)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                    plotMode === mode.id
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm text-gray-400">Spectrum:</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setUseNonlinear(false)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                    !useNonlinear
                      ? 'bg-green-600 text-white shadow-lg shadow-green-600/20'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Linear
                </button>
                <button
                  onClick={() => setUseNonlinear(true)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                    useNonlinear
                      ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Nonlinear (SYREN-HALOFIT)
                </button>
              </div>
            </div>
          </div>

          {/* Main Power Spectrum Plot */}
          <div id="main-pk-plot" className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Linear Matter Power Spectrum — {plotLabel}
                {plotMode === 'kpk' && <span className="text-xs text-gray-500">(linear scales)</span>}
              </h3>
              <button
                onClick={() => downloadSVG('main-pk-plot', `power-spectrum-${plotMode}-${useNonlinear ? 'nonlinear' : 'linear'}.svg`)}
                className="px-3 py-1.5 text-xs rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors flex items-center gap-1"
                title="Download as SVG"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="k"
                  scale={plotMode === 'kpk' ? 'linear' : 'log'}
                  domain={plotMode === 'kpk' ? [0.02, 0.3] : [0.005, 0.5]}
                  ticks={plotMode === 'kpk' ? [0.02, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3] : [0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5]}
                  tickFormatter={(v) => v.toString()}
                  stroke="#6B7280"
                  label={{ value: 'k [h/Mpc]', position: 'bottom', offset: 0, style: { fill: '#9CA3AF', fontSize: 12 } }}
                />
                <YAxis
                  scale={plotMode === 'kpk' ? 'linear' : 'log'}
                  domain={plotMode === 'kpk' ? ['auto', 'auto'] : ['auto', 'auto']}
                  stroke="#6B7280"
                  tickFormatter={plotMode === 'kpk' ? (v) => v.toFixed(1) : (v) => v.toExponential(1)}
                  label={{ value: plotLabel, angle: -90, position: 'insideLeft', offset: -5, style: { fill: '#9CA3AF', fontSize: 11 } }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: 12 }}
                  labelFormatter={(v) => `k = ${(v as number).toFixed(4)} h/Mpc`}
                  formatter={(value: number, name: string) => [plotMode === 'kpk' ? value.toFixed(2) : value.toExponential(3), name]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine x={shapefit.kp} stroke="#fbbf24" strokeDasharray="5 5" strokeWidth={1.5}
                  label={{ value: `k_p=${shapefit.kp}`, fill: '#fbbf24', fontSize: 10, position: 'top' }} />
                <Line type="monotone" dataKey="fiducial" name="P_fid(k)" stroke="#60A5FA" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="modified" name="P(k) [modified]" stroke="#F87171" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="noWiggleFid" name="P_now,fid(k)" stroke="#60A5FA" strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
                <Line type="monotone" dataKey="noWiggleMod" name="P_now(k) [modified]" stroke="#F87171" strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Parameter Sweep Panel */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                Parameter Sweep
              </h3>
              <button
                onClick={() => setShowSweep(!showSweep)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  showSweep ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
              >
                {showSweep ? 'Hide Sweep' : 'Show Sweep'}
              </button>
            </div>
            
            {showSweep && (
              <>
                <div className="flex flex-wrap gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Parameter type:</span>
                    <select
                      value={sweepType}
                      onChange={(e) => {
                        setSweepType(e.target.value as 'cosmo' | 'shapefit');
                        setSweepParam(e.target.value === 'cosmo' ? 'omega_m' : 'dm');
                      }}
                      className="text-xs bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-300"
                    >
                      <option value="cosmo">Cosmological</option>
                      <option value="shapefit">ShapeFit</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Parameter:</span>
                    <select
                      value={sweepParam}
                      onChange={(e) => setSweepParam(e.target.value)}
                      className="text-xs bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-300"
                    >
                      {sweepType === 'cosmo' ? (
                        <>
                          <option value="omega_m">Ω_m</option>
                          <option value="omega_b">Ω_b</option>
                          <option value="h">h</option>
                          <option value="n_s">n_s</option>
                          <option value="sigma8">σ₈</option>
                        </>
                      ) : (
                        <>
                          <option value="dm">δm</option>
                          <option value="dn">δn</option>
                          <option value="dA">δA</option>
                          <option value="deps">δε</option>
                          <option value="dgam">δγ</option>
                          <option value="dc">δc</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
                
                <div className="flex gap-4">
                    <div className="flex-1">
                      <div id="sweep-plot" className="relative">
                        <ResponsiveContainer width="100%" height={350}>
                          <LineChart data={sweepData.combinedData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                            <XAxis
                              dataKey="k"
                              type="number"
                              scale={plotMode === 'kpk' ? 'linear' : 'log'}
                              domain={plotMode === 'kpk' ? [0.02, 0.3] : [0.005, 0.5]}
                              ticks={plotMode === 'kpk' ? [0.02, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3] : [0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5]}
                              tickFormatter={(v) => v.toString()}
                              stroke="#6B7280"
                              label={{ value: 'k [h/Mpc]', position: 'bottom', offset: 0, style: { fill: '#9CA3AF', fontSize: 12 } }}
                            />
                          <YAxis
                            scale={plotMode === 'kpk' ? 'linear' : 'log'}
                            domain={['auto', 'auto']}
                            stroke="#6B7280"
                            tickFormatter={plotMode === 'kpk' ? (v) => v.toFixed(1) : (v) => v.toExponential(1)}
                            label={{ value: `${plotLabel} (linear)`, angle: -90, position: 'insideLeft', offset: -5, style: { fill: '#9CA3AF', fontSize: 11 } }}
                          />                            <Tooltip
                              contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: 12 }}
                              labelFormatter={(v) => `k = ${(v as number).toFixed(4)} h/Mpc`}
                              formatter={(value: number) => [plotMode === 'kpk' ? value.toFixed(2) : value.toExponential(3), '']}
                            />
                            {sweepData.lines.map((line, idx) => (
                              <Line
                                key={idx}
                                dataKey={line.dataKey}
                                stroke={line.color}
                                strokeWidth={1.5}
                                dot={false}
                                name={`${line.label}=${line.value.toFixed(3)}`}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    
                    {/* Colorbar */}
                    <div className="flex flex-col items-center justify-center w-16">
                      <div className="text-xs text-gray-400 mb-1 text-center">
                        {sweepData.lines[0]?.label}
                      </div>
                      <div className="text-xs text-gray-300 mb-1">
                        {sweepData.lines[sweepData.lines.length - 1]?.value.toFixed(2)}
                      </div>
                      <div 
                        className="w-4 h-48 rounded"
                        style={{
                          background: `linear-gradient(to bottom, ${viridisColor(1)}, ${viridisColor(0.75)}, ${viridisColor(0.5)}, ${viridisColor(0.25)}, ${viridisColor(0)})`
                        }}
                      />
                      <div className="text-xs text-gray-300 mt-1">
                        {sweepData.lines[0]?.value.toFixed(2)}
                      </div>
                    </div>                </div>
                
                {/* Ratio to fiducial subpanel */}
                <div className="mt-4 border-t border-gray-700 pt-4">
                  <h4 className="text-xs font-semibold text-gray-400 mb-2">
                    Ratio to fiducial (middle value)
                  </h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={sweepRatioData.combinedData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis
                        dataKey="k"
                        type="number"
                        scale={plotMode === 'kpk' ? 'linear' : 'log'}
                        domain={plotMode === 'kpk' ? [0.02, 0.3] : [0.005, 0.5]}
                        ticks={plotMode === 'kpk' ? [0.02, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3] : [0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5]}
                        tickFormatter={(v) => v.toString()}
                        stroke="#6B7280"
                        label={{ value: 'k [h/Mpc]', position: 'bottom', offset: 0, style: { fill: '#9CA3AF', fontSize: 12 } }}
                      />
                      <YAxis
                        scale="linear"
                        domain={['auto', 'auto']}
                        stroke="#6B7280"
                        tickFormatter={(v) => v.toFixed(2)}
                        label={{ value: 'Ratio to fiducial', angle: -90, position: 'insideLeft', offset: -5, style: { fill: '#9CA3AF', fontSize: 11 } }}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: 12 }}
                        labelFormatter={(v) => `k = ${(v as number).toFixed(4)} h/Mpc`}
                        formatter={(value: number) => [value.toFixed(3), '']}
                      />
                      <ReferenceLine y={1} stroke="#4B5563" strokeDasharray="3 3" strokeWidth={1} />
                      {sweepRatioData.lines.map((line, idx) => (
                        <Line
                          key={idx}
                          dataKey={line.dataKey}
                          stroke={line.color}
                          strokeWidth={1.5}
                          dot={false}
                          name={`${line.label}=${line.value.toFixed(3)}`}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => downloadSVG('sweep-plot', `sweep-${sweepParam}-${plotMode}.svg`)}
                    className="px-3 py-1.5 text-xs rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors flex items-center gap-1"
                    title="Download as SVG"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Ratio Plot */}
          <div id="ratio-plot" className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                Modification Ratio: P(k) / P_fid(k)
              </h3>
              <button
                onClick={() => downloadSVG('ratio-plot', `ratio-${plotMode}.svg`)}
                className="px-3 py-1.5 text-xs rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors flex items-center gap-1"
                title="Download as SVG"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={ratioData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="k"
                  scale={plotMode === 'kpk' ? 'linear' : 'log'}
                  domain={plotMode === 'kpk' ? [0.02, 0.3] : [0.005, 0.5]}
                  ticks={plotMode === 'kpk' ? [0.02, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3] : [0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5]}
                  tickFormatter={(v) => v.toString()}
                  stroke="#6B7280"
                  label={{ value: 'k [h/Mpc]', position: 'bottom', offset: 0, style: { fill: '#9CA3AF', fontSize: 12 } }}
                />
                <YAxis
                  domain={[0.5, 1.5]}
                  stroke="#6B7280"
                  tickFormatter={(v) => v.toFixed(2)}
                  label={{ value: 'Ratio', angle: -90, position: 'insideLeft', offset: -5, style: { fill: '#9CA3AF', fontSize: 11 } }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: 12 }}
                  labelFormatter={(v) => `k = ${(v as number).toFixed(4)} h/Mpc`}
                  formatter={(value: number) => [value.toFixed(4), 'P/P_fid']}
                />
                <ReferenceLine y={1} stroke="#4B5563" strokeDasharray="3 3" strokeWidth={1.5} />
                <ReferenceLine x={shapefit.kp} stroke="#fbbf24" strokeDasharray="5 5" strokeWidth={1} />
                <Line type="monotone" dataKey="ratio" name="P(k)/P_fid(k)" stroke="#F87171" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Comparison Plots */}
          <div id="comparison-plots" className="bg-gray-800 rounded-xl border border-gray-700 p-4 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-300">
                Effect Comparison: Cosmological vs ShapeFit Modifications
              </h3>
              <button
                onClick={() => downloadSVG('comparison-plots', `comparison-${plotMode}.svg`)}
                className="px-3 py-1.5 text-xs rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors flex items-center gap-1"
                title="Download as SVG"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Shows how the current parameter choices modify Δ²(k) relative to the Planck 2018 fiducial cosmology.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CosmoEffectPlot cosmo={cosmo} plotMode={plotMode} />
              <ShapeFitEffectPlot cosmo={cosmo} shapefit={shapefit} plotMode={plotMode} />
            </div>
          </div>

          {/* Info Footer */}
          <div className="mt-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
            <h4 className="text-sm font-semibold text-gray-300 mb-2">About</h4>
            <div className="text-xs text-gray-400 space-y-2">
              <p>
                This app computes the matter power spectrum P(k) using:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><b>Linear:</b> Eisenstein & Hu (1998) zero-baryon transfer function + Syren (Bartlett et al. 2023) correction for BAO wiggles</li>
                <li><b>Nonlinear:</b> SYREN-HALOFIT (Bartlett et al. 2024) — symbolic regression-enhanced halofit model</li>
                <li><b>ShapeFit template</b> from desilike/shapefit-prime to parameterize spectral modifications</li>
              </ul>
              <p>
                The ShapeFit approach separates P(k) into a smooth no-wiggle component and a wiggle factor W(k) = P_fid/P_now,fid,
                each controlled by physically-motivated parameters (δm, δn, δγ, etc.). This enables efficient extraction of 
                cosmological information from galaxy clustering without running a Boltzmann solver at each step.
              </p>
              <p>
                The DESI DR1 data points (Cereskaite et al. 2025) represent the reconstructed <b>nonlinear</b> matter power spectrum 
                at z=0 from galaxy clustering measurements, which is why they should be compared with the nonlinear theory curves.
              </p>
              <p className="text-gray-500">
                References: Eisenstein & Hu (1998) ApJ 511, 5 | Bartlett et al. (2023) arXiv:2311.15865 | 
                Bartlett et al. (2024) arXiv:2402.17492 | Brieden et al. (2021) arXiv:2106.07641
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ─── Cosmological Effect Plot ───────────────────────────────────────────────

function CosmoEffectPlot({ cosmo, plotMode }: { cosmo: CosmoParams; plotMode: string }) {
  const data = useMemo(() => {
    const defaultResult = computePowerSpectrum(DEFAULT_COSMO, DEFAULT_SHAPEFIT, 0.5);
    const currentResult = computePowerSpectrum(cosmo, DEFAULT_SHAPEFIT, 0.5);
    
    const points: { k: number; ratio: number }[] = [];
    for (let i = 0; i < defaultResult.k.length; i++) {
      const ki = defaultResult.k[i];
      if (ki < 0.02 || ki > 0.5) continue;
      points.push({
        k: ki,
        ratio: currentResult.kPk3[i] / defaultResult.kPk3[i],
      });
    }
    return points;
  }, [cosmo]);

  return (
    <div className="border border-blue-800/30 rounded-lg p-3 bg-blue-900/10">
      <h4 className="text-xs font-semibold text-blue-400 mb-2">Cosmological Parameter Effect on Δ²(k)</h4>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="k" scale={plotMode === 'kpk' ? 'linear' : 'log'} domain={[0.02, 0.5]} 
            ticks={plotMode === 'kpk' ? [0.05, 0.1, 0.2, 0.3, 0.4, 0.5] : [0.02, 0.05, 0.1, 0.2, 0.5]}
            tickFormatter={(v) => v.toString()} stroke="#6B7280" fontSize={10} />
          <YAxis domain={['auto', 'auto']} tickFormatter={(v) => v.toFixed(2)} stroke="#6B7280" fontSize={10} />
          <Tooltip
            contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: 11 }}
            labelFormatter={(v) => `k = ${(v as number).toFixed(4)}`}
            formatter={(value: number) => [value.toFixed(4), 'Δ² ratio']}
          />
          <ReferenceLine y={1} stroke="#4B5563" strokeDasharray="3 3" />
          <Line type="monotone" dataKey="ratio" stroke="#60A5FA" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-500 mt-1">Ratio vs Planck 2018 fiducial (Ω_m=0.31, h=0.68, n_s=0.97)</p>
    </div>
  );
}

// ─── ShapeFit Effect Plot ───────────────────────────────────────────────────

function ShapeFitEffectPlot({ cosmo, shapefit, plotMode }: { cosmo: CosmoParams; shapefit: ShapeFitParams; plotMode: string }) {
  const data = useMemo(() => {
    const defaultResult = computePowerSpectrum(cosmo, DEFAULT_SHAPEFIT, 0.5);
    const currentResult = computePowerSpectrum(cosmo, shapefit, 0.5);
    
    const points: { k: number; ratio: number }[] = [];
    for (let i = 0; i < defaultResult.k.length; i++) {
      const ki = defaultResult.k[i];
      if (ki < 0.02 || ki > 0.5) continue;
      points.push({
        k: ki,
        ratio: currentResult.kPk3[i] / defaultResult.kPk3[i],
      });
    }
    return points;
  }, [cosmo, shapefit]);

  return (
    <div className="border border-red-800/30 rounded-lg p-3 bg-red-900/10">
      <h4 className="text-xs font-semibold text-red-400 mb-2">ShapeFit Parameter Effect on Δ²(k)</h4>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="k" scale={plotMode === 'kpk' ? 'linear' : 'log'} domain={[0.02, 0.5]}
            ticks={plotMode === 'kpk' ? [0.05, 0.1, 0.2, 0.3, 0.4, 0.5] : [0.02, 0.05, 0.1, 0.2, 0.5]}
            tickFormatter={(v) => v.toString()} stroke="#6B7280" fontSize={10} />
          <YAxis domain={['auto', 'auto']} tickFormatter={(v) => v.toFixed(2)} stroke="#6B7280" fontSize={10} />
          <Tooltip
            contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: 11 }}
            labelFormatter={(v) => `k = ${(v as number).toFixed(4)}`}
            formatter={(value: number) => [value.toFixed(4), 'Δ² ratio']}
          />
          <ReferenceLine y={1} stroke="#4B5563" strokeDasharray="3 3" />
          <ReferenceLine x={shapefit.kp} stroke="#fbbf24" strokeDasharray="5 5" strokeWidth={1} />
          <Line type="monotone" dataKey="ratio" stroke="#F87171" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-500 mt-1">Ratio vs fiducial ShapeFit (all params at default/null)</p>
    </div>
  );
}
