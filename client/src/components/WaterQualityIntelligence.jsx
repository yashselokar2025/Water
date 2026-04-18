import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import {
    Droplet,
    Upload,
    Activity,
    AlertTriangle,
    CheckCircle2,
    FlaskConical,
    ArrowRight,
    Info,
    ShieldCheck,
    RefreshCw,
    FileText,
    Zap,
    Brain,
    TrendingUp,
    TrendingDown,
    Minus,
    ShieldAlert,
    Beaker,
    BarChart3,
    Clock,
    Target
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';

// ─── AI Decision Engine (Water Quality) ──────────────────────────────────────

/** Calculate drinkability score 0–100 based on TDS, turbidity, and pH deviation */
function calcDrinkabilityScore(ph, tds, turbidity) {
    let score = 100;

    // TDS penalty
    if (tds > 1000)       score -= 50;
    else if (tds > 500)   score -= 30;
    else if (tds > 300)   score -= 15;
    else if (tds > 150)   score -= 5;

    // Turbidity penalty
    if (turbidity > 15)   score -= 35;
    else if (turbidity > 5)  score -= 20;
    else if (turbidity > 1)  score -= 8;
    else if (turbidity > 0.5) score -= 2;

    // pH deviation penalty
    const phDev = ph < 7 ? 7 - ph : ph - 7;
    if (phDev > 2.5)      score -= 20;
    else if (phDev > 1.5) score -= 12;
    else if (phDev > 0.5) score -= 5;

    return Math.max(0, Math.round(score));
}

/** Risk factor breakdown – returns array of { factor, risk, label } */
function calcRiskFactors(ph, tds, turbidity) {
    // TDS
    let tdsRisk = 0;
    let tdsLabel = 'Normal';
    if (tds > 1000)      { tdsRisk = 40; tdsLabel = 'Critically High'; }
    else if (tds > 500)  { tdsRisk = 25; tdsLabel = 'High'; }
    else if (tds > 300)  { tdsRisk = 12; tdsLabel = 'Elevated'; }
    else if (tds > 150)  { tdsRisk = 5;  tdsLabel = 'Moderate'; }
    const tdsFactor = { factor: 'TDS', value: `${Math.round(tds)} mg/L`, risk: tdsRisk, label: tdsLabel };

    // Turbidity
    let turbRisk = 0;
    let turbLabel = 'Normal';
    if (turbidity > 15)      { turbRisk = 35; turbLabel = 'Critically High'; }
    else if (turbidity > 5)  { turbRisk = 20; turbLabel = 'High'; }
    else if (turbidity > 1)  { turbRisk = 8;  turbLabel = 'Moderate'; }
    const turbFactor = { factor: 'Turbidity', value: `${turbidity.toFixed(2)} NTU`, risk: turbRisk, label: turbLabel };

    // pH
    const phDev = Math.abs(ph - 7);
    let phRisk = 0;
    let phLabel = 'Normal';
    if (phDev > 2.5)      { phRisk = 20; phLabel = 'Critical'; }
    else if (phDev > 1.5) { phRisk = 12; phLabel = 'Abnormal'; }
    else if (phDev > 0.5) { phRisk = 5;  phLabel = 'Slightly off'; }
    const phFactor = { factor: 'pH', value: ph.toFixed(2), risk: phRisk, label: phLabel };

    return [tdsFactor, turbFactor, phFactor];
}

/** Usage suitability classification */
function calcUsability(drinkScore, ph, tds, turbidity) {
    let safe   = [];
    let unsafe = [];
    const toxic  = tds > 1000 || ph < 5 || ph > 10 || turbidity > 15;
    const drink  = drinkScore >= 80;
    const indust = drinkScore >= 40;

    if (!toxic) {
        if (drink) {
            safe = [...safe, 'Drinking', 'Cooking'];
        }
        safe = [...safe, 'Washing', 'Irrigation'];
        if (indust) safe = [...safe, 'Industrial use'];
    }
    if (!drink) { unsafe = [...unsafe, 'Drinking', 'Cooking']; }
    if (toxic)  { unsafe = [...unsafe, 'Washing', 'Irrigation', 'Industrial use']; }

    return { safe, unsafe };
}

/** Confidence score: how consistent are quality params across sensors */
function calcConfidenceScore(sensors) {
    if (!sensors || sensors.length < 2) return 70; // single sensor = unknown confidence
    const fields = ['ph', 'tds', 'turbidity'];
    let totalVar = 0;
    fields.forEach(f => {
        const vals = sensors.map(s => s[f] || 0);
        const avg  = vals.reduce((a, b) => a + b, 0) / vals.length;
        const variance = vals.reduce((a, v) => a + Math.pow(v - avg, 2), 0) / vals.length;
        const cv = avg > 0 ? Math.sqrt(variance) / avg : 0;
        totalVar += cv;
    });
    const avgCV = totalVar / fields.length;
    return Math.max(30, Math.round(100 - avgCV * 80));
}

/** Trend analysis using last N history snapshots */
function calcTrend(historySnapshots) {
    if (!historySnapshots || historySnapshots.length < 3) {
        return { direction: 'stable', text: 'Water quality stable — insufficient trend data.', icon: 'stable' };
    }
    const recent = historySnapshots.slice(-3);
    const first  = recent[0];
    const last   = recent[2];

    // Rising risk = increasing turbidity/TDS or worsening pH
    const turbidityDelta = (last.turbidity || 0) - (first.turbidity || 0);
    const tdsDelta       = (last.tds || 0) - (first.tds || 0);
    const phDeltaAbs     = Math.abs((last.ph || 7) - (first.ph || 7));

    const riskDelta = (turbidityDelta / 5) + (tdsDelta / 200) + phDeltaAbs;

    if (riskDelta > 0.5) {
        return {
            direction: 'degrading',
            text: `Quality degrading — turbidity +${turbidityDelta.toFixed(2)} NTU, TDS +${tdsDelta.toFixed(0)} mg/L over last 3 cycles. Expect further decline in 10–15 min.`,
            icon: 'down'
        };
    } else if (riskDelta < -0.3) {
        return {
            direction: 'improving',
            text: `Quality improving — parameters recovering. Stable operation expected in next cycle.`,
            icon: 'up'
        };
    }
    return {
        direction: 'stable',
        text: 'Water quality stable — parameters consistent over last monitoring window.',
        icon: 'stable'
    };
}

/** Main analysis function */
function analyzeQuality(val) {
    const ph = val.ph || 0;
    const tds = val.tds || 0;
    const turbidity = val.turbidity || 0;
    let drinkable = true;
    let usable = true;
    let toxic = false;
    let status = '✅ Safe to Drink';
    let color = 'emerald';
    let reasons = [];

    if (tds > 1000 || ph < 5.0 || ph > 10.0 || turbidity > 10.0) {
        toxic = true; drinkable = false; usable = false;
        status = '🚨 Unsafe / Toxic'; color = 'red';
        if (tds > 1000)           reasons = [...reasons, `Extreme mineral concentration — TDS ${Math.round(tds)} mg/L (limit: 1000 mg/L)`];
        if (ph < 5.0 || ph > 10.0) reasons = [...reasons, `Hazardous pH levels — current ${ph.toFixed(2)} (safe range 5–10)`];
        if (turbidity > 10.0)     reasons = [...reasons, `Dangerous turbidity — ${turbidity.toFixed(2)} NTU (limit: 10 NTU)`];
    } else if (ph < 6.5 || ph > 8.5 || tds > 300 || turbidity > 1.0) {
        drinkable = false;
        status = '⚠️ Safe for Use (Not Drinking)'; color = 'amber';
        if (ph < 6.5 || ph > 8.5) reasons = [...reasons, `pH ${ph.toFixed(2)} outside drinking standard (6.5–8.5)`];
        if (tds > 300)             reasons = [...reasons, `TDS ${Math.round(tds)} mg/L exceeds potable limit (300 mg/L)`];
        if (turbidity > 1.0)       reasons = [...reasons, `Turbidity ${turbidity.toFixed(2)} NTU above drinking threshold (1.0 NTU)`];
    } else {
        reasons = [...reasons, `pH ${ph.toFixed(2)} within safe range, TDS ${Math.round(tds)} mg/L acceptable, turbidity ${turbidity.toFixed(2)} NTU clear`];
    }

    let mineralLabel = 'Good Minerals';
    if (tds < 150)          mineralLabel = 'Low minerals';
    else if (tds <= 300)    mineralLabel = 'Optimal Range';
    else if (tds <= 600)    mineralLabel = 'Moderate (Harder)';
    else if (tds <= 1000)   mineralLabel = 'High (Hard Water)';
    else                    mineralLabel = 'Very High (Unsafe)';

    return {
        status, drinkable, usable, toxic, color,
        explanation: reasons.join('. '),
        mineralLabel,
        bg: `bg-${color}-500/10`,
        border: `border-${color}-500/20`,
        textColor: `text-${color}-500`
    };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

// Drinkability Score Ring
function DrinkabilityCard({ score }) {
    const color = score >= 80 ? 'emerald' : score >= 50 ? 'yellow' : 'red';
    const label = score >= 80 ? 'Safe' : score >= 50 ? 'Caution' : 'Unsafe';
    const circumference = 2 * Math.PI * 38;
    const dashOffset = circumference * (1 - score / 100);

    return (
        <div className="bg-white dark:bg-gray-900/40 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xl flex flex-col items-center gap-3">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Drinkability Score</p>
            <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="8" className="text-gray-200 dark:text-gray-700" />
                    <circle
                        cx="50" cy="50" r="38" fill="none" strokeWidth="8"
                        stroke={score >= 80 ? '#10b981' : score >= 50 ? '#eab308' : '#ef4444'}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={dashOffset}
                        style={{ transition: 'stroke-dashoffset 1s ease' }}
                    />
                </svg>
                <div className="text-center relative z-10">
                    <span className={`text-2xl font-black ${score >= 80 ? 'text-emerald-500' : score >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>{score}</span>
                    <p className="text-[8px] font-black text-gray-400 uppercase">/100</p>
                </div>
            </div>
            <span className={`text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                score >= 80 ? 'bg-emerald-500/15 text-emerald-500' : score >= 50 ? 'bg-yellow-500/15 text-yellow-500' : 'bg-red-500/15 text-red-500'
            }`}>{label}</span>
        </div>
    );
}

// Risk Breakdown Panel
function RiskPanel({ factors }) {
    const totalRisk = factors.reduce((s, f) => s + f.risk, 0);
    return (
        <div className="bg-white dark:bg-gray-900/40 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
                <ShieldAlert size={16} className="text-red-400" />
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Risk Breakdown</p>
                <span className={`ml-auto text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                    totalRisk > 40 ? 'bg-red-500/15 text-red-500' : totalRisk > 15 ? 'bg-yellow-500/15 text-yellow-500' : 'bg-emerald-500/15 text-emerald-500'
                }`}>Total risk: +{totalRisk}</span>
            </div>
            <div className="space-y-3">
                {factors.map(({ factor, value, risk, label }) => (
                    <div key={factor}>
                        <div className="flex justify-between items-center mb-1">
                            <div>
                                <span className="text-[10px] font-black dark:text-gray-300 uppercase">{factor}</span>
                                <span className="text-[9px] text-gray-400 ml-2">{value}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-black uppercase ${
                                    risk > 20 ? 'text-red-500' : risk > 8 ? 'text-yellow-500' : 'text-emerald-500'
                                }`}>{label}</span>
                                <span className={`text-[10px] font-black ${risk > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                    {risk > 0 ? `+${risk}` : '0'} risk
                                </span>
                            </div>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${risk > 20 ? 'bg-red-500' : risk > 8 ? 'bg-yellow-400' : 'bg-emerald-500'}`}
                                style={{ width: `${Math.min(100, risk * 2)}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Prediction Card
function PredictionCard({ trend }) {
    const icons = { degrading: TrendingDown, improving: TrendingUp, stable: Minus };
    const Icon = icons[trend.icon] || Minus;
    const color = trend.direction === 'degrading' ? 'red' : trend.direction === 'improving' ? 'emerald' : 'blue';
    return (
        <div className={`bg-${color}-500/5 border border-${color}-500/20 p-5 rounded-3xl`}>
            <div className="flex items-center gap-2 mb-3">
                <Icon size={16} className={`text-${color}-500`} />
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">AI Prediction</span>
                <span className={`ml-auto text-[9px] font-black px-2 py-0.5 rounded-full bg-${color}-500/15 text-${color}-500 uppercase`}>
                    {trend.direction}
                </span>
            </div>
            <div className="flex items-start gap-2">
                <Clock size={12} className={`text-${color}-400 flex-shrink-0 mt-0.5`} />
                <p className="text-[11px] text-gray-600 dark:text-gray-300 font-medium leading-relaxed">{trend.text}</p>
            </div>
        </div>
    );
}

// Action Recommendation Panel
function ActionPanel({ drinkScore, analysis }) {
    const { safe, unsafe } = calcUsability(drinkScore, 0, 0, 0); // placeholder — computed outside
    let actions = [];
    if (drinkScore >= 80) {
        actions = [
            { icon: '✅', text: 'Supply approved for drinking and cooking', severity: 'safe' },
            { icon: '✅', text: 'Suitable for all domestic and industrial use', severity: 'safe' },
        ];
    } else if (drinkScore >= 50) {
        actions = [
            { icon: '❌', text: 'Do not use for drinking or cooking', severity: 'danger' },
            { icon: '✅', text: 'Approved for washing, irrigation, and industrial use', severity: 'safe' },
            { icon: '⚙️', text: 'Schedule filtration inspection within 24 hours', severity: 'warn' },
        ];
    } else {
        actions = [
            { icon: '🚨', text: 'Halt supply immediately — do not use for any consumption', severity: 'danger' },
            { icon: '🚨', text: 'Issue public health advisory', severity: 'danger' },
            { icon: '⚙️', text: 'Dispatch emergency water quality team', severity: 'warn' },
            { icon: '⚙️', text: 'Initiate pipe flushing and filtration protocol', severity: 'warn' },
        ];
    }
    return (
        <div className="bg-white dark:bg-gray-900/40 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
                <Target size={16} className="text-primary-500" />
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">AI Action Recommendations</p>
            </div>
            <div className="space-y-2">
                {actions.map((a, i) => (
                    <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[11px] font-medium ${
                        a.severity === 'safe'   ? 'bg-emerald-500/5 text-emerald-600 dark:text-emerald-400' :
                        a.severity === 'danger' ? 'bg-red-500/5 text-red-600 dark:text-red-400' :
                                                  'bg-yellow-500/5 text-yellow-600 dark:text-yellow-400'
                    }`}>
                        <span>{a.icon}</span>
                        <span>{a.text}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Usage Classification Card
function UsageCard({ ph, tds, turbidity, drinkScore }) {
    const { safe, unsafe } = calcUsability(drinkScore, ph, tds, turbidity);
    return (
        <div className="bg-white dark:bg-gray-900/40 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
                <Droplet size={16} className="text-blue-400" />
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Water Usage Classification</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-2">✔ Suitable For</p>
                    <div className="space-y-1">
                        {safe.map((u, i) => (
                            <div key={i} className="flex items-center gap-1.5 bg-emerald-500/5 rounded-lg px-2 py-1">
                                <CheckCircle2 size={9} className="text-emerald-500 flex-shrink-0" />
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{u}</span>
                            </div>
                        ))}
                        {safe.length === 0 && <p className="text-[9px] text-gray-400 italic">None</p>}
                    </div>
                </div>
                <div>
                    <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-2">❌ Not Suitable For</p>
                    <div className="space-y-1">
                        {unsafe.map((u, i) => (
                            <div key={i} className="flex items-center gap-1.5 bg-red-500/5 rounded-lg px-2 py-1">
                                <AlertTriangle size={9} className="text-red-500 flex-shrink-0" />
                                <span className="text-[10px] font-bold text-red-600 dark:text-red-400">{u}</span>
                            </div>
                        ))}
                        {unsafe.length === 0 && <p className="text-[9px] text-gray-400 italic">None</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Pipeline vs Network comparison
function PipelineComparisonCard({ pipelineAvg, networkAvg, pipelineName }) {
    if (!networkAvg || (!networkAvg.ph && !networkAvg.tds)) return null;
    const metrics = [
        { label: 'pH',       pipe: pipelineAvg.ph?.toFixed(2),        net: networkAvg.ph?.toFixed(2),        unit: 'pH',   delta: pipelineAvg.ph - networkAvg.ph,   inverted: false },
        { label: 'TDS',      pipe: Math.round(pipelineAvg.tds),       net: Math.round(networkAvg.tds),       unit: 'mg/L', delta: pipelineAvg.tds - networkAvg.tds,  inverted: true },
        { label: 'Turbidity',pipe: pipelineAvg.turbidity?.toFixed(2), net: networkAvg.turbidity?.toFixed(2), unit: 'NTU',  delta: pipelineAvg.turbidity - networkAvg.turbidity, inverted: true },
    ];
    return (
        <div className="bg-white dark:bg-gray-900/40 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={16} className="text-primary-500" />
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pipeline vs Network Avg</p>
                <span className="ml-auto text-[9px] font-black text-primary-400 uppercase">{pipelineName || 'Selected'}</span>
            </div>
            <div className="space-y-3">
                {metrics.map(({ label, pipe, net, unit, delta, inverted }) => {
                    const worse = inverted ? delta > 0.1 : Math.abs(delta) > 0.2;
                    return (
                        <div key={label} className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-gray-400 uppercase w-20">{label}</span>
                            <div className="flex items-center gap-3 flex-1 justify-end">
                                <span className="text-[11px] font-black dark:text-white">{pipe} <span className="text-gray-400 font-normal">{unit}</span></span>
                                <span className="text-[9px] font-black text-gray-500">vs</span>
                                <span className="text-[11px] text-gray-500">{net} <span className="text-gray-400 font-normal">{unit}</span></span>
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-lg uppercase ${
                                    worse ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'
                                }`}>
                                    {delta > 0 ? '+' : ''}{typeof delta === 'number' ? delta.toFixed(2) : '0'}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────
const WaterQualityIntelligence = ({ liveSensors: propsSensors, pipelines = [], selectedPipelineId, onPipelineChange }) => {
    const [mode, setMode] = useState('live');
    const [internalSensors, setInternalSensors] = useState([]);
    const [labData, setLabData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Trend history: keep last 5 aggregate snapshots
    const historyRef = useRef([]);

    const liveSensors = propsSensors || internalSensors;

    const filteredSensors = selectedPipelineId
        ? liveSensors.filter(s => String(s.pipeline_id) === String(selectedPipelineId))
        : liveSensors;

    const aggregateData = useMemo(() => {
        if (!filteredSensors.length) return { ph: 7, tds: 0, turbidity: 0 };
        const sum = filteredSensors.reduce((acc, s) => ({
            ph: acc.ph + (s.ph || 0),
            tds: acc.tds + (s.tds || 0),
            turbidity: acc.turbidity + (s.turbidity || 0)
        }), { ph: 0, tds: 0, turbidity: 0 });
        return {
            ph: sum.ph / filteredSensors.length,
            tds: sum.tds / filteredSensors.length,
            turbidity: sum.turbidity / filteredSensors.length
        };
    }, [filteredSensors]);

    // Network-wide average (all sensors regardless of pipeline filter)
    const networkAvg = useMemo(() => {
        if (!liveSensors.length) return { ph: 7, tds: 0, turbidity: 0 };
        const sum = liveSensors.reduce((acc, s) => ({
            ph: acc.ph + (s.ph || 0), tds: acc.tds + (s.tds || 0), turbidity: acc.turbidity + (s.turbidity || 0)
        }), { ph: 0, tds: 0, turbidity: 0 });
        return { ph: sum.ph / liveSensors.length, tds: sum.tds / liveSensors.length, turbidity: sum.turbidity / liveSensors.length };
    }, [liveSensors]);

    // Update history snapshot whenever aggregateData changes
    useEffect(() => {
        historyRef.current = [...historyRef.current, { ...aggregateData }].slice(-6);
    }, [aggregateData]);

    const { ph, tds, turbidity } = aggregateData;
    const drinkScore   = calcDrinkabilityScore(ph, tds, turbidity);
    const riskFactors  = calcRiskFactors(ph, tds, turbidity);
    const confidence   = calcConfidenceScore(filteredSensors);
    const trend        = calcTrend(historyRef.current);
    const analysis     = analyzeQuality(aggregateData);
    const selectedPipeline = pipelines.find(p => String(p.id) === String(selectedPipelineId));

    const fetchLiveData = async () => {
        if (propsSensors) { setLoading(false); return; }
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/sensors`);
            setInternalSensors(() => [...res.data]);
            setLoading(false);
        } catch (err) {
            setError('Failed to synchronize IoT feed');
            setLoading(false);
        }
    };

    useEffect(() => {
        if (mode === 'live') {
            fetchLiveData();
            const interval = setInterval(fetchLiveData, 2000);
            return () => clearInterval(interval);
        }
    }, [mode, propsSensors]);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const lines = event.target.result.split('\n');
            const data = lines[1].split(',');
            setLabData({
                sensor_id: data[0], ph: parseFloat(data[1]),
                turbidity: parseFloat(data[2]), tds: parseFloat(data[3]),
                timestamp: new Date().toLocaleTimeString()
            });
        };
        reader.readAsText(file);
    };

    const renderMetricCard = (label, value, unit, Icon, colorClass) => (
        <div className="bg-white dark:bg-gray-900/40 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xl">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl bg-gray-50 dark:bg-gray-800 ${colorClass}`}>
                    <Icon size={24} />
                </div>
                <Zap size={16} className="text-gray-300 animate-pulse" />
            </div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
            <h3 className="text-2xl font-black dark:text-white mt-1 tracking-tighter">
                {value} <span className="text-xs text-gray-400 font-bold ml-1">{unit}</span>
            </h3>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* ── Header ───────────────────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 className="text-3xl font-black dark:text-white tracking-tighter uppercase">Water Quality Intelligence</h2>
                    <p className="text-gray-500 font-bold text-sm tracking-widest mt-1 uppercase">
                        {selectedPipelineId ? `Pipeline: ${selectedPipeline?.name}` : 'Regional Quality Overview'}
                    </p>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="relative">
                        <select
                            value={selectedPipelineId || ''}
                            onChange={(e) => onPipelineChange(e.target.value)}
                            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 text-xs font-black dark:text-gray-200 focus:ring-2 focus:ring-primary-500 outline-none appearance-none pr-10 cursor-pointer shadow-xl"
                        >
                            <option value="">SELECT PIPELINE (ALL)</option>
                            {pipelines.map(p => <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>)}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                            <Activity size={14} />
                        </div>
                    </div>
                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl shadow-inner border border-white/5">
                        <button onClick={() => setMode('live')} className={`flex items-center space-x-2 px-6 py-2 rounded-xl text-xs font-black transition-all ${mode === 'live' ? 'bg-white dark:bg-gray-700 shadow-xl text-primary-500' : 'text-gray-400 hover:text-gray-500'}`}>
                            <Activity size={14} /><span>LIVE IOT FEED</span>
                        </button>
                        <button onClick={() => setMode('upload')} className={`flex items-center space-x-2 px-6 py-2 rounded-xl text-xs font-black transition-all ${mode === 'upload' ? 'bg-white dark:bg-gray-700 shadow-xl text-primary-500' : 'text-gray-400 hover:text-gray-500'}`}>
                            <Upload size={14} /><span>LAB REPORT IMPORT</span>
                        </button>
                    </div>
                </div>
            </div>

            {mode === 'live' ? (
                <div className="space-y-8">
                    {/* ── Row 1: Health card + Drinkability + Metrics ──────────── */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        {/* Status card */}
                        <div className={`lg:col-span-1 p-6 rounded-3xl border ${analysis.border} ${analysis.bg} flex flex-col justify-between relative overflow-hidden group min-h-[160px]`}>
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Droplet size={80} />
                            </div>
                            <div className="relative z-10">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Health Analysis</span>
                                <h4 className={`text-xl font-black tracking-tighter mt-2 ${analysis.textColor}`}>{analysis.status}</h4>
                                <div className="flex items-center space-x-2 mt-3">
                                    <div className={`w-2 h-2 rounded-full ${analysis.drinkable ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                    <span className="text-[9px] font-black uppercase text-gray-500">{analysis.drinkable ? 'Drinkable' : 'Not for Drinking'}</span>
                                </div>
                                {/* Confidence badge */}
                                <div className="mt-3 bg-black/10 dark:bg-white/5 rounded-xl px-3 py-1.5">
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Confidence: </span>
                                    <span className={`text-[9px] font-black uppercase ${confidence >= 70 ? 'text-emerald-500' : confidence >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>{confidence}%</span>
                                </div>
                            </div>
                        </div>

                        {/* Drinkability score ring */}
                        <DrinkabilityCard score={drinkScore} />

                        {/* Existing metric cards */}
                        {renderMetricCard('Mineral Profiling', analysis.mineralLabel, '', Info, analysis.textColor)}
                        {renderMetricCard('Turbidity', aggregateData.turbidity?.toFixed(2) || '0.00', 'NTU', RefreshCw, 'text-amber-500')}
                        {renderMetricCard('pH Level', aggregateData.ph?.toFixed(2) || '0.00', 'pH', FlaskConical, 'text-blue-500')}
                    </div>

                    {/* ── Row 2: Clinical Insight Engine (enhanced) ─────────────── */}
                    <div className="bg-white dark:bg-gray-800/50 backdrop-blur-xl p-8 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xl">
                        <div className="flex items-center space-x-3 mb-4">
                            <Brain className="text-primary-500" size={20} />
                            <h3 className="text-sm font-black dark:text-white uppercase tracking-widest">Clinical Insight Engine</h3>
                            <span className={`ml-auto text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                                drinkScore >= 80 ? 'bg-emerald-500/15 text-emerald-500' : drinkScore >= 50 ? 'bg-yellow-500/15 text-yellow-500' : 'bg-red-500/15 text-red-500 animate-pulse'
                            }`}>
                                {drinkScore >= 80 ? 'All Clear' : drinkScore >= 50 ? 'Caution' : 'Critical'}
                            </span>
                        </div>
                        <p className="text-base font-bold dark:text-gray-200 tracking-tight leading-snug">
                            {analysis.explanation.length > 10
                                ? analysis.explanation
                                : `Water quality parameters are within acceptable ranges — pH ${ph.toFixed(2)}, TDS ${Math.round(tds)} mg/L, turbidity ${turbidity.toFixed(2)} NTU.`}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                            The {selectedPipelineId ? 'selected pipeline' : 'network average'} shows {analysis.mineralLabel.toLowerCase()} mineral levels.
                            {analysis.drinkable
                                ? ' Water is fully compliant with WHO drinking water standards.'
                                : ' Water requires treatment before safe consumption. Use restricted to non-drinking applications.'}
                            {` AI confidence in this assessment: ${confidence}%.`}
                        </p>
                    </div>

                    {/* ── Row 3: Risk + Prediction + Actions ───────────────────── */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <RiskPanel factors={riskFactors} />
                        <div className="space-y-4">
                            <PredictionCard trend={trend} />
                            <UsageCard ph={ph} tds={tds} turbidity={turbidity} drinkScore={drinkScore} />
                        </div>
                        <div className="space-y-4">
                            <ActionPanel drinkScore={drinkScore} analysis={analysis} />
                            {selectedPipelineId && (
                                <PipelineComparisonCard
                                    pipelineAvg={aggregateData}
                                    networkAvg={networkAvg}
                                    pipelineName={selectedPipeline?.name}
                                />
                            )}
                        </div>
                    </div>

                    {/* ── Row 4: Regional Quality Matrix (existing table) ────────── */}
                    <div className="glass-card overflow-hidden">
                        <div className="p-8 border-b dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
                            <h3 className="text-xl font-black dark:text-white tracking-tighter uppercase">Regional Quality Matrix</h3>
                            <button className="text-[10px] font-black text-primary-500 border border-primary-500/20 px-3 py-1 rounded-lg">Synchronize Live</button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 dark:bg-gray-800/30">
                                    <tr>
                                        <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Node Identifier</th>
                                        <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">pH Level</th>
                                        <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">TDS</th>
                                        <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Turbidity</th>
                                        <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Score</th>
                                        <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-gray-700">
                                    {filteredSensors.map(sensor => {
                                        const q = analyzeQuality(sensor);
                                        const sc = calcDrinkabilityScore(sensor.ph || 7, sensor.tds || 0, sensor.turbidity || 0);
                                        return (
                                            <tr key={sensor.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-all">
                                                <td className="p-6">
                                                    <span className="font-black text-sm dark:text-white uppercase tracking-tighter">{sensor.name}</span>
                                                    <p className="text-[8px] text-gray-400 font-bold uppercase mt-0.5">{sensor.pipeline_name || 'Independent Node'}</p>
                                                </td>
                                                <td className="p-6 text-sm font-bold dark:text-gray-400">{sensor.ph?.toFixed(2)}</td>
                                                <td className="p-6 text-sm font-bold dark:text-gray-400">{Math.round(sensor.tds || 0)} mg/L</td>
                                                <td className="p-6 text-sm font-bold dark:text-gray-400">{sensor.turbidity?.toFixed(2)} NTU</td>
                                                <td className="p-6">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                            <div className={`h-full rounded-full ${sc >= 80 ? 'bg-emerald-500' : sc >= 50 ? 'bg-yellow-400' : 'bg-red-500'}`} style={{ width: `${sc}%` }} />
                                                        </div>
                                                        <span className={`text-[10px] font-black ${sc >= 80 ? 'text-emerald-500' : sc >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>{sc}</span>
                                                    </div>
                                                </td>
                                                <td className="p-6">
                                                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${q.bg} ${q.textColor} ${q.border}`}>
                                                        {q.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                /* ── Lab Upload Mode (unchanged) ─────────────────────────────── */
                <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white dark:bg-gray-900 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-[2.5rem] p-16 text-center group hover:border-primary-500/50 transition-all cursor-pointer relative overflow-hidden">
                        <input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer z-20" />
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="p-6 bg-primary-500/10 rounded-3xl text-primary-500 mb-6 group-hover:scale-110 transition-transform">
                                <FileText size={48} />
                            </div>
                            <h3 className="text-2xl font-black dark:text-white tracking-tighter uppercase mb-2">Upload Chemical Lab Report</h3>
                            <p className="text-gray-500 font-bold text-sm tracking-widest uppercase">Select CSV file for automated cognitive classification</p>
                            <div className="mt-8 flex items-center space-x-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                <Info size={12} /><span>Format: id, ph, turbidity, tds</span>
                            </div>
                        </div>
                    </div>

                    {labData && (() => {
                        const la = analyzeQuality(labData);
                        const sc = calcDrinkabilityScore(labData.ph || 7, labData.tds || 0, labData.turbidity || 0);
                        const rf = calcRiskFactors(labData.ph || 7, labData.tds || 0, labData.turbidity || 0);
                        return (
                            <div className="space-y-6 animate-in zoom-in-95 duration-500">
                                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                                    <div className={`p-6 rounded-3xl border ${la.border} ${la.bg} flex flex-col justify-between`}>
                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Lab Diagnostic</span>
                                        <h4 className={`text-2xl font-black tracking-tighter mt-2 ${la.textColor}`}>{la.status}</h4>
                                        <p className="text-[10px] text-gray-500 mt-3">{la.explanation}</p>
                                    </div>
                                    <DrinkabilityCard score={sc} />
                                    {renderMetricCard('Reported pH', labData.ph, 'pH', FlaskConical, 'text-blue-500')}
                                    {renderMetricCard('TDS Profile', Math.round(labData.tds), 'mg/L', Activity, 'text-emerald-500')}
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <RiskPanel factors={rf} />
                                    <ActionPanel drinkScore={sc} analysis={la} />
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}
        </div>
    );
};

export default WaterQualityIntelligence;
