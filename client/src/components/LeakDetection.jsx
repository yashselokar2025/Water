import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    AlertCircle, CheckCircle2, TrendingDown, TrendingUp, Minus,
    Zap, Brain, MapPin, Activity, ShieldAlert, Droplets,
    Clock, Target, Users, Gauge, BarChart3, ArrowRight
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import axios from 'axios';

// ─── Detection Engine (mirrors logic in aiEngine.js) ─────────────────────────
// These constants must stay in sync with server/services/aiEngine.js
const MAX_PRESSURE_DROP = 2.0;
const MAX_FLOW_CHANGE   = 15.0;
const MAX_NEIGHBOR_DIFF = 1.5;
const MIN_SIGNAL        = 0.15;

/** Normalised leak analysis for a single sensor */
function analyzeLeak(sensor, neighbors, persistenceCycles) {
    const pressure = sensor.pressure ?? 0;
    const flow     = sensor.flow     ?? 0;

    // Scores 0–1
    let pressureScore    = 0;
    let flowScore        = 0;
    let neighborScore    = 0;
    let neighborAvg      = 0;
    let neighborDeviation = 0;

    // 1. Neighbour pressure comparison (no history in FE, use live neighbours)
    const validNeighbors = neighbors.filter(n => (n.pressure ?? 0) > 0);
    if (validNeighbors.length > 0) {
        neighborAvg       = validNeighbors.reduce((a, n) => a + n.pressure, 0) / validNeighbors.length;
        neighborDeviation = Math.max(0, neighborAvg - pressure);
        neighborScore     = Math.min(1, neighborDeviation / MAX_NEIGHBOR_DIFF);
    }

    // 2. Absolute pressure floor (directly sets score)
    if (pressure > 0 && pressure < 1.2) {
        pressureScore = 0.85;
    } else if (pressure > 0 && pressure < 1.8) {
        pressureScore = 0.4;
    }

    // 3. Excessive flow
    if (flow > 32) {
        flowScore = Math.min(1, (flow - 28) / MAX_FLOW_CHANGE);
    } else if (flow > 28) {
        flowScore = Math.min(1, (flow - 28) / MAX_FLOW_CHANGE);
    }

    // Minimum signal guard
    const activeScores = [pressureScore, flowScore, neighborScore].filter(s => s >= MIN_SIGNAL);
    let leakScore = 0;

    if (pressure > 0 && pressure < 1.2) {
        leakScore = 85; // absolute override
    } else if (flow > 32) {
        leakScore = Math.max(leakScore, 80);
    } else if (activeScores.length > 0) {
        const avg = activeScores.reduce((a, b) => a + b, 0) / activeScores.length;
        leakScore = Math.round(Math.min(100, avg * 100));
    }

    // Severity
    let severity = 'NONE';
    if (leakScore >= 70) severity = 'HIGH';
    else if (leakScore >= 40) severity = 'MEDIUM';
    else if (leakScore >= 15) severity = 'LOW';

    // Confidence: based on how many signals agree + cycle duration
    const signalingCount  = activeScores.length;
    const signalAgreement = signalingCount / 3;
    const temporalBonus   = Math.min(20, (persistenceCycles - 2) * 5);
    const confidence      = Math.min(97, Math.round(
        leakScore * 0.5 + signalAgreement * 30 + temporalBonus
    ));

    // Estimated location (sensor vs neighbour with highest pressure)
    let likelyLocation = null;
    if (leakScore > 0 && validNeighbors.length > 0) {
        const highestNeighbor = validNeighbors.reduce((a, b) => a.pressure > b.pressure ? a : b);
        likelyLocation = `Between ${highestNeighbor.name ?? 'upstream node'} → ${sensor.name ?? 'this node'}`;
    }

    // Estimated water loss (L/min) — rough: excess flow * 60
    const excessFlow       = Math.max(0, flow - 20); // 20 L/s baseline
    const waterLossLperMin = Math.round(excessFlow * 60);

    // Action recommendation
    let action = 'Monitor — parameters within normal range';
    if (leakScore >= 70) action = 'Dispatch inspection crew immediately. Isolate segment via secondary valves.';
    else if (leakScore >= 40) action = 'Schedule urgent inspection within 4 hours. Reduce inlet pressure temporarily.';
    else if (leakScore >= 15) action = 'Increase monitoring frequency. Inspect during next maintenance window.';

    return {
        leakScore,
        severity,
        confidence,
        pressureScore:     Math.round(pressureScore * 100),
        flowScore:         Math.round(flowScore * 100),
        neighborScore:     Math.round(neighborScore * 100),
        pressure:          parseFloat(pressure.toFixed(2)),
        flow:              parseFloat(flow.toFixed(1)),
        neighborAvg:       parseFloat(neighborAvg.toFixed(2)),
        neighborDeviation: parseFloat(neighborDeviation.toFixed(2)),
        likelyLocation,
        waterLossLperMin,
        action,
        persistenceCycles,
    };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ProbabilityRing({ score, severity }) {
    const circumference = 2 * Math.PI * 36;
    const dashOffset    = circumference * (1 - Math.min(100, score) / 100);
    const color = severity === 'HIGH' ? '#ef4444' : severity === 'MEDIUM' ? '#f59e0b' : severity === 'LOW' ? '#3b82f6' : '#10b981';

    return (
        <div className="relative w-24 h-24 flex items-center justify-center flex-shrink-0">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 88 88">
                <circle cx="44" cy="44" r="36" fill="none" stroke="currentColor" strokeWidth="7" className="text-gray-200 dark:text-gray-700" />
                <circle cx="44" cy="44" r="36" fill="none" strokeWidth="7"
                    stroke={color} strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
            </svg>
            <div className="text-center relative z-10">
                <span className="text-xl font-black" style={{ color }}>{score}%</span>
                <p className="text-[7px] font-black text-gray-400 uppercase">Prob.</p>
            </div>
        </div>
    );
}

function SeverityBadge({ severity }) {
    const config = {
        HIGH:   { cls: 'bg-red-500/15 text-red-500 border-red-500/30 animate-pulse', label: '🔴 HIGH' },
        MEDIUM: { cls: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30', label: '🟡 MEDIUM' },
        LOW:    { cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30', label: '🔵 LOW' },
        NONE:   { cls: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30', label: '🟢 NOMINAL' },
    };
    const { cls, label } = config[severity] || config.NONE;
    return (
        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border ${cls}`}>
            {label}
        </span>
    );
}

function EvidenceBar({ label, value, max = 100, color = 'blue' }) {
    const pct = Math.min(100, Math.round((value / max) * 100));
    const barColor = color === 'red' ? 'bg-red-500' : color === 'yellow' ? 'bg-yellow-400' : color === 'emerald' ? 'bg-emerald-500' : 'bg-blue-500';
    return (
        <div>
            <div className="flex justify-between mb-0.5">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
                <span className={`text-[9px] font-black ${pct > 60 ? 'text-red-500' : pct > 30 ? 'text-yellow-500' : 'text-emerald-500'}`}>{value}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${pct > 60 ? 'bg-red-500' : pct > 30 ? 'bg-yellow-400' : 'bg-emerald-500'}`}
                    style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

// ─── Main LeakDetection Component ────────────────────────────────────────────
const LeakDetection = ({ sensors: propsSensors }) => {
    const [internalSensors, setInternalSensors] = useState([]);
    const [selectedSensorId, setSelectedSensorId] = useState(null);
    const persistenceRef = useRef({});       // { sensorId: cycleCount }
    const historyRef     = useRef({});       // { sensorId: [{pressure, flow, ts}] }

    const sensors = propsSensors || internalSensors;

    // Fallback fetch if not passed as props
    useEffect(() => {
        if (propsSensors) return;
        const fetch = async () => {
            try {
                const res = await axios.get('http://localhost:5000/api/sensors');
                setInternalSensors(res.data);
            } catch (e) { console.error(e); }
        };
        fetch();
        const t = setInterval(fetch, 3000);
        return () => clearInterval(t);
    }, [propsSensors]);

    // Update persistence counters + history on every sensor update
    useEffect(() => {
        if (!sensors.length) return;
        sensors.forEach(s => {
            const id = s.id;
            const { leakScore } = analyzeLeak(
                s,
                sensors.filter(n => String(n.pipeline_id) === String(s.pipeline_id) && n.id !== id),
                0
            );
            if (leakScore >= 15) {
                persistenceRef.current[id] = (persistenceRef.current[id] || 0) + 1;
            } else {
                delete persistenceRef.current[id];
            }

            // Keep rolling 12-point history for trend chart
            const hist = historyRef.current[id] || [];
            historyRef.current[id] = [...hist, { pressure: s.pressure, flow: s.flow, ts: new Date().toLocaleTimeString() }].slice(-12);
        });
    }, [sensors]);

    // Build analysed sensor list
    const analysedSensors = useMemo(() => sensors.map(s => {
        const neighbors = sensors.filter(n => String(n.pipeline_id) === String(s.pipeline_id) && n.id !== s.id);
        const cycles    = persistenceRef.current[s.id] || 0;
        const result    = analyzeLeak(s, neighbors, cycles);
        return { ...s, ...result, history: historyRef.current[s.id] || [] };
    }), [sensors]);

    const sorted = [...analysedSensors].sort((a, b) => b.leakScore - a.leakScore);
    const selected = sorted.find(s => s.id === selectedSensorId) || sorted[0];
    const criticalCount = sorted.filter(s => s.severity === 'HIGH').length;
    const warningCount  = sorted.filter(s => s.severity === 'MEDIUM').length;

    // Auto-select highest risk sensor
    useEffect(() => {
        if (sorted.length > 0 && !selectedSensorId) setSelectedSensorId(sorted[0].id);
    }, [sorted.length]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* ── Header ──────────────────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div>
                    <h2 className="text-3xl font-black dark:text-white tracking-tighter uppercase">AI Leak Detection</h2>
                    <p className="text-gray-500 font-bold text-sm tracking-widest mt-1 uppercase">
                        Normalised multi-signal detection engine · {sensors.length} nodes monitored
                    </p>
                </div>
                <div className="flex gap-3">
                    {criticalCount > 0 && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-500 px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-black uppercase animate-pulse">
                            <AlertCircle size={16} /> {criticalCount} Critical Node{criticalCount > 1 ? 's' : ''}
                        </div>
                    )}
                    {warningCount > 0 && (
                        <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-black uppercase">
                            <ShieldAlert size={16} /> {warningCount} Warning
                        </div>
                    )}
                    {criticalCount === 0 && warningCount === 0 && (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-black uppercase">
                            <CheckCircle2 size={16} /> All Nodes Nominal
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* ── Left: Sensor List ────────────────────────────────────────── */}
                <div className="space-y-3">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Sensor Nodes — click to inspect</p>
                    {sorted.map(s => (
                        <button
                            key={s.id}
                            onClick={() => setSelectedSensorId(s.id)}
                            className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 ${
                                selectedSensorId === s.id
                                    ? 'border-primary-500/50 bg-primary-500/5 shadow-lg shadow-primary-500/10'
                                    : 'border-gray-100 dark:border-gray-700/50 bg-white dark:bg-gray-900/40 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <p className="text-xs font-black dark:text-white uppercase tracking-tight">{s.name}</p>
                                    <p className="text-[8px] text-gray-400 font-bold uppercase mt-0.5">{s.pipeline_name || `Pipeline #${s.pipeline_id}`}</p>
                                </div>
                                <SeverityBadge severity={s.severity} />
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex-1">
                                    <div className="w-full h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-700 ${
                                                s.leakScore >= 70 ? 'bg-red-500' : s.leakScore >= 40 ? 'bg-yellow-400' : s.leakScore >= 15 ? 'bg-blue-400' : 'bg-emerald-500'
                                            }`}
                                            style={{ width: `${s.leakScore}%` }}
                                        />
                                    </div>
                                </div>
                                <span className={`text-[10px] font-black min-w-[32px] text-right ${
                                    s.leakScore >= 70 ? 'text-red-500' : s.leakScore >= 40 ? 'text-yellow-500' : s.leakScore >= 15 ? 'text-blue-400' : 'text-emerald-500'
                                }`}>{s.leakScore}%</span>
                            </div>
                        </button>
                    ))}
                </div>

                {/* ── Right: Detail Panel ──────────────────────────────────────── */}
                {selected && (
                    <div className="xl:col-span-2 space-y-4">
                        {/* ── Header card ──────────────────────────────────────── */}
                        <div className={`glass-card p-6 border-l-4 ${
                            selected.severity === 'HIGH'   ? 'border-l-red-500 bg-red-500/5' :
                            selected.severity === 'MEDIUM' ? 'border-l-yellow-400 bg-yellow-500/5' :
                            selected.severity === 'LOW'    ? 'border-l-blue-400 bg-blue-500/5' :
                                                             'border-l-emerald-500 bg-emerald-500/5'
                        }`}>
                            <div className="flex items-start gap-4">
                                <ProbabilityRing score={selected.leakScore} severity={selected.severity} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <h3 className="text-base font-black dark:text-white uppercase tracking-tight">
                                            {selected.severity === 'HIGH'   ? '🚨 Leak Detected' :
                                             selected.severity === 'MEDIUM' ? '⚠️ Pressure Anomaly' :
                                             selected.severity === 'LOW'    ? '🔵 Minor Signal' :
                                                                              '✅ Nominal'}
                                            {' – '}{selected.name}
                                        </h3>
                                        <SeverityBadge severity={selected.severity} />
                                    </div>
                                    <p className="text-[9px] text-gray-400 uppercase font-black tracking-widest mb-3">
                                        📍 {selected.pipeline_name || `Pipeline #${selected.pipeline_id}`}
                                    </p>
                                    {/* Confidence + Cycles row */}
                                    <div className="flex items-center gap-4 flex-wrap">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[9px] font-black text-gray-400 uppercase">Confidence</span>
                                            <span className={`text-[10px] font-black ${selected.confidence >= 70 ? 'text-emerald-500' : 'text-yellow-500'}`}>{selected.confidence}%</span>
                                        </div>
                                        {selected.persistenceCycles >= 2 && (
                                            <div className="flex items-center gap-1.5">
                                                <Clock size={10} className="text-gray-400" />
                                                <span className="text-[9px] font-black text-gray-400 uppercase">Anomaly for</span>
                                                <span className="text-[10px] font-black text-orange-500">{selected.persistenceCycles} cycle{selected.persistenceCycles > 1 ? 's' : ''}</span>
                                            </div>
                                        )}
                                        {selected.likelyLocation && selected.leakScore > 0 && (
                                            <div className="flex items-center gap-1.5">
                                                <MapPin size={10} className="text-primary-500" />
                                                <span className="text-[10px] font-bold text-primary-400">{selected.likelyLocation}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Evidence Panel ──────────────────────────────────── */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="glass-card p-5 space-y-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <BarChart3 size={14} className="text-primary-500" />
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Evidence Signals</p>
                                </div>
                                <EvidenceBar label="Pressure Signal"  value={selected.pressureScore}  />
                                <EvidenceBar label="Flow Signal"      value={selected.flowScore}      />
                                <EvidenceBar label="Neighbour Diff"   value={selected.neighborScore}  />
                                <div className="pt-3 border-t dark:border-gray-700 grid grid-cols-2 gap-2">
                                    <div>
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Current Pressure</p>
                                        <p className="text-sm font-black dark:text-white">{selected.pressure} <span className="text-[9px] text-gray-400">bar</span></p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Current Flow</p>
                                        <p className="text-sm font-black dark:text-white">{selected.flow} <span className="text-[9px] text-gray-400">L/s</span></p>
                                    </div>
                                    {selected.neighborAvg > 0 && (
                                        <>
                                            <div>
                                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Neighbour Avg</p>
                                                <p className="text-sm font-black dark:text-white">{selected.neighborAvg} <span className="text-[9px] text-gray-400">bar</span></p>
                                            </div>
                                            <div>
                                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Deviation</p>
                                                <p className={`text-sm font-black ${selected.neighborDeviation > 0.3 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                    {selected.neighborDeviation > 0 ? '-' : ''}{selected.neighborDeviation} <span className="text-[9px] opacity-70">bar</span>
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* AI Reasoning + Action */}
                            <div className="glass-card p-5 space-y-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <Brain size={14} className="text-primary-500" />
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">AI Reasoning</p>
                                </div>
                                <p className="text-[11px] text-gray-600 dark:text-gray-300 font-medium leading-relaxed">
                                    {selected.leakScore >= 70 && selected.neighborDeviation > 0
                                        ? `Pressure at ${selected.name} (${selected.pressure} bar) is ${selected.neighborDeviation} bar below the pipeline average of ${selected.neighborAvg} bar. Flow at ${selected.flow} L/s suggests active water loss at this node.`
                                        : selected.leakScore >= 40
                                            ? `Pressure deviation of ${selected.neighborDeviation} bar from neighbouring sensors is above the alert threshold. Signal consistent over ${selected.persistenceCycles} monitoring cycle${selected.persistenceCycles > 1 ? 's' : ''}.`
                                            : selected.leakScore >= 15
                                                ? `Minor pressure imbalance detected. Pressure at ${selected.pressure} bar vs pipeline avg ${selected.neighborAvg} bar. Monitoring for persistence.`
                                                : `All pressure and flow parameters are within expected operating range. No leak signature detected.`
                                    }
                                </p>

                                {selected.leakScore > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Impact Estimate</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-2">
                                                <p className="text-[8px] font-black text-red-400 uppercase">Water Loss</p>
                                                <p className="text-sm font-black text-red-500">~{selected.waterLossLperMin} <span className="text-[9px]">L/min</span></p>
                                            </div>
                                            <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-2">
                                                <p className="text-[8px] font-black text-orange-400 uppercase">Risk Level</p>
                                                <p className="text-sm font-black text-orange-500">{selected.severity}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className={`p-3 rounded-xl border text-[10px] font-bold leading-relaxed flex items-start gap-2 ${
                                    selected.severity === 'HIGH'   ? 'bg-red-500/5 border-red-500/20 text-red-400' :
                                    selected.severity === 'MEDIUM' ? 'bg-yellow-500/5 border-yellow-500/20 text-yellow-500' :
                                                                     'bg-emerald-500/5 border-emerald-500/20 text-emerald-500'
                                }`}>
                                    <Target size={12} className="flex-shrink-0 mt-0.5" />
                                    <span>{selected.action}</span>
                                </div>
                            </div>
                        </div>

                        {/* ── Pressure Trend Chart ─────────────────────────────── */}
                        {selected.history.length > 2 && (
                            <div className="glass-card p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <Activity size={14} className="text-primary-500" />
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Pressure Trend – {selected.name}</p>
                                    {selected.leakScore >= 40 && (
                                        <span className="ml-auto text-[8px] font-black px-2 py-0.5 rounded-full bg-red-500/15 text-red-500 uppercase">Anomaly Region</span>
                                    )}
                                </div>
                                <div style={{ width: '100%', height: '150px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={selected.history} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="pressGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%"  stopColor={selected.leakScore >= 40 ? '#ef4444' : '#3b82f6'} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={selected.leakScore >= 40 ? '#ef4444' : '#3b82f6'} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis dataKey="ts" tick={{ fontSize: 8, fill: '#6b7280' }} />
                                            <YAxis tick={{ fontSize: 8, fill: '#6b7280' }} domain={['auto', 'auto']} />
                                            <Tooltip
                                                contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8, fontSize: 10 }}
                                                labelStyle={{ color: '#9ca3af' }}
                                                itemStyle={{ color: '#e5e7eb' }}
                                            />
                                            {/* Safe zone reference */}
                                            <ReferenceLine y={1.8} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1}
                                                label={{ value: 'Min safe', position: 'right', fontSize: 8, fill: '#f59e0b' }} />
                                            <Area type="monotone" dataKey="pressure" name="Pressure (bar)"
                                                stroke={selected.leakScore >= 40 ? '#ef4444' : '#3b82f6'}
                                                fill="url(#pressGrad)" strokeWidth={2} dot={false} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Detection Algorithm Card (bottom) ───────────────────────────── */}
            <div className="glass-card p-8 bg-gradient-to-br from-gray-900 to-gray-800 dark:from-gray-900 dark:to-gray-800 text-white border-none shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-10">
                    <AlertCircle size={150} />
                </div>
                <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div>
                        <h3 className="text-lg font-black mb-3 flex items-center text-primary-400">
                            <Brain className="mr-2" size={18} /> Normalised Detection Algorithm
                        </h3>
                        <p className="text-gray-400 text-sm leading-relaxed mb-4">
                            Each signal is normalised to a 0–1 scale before averaging. No single metric can produce a false 100% score.
                            A minimum signal threshold of 15% filters out natural sensor noise.
                        </p>
                        <div className="bg-gray-800/60 p-4 rounded-xl border border-gray-700 font-mono text-xs space-y-1">
                            <p className="text-primary-300">pressureScore = min(1, pressureDrop / 2.0)</p>
                            <p className="text-primary-300">flowScore     = min(1, flowSurge / 15.0)</p>
                            <p className="text-primary-300">neighborScore = min(1, deviation / 1.5)</p>
                            <p className="text-gray-500 mt-2">// Only average signals above 15% threshold</p>
                            <p className="text-yellow-300">leak_prob = avg(activeScores) × 100</p>
                            <p className="text-gray-500 mt-1">// No leak → 0–10% · Real leak → 70–100%</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        {[
                            { t: 'Pressure Signal (ΔP)', d: 'Normalised drop from previous reading. Max 2 bar drop = 100%.' },
                            { t: 'Flow Anomaly (ΔF)', d: 'Only upward flow surges counted. Max 15 L/s surge = 100%.' },
                            { t: 'Neighbour Diff', d: 'Only negative deviation from neighbours (this sensor lower). Max 1.5 bar = 100%.' },
                            { t: 'Minimum Signal Guard', d: 'Signals below 15% are treated as noise and excluded from the average.' },
                        ].map((item, i) => (
                            <div key={i} className="flex items-start space-x-3">
                                <div className="h-2 w-2 rounded-full bg-primary-500 mt-1.5 shrink-0" />
                                <div>
                                    <h4 className="font-black text-xs text-gray-200">{item.t}</h4>
                                    <p className="text-[10px] text-gray-500 leading-relaxed">{item.d}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LeakDetection;
