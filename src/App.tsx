import { useState, useMemo, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import { desiDR1Data } from './desiData';
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

// ─── Main App ───────────────────────────────────────────────────────────────

export default function App() {
  const [cosmo, setCosmo] = useState<CosmoParams>({ ...DEFAULT_COSMO });
  const [shapefit, setShapefit] = useState<ShapeFitParams>({ ...DEFAULT_SHAPEFIT });
  const [redshift, setRedshift] = useState(0.5);
  const [activeTab, setActiveTab] = useState('cosmo');
  const [plotMode, setPlotMode] = useState<'pk' | 'kpk' | 'dkpk'>('dkpk');
  const [showDESI, setShowDESI] = useState(true);
  const [useNonlinear, setUseNonlinear] = useState(false);

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
            kPk_fid, kPk, kPk_nl_fid, kPk_nl, kPk3_fid, kPk3, kPk3_nl_fid, kPk3_nl,
            k_bispectrum, bispectrum_scoccimarro, bispectrum_sugiyama } = result;
    
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

  // Prepare bispectrum data
  const bispectrumData = useMemo(() => {
    const { k_bispectrum, bispectrum_scoccimarro, bispectrum_sugiyama } = result;
    return k_bispectrum.map((ki, i) => ({
      k: ki,
      k2_scoccimarro: ki * ki * bispectrum_scoccimarro[i],
      k2_sugiyama: ki * ki * bispectrum_sugiyama[i],
    }));
  }, [result]);

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
            Linear (EH98 + Syren) & Nonlinear (SYREN-HALOFIT) | ShapeFit template from{' '}
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
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Linear Matter Power Spectrum — {plotLabel}
                {plotMode === 'kpk' && <span className="text-xs text-gray-500">(linear scales)</span>}
              </h3>
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDESI}
                  onChange={(e) => setShowDESI(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                />
                <span>Show DESI DR1 data (Cereskaite et al. 2025)</span>
              </label>
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
            
            {/* DESI Data Points Overlay */}
            {showDESI && (
              <DESIDataPanel plotMode={plotMode} plotLabel={plotLabel} result={result} useNonlinear={useNonlinear} />
            )}
          </div>

          {/* Ratio Plot */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-4 shadow-xl">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              Modification Ratio: P(k) / P_fid(k)
            </h3>
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

          {/* Tree-Level Bispectrum Plot */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-4 shadow-xl">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Tree-Level Bispectrum (GEO-FPT)
            </h3>
            <p className="text-xs text-gray-400 mb-2">
              Diagonal configuration (k₁ = k₂ = k) in redshift space with b₁=b₂=bₛ=0
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={bispectrumData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="k"
                  scale="linear"
                  domain={[0.01, 0.3]}
                  ticks={[0.05, 0.1, 0.15, 0.2, 0.25, 0.3]}
                  tickFormatter={(v) => v.toFixed(2)}
                  stroke="#6B7280"
                  label={{ value: 'k [h/Mpc]', position: 'bottom', offset: 0, style: { fill: '#9CA3AF', fontSize: 12 } }}
                />
                <YAxis
                  scale="linear"
                  domain={['auto', 'auto']}
                  stroke="#6B7280"
                  tickFormatter={(v) => v.toExponential(1)}
                  label={{ value: 'k² B₀(k) [(Mpc/h)⁶]', angle: -90, position: 'insideLeft', offset: -5, style: { fill: '#9CA3AF', fontSize: 11 } }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: 12 }}
                  labelFormatter={(v) => `k = ${(v as number).toFixed(3)} h/Mpc`}
                  formatter={(value: number, name: string) => [value.toExponential(3), name]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="k2_scoccimarro" name="Scoccimarro k²B₀" stroke="#10B981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="k2_sugiyama" name="Sugiyama k²B₀" stroke="#8B5CF6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-500 mt-2">
              Tree-level bispectrum monopole computed using GEO-FPT implementation with modified linear power spectrum.
              Both Scoccimarro and Sugiyama bases shown for comparison. Based on dforero0896/geofptax.
            </p>
          </div>

          {/* Comparison Plots */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 shadow-xl">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">
              Effect Comparison: Cosmological vs ShapeFit Modifications
            </h3>
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
                <li><b>Tree-level bispectrum:</b> GEO-FPT implementation (dforero0896/geofptax) with modified linear power spectrum, showing both Scoccimarro and Sugiyama bases with b₁=b₂=bₛ=0</li>
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
                Bartlett et al. (2024) arXiv:2402.17492 | Brieden et al. (2021) arXiv:2106.07641 | 
                Cereskaite et al. (2025) arXiv:2507.16590 | Noriega et al. (2026) arXiv:2604.08895 (FolpsD) |
                Forero-Sánchez et al. (2026) geofptax (github.com/dforero0896/geofptax)
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

// ─── DESI Data Panel ────────────────────────────────────────────────────────

function DESIDataPanel({ plotMode, plotLabel, result, useNonlinear }: { 
  plotMode: string; 
  plotLabel: string; 
  result: PowerSpectrumResult;
  useNonlinear: boolean;
}) {
  // Prepare all data using useMemo to avoid recalculation
  const { transformedData, theoryData } = useMemo(() => {
    // Transform DESI data to match the current plot mode
    const transformed = desiDR1Data.map(d => {
      let y: number, yErr: number;
      if (plotMode === 'pk') {
        y = d.pk;
        yErr = d.err;
      } else if (plotMode === 'kpk') {
        y = d.k * d.pk;
        yErr = d.k * d.err;
      } else {
        // dkpk = k^3 * P(k) / (2π²)
        const factor = d.k * d.k * d.k / (2 * Math.PI * Math.PI);
        y = factor * d.pk;
        yErr = factor * d.err;
      }
      return { ...d, y, yErr };
    });

    // Prepare theory curves at z=0 (to match DESI data)
    const { k, pk_nl_fid, pk_nl, pk_fid } = result;
    
    const theoryPoints: { k: number; linear_fid: number; linear_mod: number; nonlinear_fid: number; nonlinear_mod: number }[] = [];
    
    for (let i = 0; i < k.length; i++) {
      const ki = k[i];
      if (ki < 0.0002 || ki > 0.2) continue;
      
      let linear_fid: number, linear_mod: number, nonlinear_fid: number, nonlinear_mod: number;
      
      if (plotMode === 'pk') {
        linear_fid = pk_fid[i];
        linear_mod = result.pk[i];
        nonlinear_fid = pk_nl_fid[i];
        nonlinear_mod = pk_nl[i];
      } else if (plotMode === 'kpk') {
        linear_fid = ki * pk_fid[i];
        linear_mod = ki * result.pk[i];
        nonlinear_fid = ki * pk_nl_fid[i];
        nonlinear_mod = ki * pk_nl[i];
      } else {
        // dkpk
        const factor = ki * ki * ki / (2 * Math.PI * Math.PI);
        linear_fid = factor * pk_fid[i];
        linear_mod = factor * result.pk[i];
        nonlinear_fid = factor * pk_nl_fid[i];
        nonlinear_mod = factor * pk_nl[i];
      }
      
      theoryPoints.push({ k: ki, linear_fid, linear_mod, nonlinear_fid, nonlinear_mod });
    }
    
    return { transformedData: transformed, theoryData: theoryPoints };
  }, [result, plotMode]);

  return (
    <div className="mt-3 border-t border-gray-700 pt-3">
      <h4 className="text-xs font-semibold text-gray-400 mb-2">
        DESI DR1 + Planck CMB data (Cereskaite et al. 2025, arXiv:2507.16590) — z=0 nonlinear reconstruction
      </h4>
      <p className="text-xs text-gray-500 mb-2">
        Theory curves shown for comparison. Data points available in the original publication.
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis
            dataKey="k"
            type="number"
            scale={plotMode === 'kpk' ? 'linear' : 'log'}
            domain={plotMode === 'kpk' ? [0.01, 0.2] : [0.0002, 0.2]}
            tickFormatter={(v: number) => v.toExponential(1)}
            stroke="#6B7280"
            label={{ value: 'k [h/Mpc]', position: 'bottom', offset: 0, style: { fill: '#9CA3AF', fontSize: 12 } }}
          />
          <YAxis
            type="number"
            scale={plotMode === 'kpk' ? 'linear' : 'log'}
            domain={['auto', 'auto']}
            tickFormatter={plotMode === 'kpk' ? (v: number) => v.toFixed(0) : (v: number) => v.toExponential(1)}
            stroke="#6B7280"
            label={{ value: plotLabel, angle: -90, position: 'insideLeft', offset: -5, style: { fill: '#9CA3AF', fontSize: 11 } }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: 11 }}
            formatter={(value: any, name: any) => {
              return [`${Number(value).toExponential(3)}`, name];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          
          {/* Theory lines */}
          <Line type="monotone" dataKey="linear_fid" data={theoryData} stroke="#60A5FA" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Linear (fiducial)" />
          <Line type="monotone" dataKey="linear_mod" data={theoryData} stroke="#60A5FA" strokeWidth={2} dot={false} name="Linear (modified)" />
          <Line type="monotone" dataKey="nonlinear_fid" data={theoryData} stroke="#F97316" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Nonlinear (fiducial)" />
          <Line type="monotone" dataKey="nonlinear_mod" data={theoryData} stroke="#F97316" strokeWidth={2} dot={false} name="Nonlinear (modified)" />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-500 mt-1">
        Data from <a href="https://arxiv.org/abs/2507.16590" target="_blank" rel="noopener" className="text-blue-400 hover:underline">Cereskaite et al. (2025)</a>. 
        Full data: <a href="https://zenodo.org/records/19788154" target="_blank" rel="noopener" className="text-blue-400 hover:underline">Zenodo</a>. 
        Points shown are representative; error bars indicate 1σ uncertainties. Theory curves show both linear (blue) and nonlinear (orange) predictions.
      </p>
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
