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

  // Compute power spectrum
  const result = useMemo(() => {
    return computePowerSpectrum(cosmo, shapefit, redshift);
  }, [cosmo, shapefit, redshift]);

  const updateCosmo = useCallback((key: keyof CosmoParams, value: number) => {
    setCosmo(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateShapefit = useCallback((key: keyof ShapeFitParams, value: number) => {
    setShapefit(prev => ({ ...prev, [key]: value }));
  }, []);

  // Prepare chart data
  const chartData = useMemo(() => {
    const { k, pk_fid, pknow_fid, pk, pknow, kPk_fid, kPk, kPk3_fid, kPk3 } = result;
    
    return k.map((ki, i) => {
      let y_fid: number, y_mod: number;
      
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
  }, [result, plotMode]);

  const ratioData = useMemo(() => {
    return chartData.map(d => ({
      k: d.k,
      ratio: d.ratio,
    }));
  }, [chartData]);

  const plotLabel = plotMode === 'pk' ? 'P(k) [(Mpc/h)³]' :
                    plotMode === 'kpk' ? 'k·P(k) [(Mpc/h)²]' :
                    'Δ²(k) = k³P(k)/(2π²)';

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
            Visualize how P(k) changes with cosmological parameters and ShapeFit template parameters
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

          {/* Tabs */}
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
              
              <Slider
                label="Ω_m"
                value={cosmo.omega_m}
                min={0.1}
                max={0.6}
                step={0.005}
                onChange={(v) => updateCosmo('omega_m', v)}
                latex="Ω<sub>m</sub>"
                description="Total matter density (CDM + baryons + neutrinos)"
              />
              <Slider
                label="Ω_b"
                value={cosmo.omega_b}
                min={0.01}
                max={0.1}
                step={0.001}
                onChange={(v) => updateCosmo('omega_b', v)}
                latex="Ω<sub>b</sub>"
                description="Baryon density parameter"
              />
              <Slider
                label="h"
                value={cosmo.h}
                min={0.5}
                max={0.9}
                step={0.005}
                onChange={(v) => updateCosmo('h', v)}
                latex="h = H₀/(100 km/s/Mpc)"
                description="Dimensionless Hubble parameter"
              />
              <Slider
                label="n_s"
                value={cosmo.n_s}
                min={0.8}
                max={1.2}
                step={0.005}
                onChange={(v) => updateCosmo('n_s', v)}
                latex="n<sub>s</sub>"
                description="Scalar spectral index of primordial fluctuations"
              />
              <Slider
                label="σ₈"
                value={cosmo.sigma8}
                min={0.5}
                max={1.2}
                step={0.005}
                onChange={(v) => updateCosmo('sigma8', v)}
                latex="σ<sub>8</sub>"
                description="Amplitude of matter fluctuations at 8 Mpc/h"
              />

              <div className="mt-4 p-3 bg-blue-900/20 border border-blue-800/50 rounded-lg">
                <h4 className="text-xs font-semibold text-blue-300 mb-1">How cosmological parameters affect P(k):</h4>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>• <b>Ω_m</b>: Changes the turnover scale k_eq ∝ Ω_m·h²</li>
                  <li>• <b>Ω_b</b>: Controls BAO wiggle amplitude (baryon oscillations)</li>
                  <li>• <b>h</b>: Shifts the entire spectrum via the shape parameter Γ = Ω_m·h</li>
                  <li>• <b>n_s</b>: Tilts the spectrum (more power at large/small scales)</li>
                  <li>• <b>σ₈</b>: Overall amplitude normalization</li>
                </ul>
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
              
              <Slider
                label="δm"
                value={shapefit.dm}
                min={-0.5}
                max={0.5}
                step={0.01}
                onChange={(v) => updateShapefit('dm', v)}
                latex="δm"
                description="Log-slope of P_now(k) at pivot k_p. Controls the broadband tilt."
              />
              <Slider
                label="δn"
                value={shapefit.dn}
                min={-0.5}
                max={0.5}
                step={0.01}
                onChange={(v) => updateShapefit('dn', v)}
                latex="δn = n<sub>s</sub> − n<sub>s,fid</sub>"
                description="Scale-free spectral tilt. Shifts the primordial index."
              />
              <Slider
                label="δc"
                value={shapefit.dc}
                min={-1.0}
                max={1.0}
                step={0.01}
                onChange={(v) => updateShapefit('dc', v)}
                latex="δc"
                description="Curvature of ln P at the pivot (2nd log-derivative)."
              />
              <Slider
                label="δε"
                value={shapefit.deps}
                min={-0.3}
                max={0.3}
                step={0.005}
                onChange={(v) => updateShapefit('deps', v)}
                latex="δε"
                description="Broadband (equality) scale shift. Dilates the no-wiggle spectrum in ln k."
              />
              <Slider
                label="δγ"
                value={shapefit.dgam}
                min={-1.0}
                max={1.0}
                step={0.01}
                onChange={(v) => updateShapefit('dgam', v)}
                latex="δγ"
                description="Wiggle depth. Rescales BAO amplitude / baryon suppression."
              />

              <div className="mb-3 mt-4 p-2 bg-orange-900/20 border border-orange-800/30 rounded">
                <p className="text-xs text-orange-300 font-semibold">Amplitude & growth:</p>
              </div>

              <Slider
                label="δA"
                value={shapefit.dA}
                min={0.5}
                max={1.5}
                step={0.01}
                onChange={(v) => updateShapefit('dA', v)}
                latex="δA<sub>p</sub>"
                description="Amplitude of P_now at the pivot. Overall normalization of the smooth spectrum."
              />
              <Slider
                label="δf"
                value={shapefit.df}
                min={0.5}
                max={1.5}
                step={0.01}
                onChange={(v) => updateShapefit('df', v)}
                latex="δf"
                description="Growth rate parameter. Scales f = d ln D / d ln a."
              />

              <div className="mb-3 mt-4 p-2 bg-green-900/20 border border-green-800/30 rounded">
                <p className="text-xs text-green-300 font-semibold">AP & pivot:</p>
              </div>

              <Slider
                label="q_∥"
                value={shapefit.qpar}
                min={0.8}
                max={1.2}
                step={0.005}
                onChange={(v) => updateShapefit('qpar', v)}
                latex="q<sub>∥</sub>"
                description="Alcock-Paczynski parallel scaling (line-of-sight direction)"
              />
              <Slider
                label="q_⊥"
                value={shapefit.qper}
                min={0.8}
                max={1.2}
                step={0.005}
                onChange={(v) => updateShapefit('qper', v)}
                latex="q<sub>⊥</sub>"
                description="Alcock-Paczynski perpendicular scaling (transverse direction)"
              />
              <Slider
                label="k_p"
                value={shapefit.kp}
                min={0.01}
                max={0.1}
                step={0.001}
                onChange={(v) => updateShapefit('kp', v)}
                latex="k<sub>p</sub> [h/Mpc]"
                description="Pivot wavenumber for the ShapeFit parameterization"
              />

              <div className="mt-4 p-3 bg-gray-800 rounded-lg border border-gray-600">
                <h4 className="text-xs font-semibold text-gray-400 mb-2">ShapeFit Template Formula</h4>
                <div className="text-xs text-gray-300 font-mono leading-relaxed bg-gray-900 p-2 rounded">
                  <div>P<sup>now</sup>(k) → δA · P<sup>now</sup>(k·e<sup>−δε</sup>) · T(k)</div>
                  <div className="mt-1">T(k) = exp[δm/a · tanh(a·ln(k/k<sub>p</sub>))</div>
                  <div className="ml-4">+ δn·ln(k/k<sub>p</sub>)</div>
                  <div className="ml-4">+ δc/(2a²) · tanh²(a·ln(k/k<sub>p</sub>))]</div>
                  <div className="mt-1">P(k) = P<sup>now</sup>(k) · [W(k)]<sup>1+δγ</sup></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  where W(k) = P<sub>fid</sub>(k) / P<sup>now</sup><sub>fid</sub>(k) is the wiggle factor
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
                { id: 'dkpk' as const, label: 'Δ²(k)', desc: 'Dimensionless power' },
                { id: 'kpk' as const, label: 'k·P(k)', desc: 'Logarithmic slope' },
                { id: 'pk' as const, label: 'P(k)', desc: 'Raw power spectrum' },
              ].map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setPlotMode(mode.id)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                    plotMode === mode.id
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  title={mode.desc}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {/* Main Power Spectrum Plot */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-4 shadow-xl">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Linear Matter Power Spectrum — {plotLabel}
            </h3>
            <ResponsiveContainer width="100%" height={380}>
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="logk"
                  type="number"
                  domain={[-4, -0.3]}
                  tickFormatter={(v) => `10${superscript(v.toFixed(1))}`}
                  stroke="#6B7280"
                  label={{ value: 'log₁₀(k)  [h/Mpc]', position: 'bottom', offset: 0, style: { fill: '#9CA3AF', fontSize: 12 } }}
                />
                <YAxis
                  scale="log"
                  domain={['auto', 'auto']}
                  stroke="#6B7280"
                  tickFormatter={(v) => v.toExponential(1)}
                  label={{ value: plotLabel, angle: -90, position: 'insideLeft', offset: -5, style: { fill: '#9CA3AF', fontSize: 11 } }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: 12 }}
                  labelFormatter={(v) => `k = ${Math.pow(10, v as number).toExponential(3)} h/Mpc`}
                  formatter={(value: number, name: string) => [value.toExponential(3), name]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine x={Math.log10(shapefit.kp)} stroke="#fbbf24" strokeDasharray="5 5" strokeWidth={1.5}
                  label={{ value: `k_p=${shapefit.kp}`, fill: '#fbbf24', fontSize: 10, position: 'top' }} />
                <Line type="monotone" dataKey="fiducial" name="P_fid(k)" stroke="#60A5FA" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="modified" name="P(k) [modified]" stroke="#F87171" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="noWiggleFid" name="P_now,fid(k)" stroke="#60A5FA" strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
                <Line type="monotone" dataKey="noWiggleMod" name="P_now(k) [modified]" stroke="#F87171" strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Ratio Plot */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-4 shadow-xl">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              Modification Ratio: P(k) / P_fid(k)
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={ratioData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="k"
                  scale="log"
                  domain={[1e-4, 0.5]}
                  tickFormatter={(v) => v.toExponential(1)}
                  stroke="#6B7280"
                  label={{ value: 'k [h/Mpc]', position: 'bottom', offset: 0, style: { fill: '#9CA3AF', fontSize: 12 } }}
                />
                <YAxis
                  domain={[0.4, 1.6]}
                  stroke="#6B7280"
                  tickFormatter={(v) => v.toFixed(2)}
                  label={{ value: 'Ratio', angle: -90, position: 'insideLeft', offset: -5, style: { fill: '#9CA3AF', fontSize: 11 } }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: 12 }}
                  labelFormatter={(v) => `k = ${(v as number).toExponential(3)} h/Mpc`}
                  formatter={(value: number) => [value.toFixed(4), 'P/P_fid']}
                />
                <ReferenceLine y={1} stroke="#4B5563" strokeDasharray="3 3" strokeWidth={1.5} />
                <ReferenceLine x={shapefit.kp} stroke="#fbbf24" strokeDasharray="5 5" strokeWidth={1} />
                <Line type="monotone" dataKey="ratio" name="P(k)/P_fid(k)" stroke="#F87171" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
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
              <CosmoEffectPlot cosmo={cosmo} />
              <ShapeFitEffectPlot cosmo={cosmo} shapefit={shapefit} />
            </div>
          </div>

          {/* Info Footer */}
          <div className="mt-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
            <h4 className="text-sm font-semibold text-gray-300 mb-2">About</h4>
            <div className="text-xs text-gray-400 space-y-2">
              <p>
                This app computes the linear matter power spectrum P(k) using the 
                <b> Eisenstein & Hu (1998)</b> transfer function with baryonic wiggles, 
                and applies the <b>ShapeFit template</b> to show how the spectrum shape 
                can be parameterized in terms of a small set of physically-motivated parameters.
              </p>
              <p>
                The ShapeFit approach (Brieden, Gil-Marin & Verde 2021) separates the power spectrum 
                into a smooth (no-wiggle) component and a wiggle component, each controlled by 
                different parameters. This allows efficient extraction of cosmological information 
                from galaxy clustering data without running a full Boltzmann solver at each step.
              </p>
              <p>
                Code reference: <a href="https://github.com/dforero0896/desilike/tree/shapefit-prime" target="_blank" rel="noopener" className="text-blue-400 hover:underline">desilike/shapefit-prime</a> — 
                the cosmological inference framework used by the DESI collaboration.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ─── Helper for superscript ─────────────────────────────────────────────────

function superscript(s: string): string {
  const map: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '-': '⁻', '.': '·',
  };
  return s.split('').map(c => map[c] || c).join('');
}

// ─── Cosmological Effect Plot ───────────────────────────────────────────────

function CosmoEffectPlot({ cosmo }: { cosmo: CosmoParams }) {
  const data = useMemo(() => {
    const defaultResult = computePowerSpectrum(DEFAULT_COSMO, DEFAULT_SHAPEFIT, 0.5);
    const currentResult = computePowerSpectrum(cosmo, DEFAULT_SHAPEFIT, 0.5);
    
    // Interpolate to common grid
    const points: { k: number; ratio: number }[] = [];
    for (let i = 0; i < defaultResult.k.length; i++) {
      const ki = defaultResult.k[i];
      if (ki < 1e-4 || ki > 0.3) continue;
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
          <XAxis dataKey="k" scale="log" tickFormatter={(v) => v.toExponential(0)} stroke="#6B7280" fontSize={10} />
          <YAxis domain={[0.2, 3]} tickFormatter={(v) => v.toFixed(1)} stroke="#6B7280" fontSize={10} />
          <Tooltip
            contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: 11 }}
            labelFormatter={(v) => `k = ${(v as number).toExponential(2)}`}
            formatter={(value: number) => [value.toFixed(3), 'Δ² ratio']}
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

function ShapeFitEffectPlot({ cosmo, shapefit }: { cosmo: CosmoParams; shapefit: ShapeFitParams }) {
  const data = useMemo(() => {
    const defaultResult = computePowerSpectrum(cosmo, DEFAULT_SHAPEFIT, 0.5);
    const currentResult = computePowerSpectrum(cosmo, shapefit, 0.5);
    
    const points: { k: number; ratio: number }[] = [];
    for (let i = 0; i < defaultResult.k.length; i++) {
      const ki = defaultResult.k[i];
      if (ki < 1e-4 || ki > 0.3) continue;
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
          <XAxis dataKey="k" scale="log" tickFormatter={(v) => v.toExponential(0)} stroke="#6B7280" fontSize={10} />
          <YAxis domain={[0.2, 3]} tickFormatter={(v) => v.toFixed(1)} stroke="#6B7280" fontSize={10} />
          <Tooltip
            contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: 11 }}
            labelFormatter={(v) => `k = ${(v as number).toExponential(2)}`}
            formatter={(value: number) => [value.toFixed(3), 'Δ² ratio']}
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
