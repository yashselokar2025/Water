import React, { useState, useEffect, useMemo } from 'react';
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
    Brain
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

const WaterQualityIntelligence = ({ liveSensors: propsSensors, pipelines = [], selectedPipelineId, onPipelineChange }) => {
    const [mode, setMode] = useState('live'); // 'live' or 'upload'
    const [internalSensors, setInternalSensors] = useState([]);
    const [labData, setLabData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const liveSensors = propsSensors || internalSensors;

    const filteredSensors = selectedPipelineId
        ? liveSensors.filter(s => String(s.pipeline_id) === String(selectedPipelineId))
        : liveSensors;

    const aggregateData = useMemo(() => {
        if (!filteredSensors.length) return { ph: 0, tds: 0, turbidity: 0 };
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

    // Enhanced Clinical Classification Logic
    const analyzeQuality = (val) => {
        const ph = val.ph || 0;
        const tds = val.tds || 0;
        const turbidity = val.turbidity || 0;
        let drinkable = true;
        let usable = true;
        let toxic = false;
        let status = "✅ Safe to Drink";
        let color = "emerald";
        let reasons = [];

        // 1. Toxicity / Hard Exclusion
        if (tds > 1000 || ph < 5.0 || ph > 10.0 || turbidity > 10.0) {
            toxic = true;
            drinkable = false;
            usable = false;
            status = "🚨 Unsafe / Toxic";
            color = "red";
            if (tds > 1000) reasons.push("Extreme Mineral Concentration (>1000 mg/L)");
            if (ph < 5.0 || ph > 10.0) reasons.push("Hazardous Chemical pH Levels");
            if (turbidity > 10.0) reasons.push("Dangerous Contamination Opacity");
        }
        // 2. Drinkability Checks
        else if (ph < 6.5 || ph > 8.5 || tds > 300 || turbidity > 1.0) {
            drinkable = false;
            status = "⚠️ Safe for Use (Not Drinking)";
            color = "amber";
            if (ph < 6.5 || ph > 8.5) reasons.push("pH variation outside drinking standards");
            if (tds > 300) reasons.push("High mineral density for consumption");
            if (turbidity > 1.0) reasons.push("Minor particulate presence detected");
        } else {
            reasons.push("Optimized chemical balance and high clarity");
        }

        // Mineral Level Interpretation
        let mineralLabel = "Good Minerals";
        if (tds < 150) mineralLabel = "Low minerals";
        else if (tds > 300 && tds <= 600) mineralLabel = "Moderate (Harder)";
        else if (tds > 600 && tds <= 1000) mineralLabel = "High (Hard Water)";
        else if (tds > 1000) mineralLabel = "Very High (Unsafe)";

        return {
            status, drinkable, usable, toxic, color,
            explanation: reasons.join(". "),
            mineralLabel,
            bg: `bg-${color}-500/10`,
            border: `border-${color}-500/20`,
            textColor: `text-${color}-500`
        };
    };

    const fetchLiveData = async () => {
        if (propsSensors) return; // Use data from props if available
        console.log("WaterQuality: Sensor update running");
        try {
            const res = await axios.get('http://localhost:5000/api/sensors');
            setInternalSensors(() => [...res.data]);
            console.log("WaterQuality: New data added");
            setLoading(false);
        } catch (err) {
            setError("Failed to synchronize IoT feed");
            setLoading(false);
        }
    };

    useEffect(() => {
        if (mode === 'live') {
            fetchLiveData();
            const interval = setInterval(fetchLiveData, 2000);
            return () => clearInterval(interval);
        }
    }, [mode, propsSensors]); // Add propsSensors to avoid stale state if it changes

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            const lines = text.split('\n');
            const data = lines[1].split(','); // Assuming format: sensor_id,ph,turbidity,tds

            const parsed = {
                sensor_id: data[0],
                ph: parseFloat(data[1]),
                turbidity: parseFloat(data[2]),
                tds: parseFloat(data[3]),
                timestamp: new Date().toLocaleTimeString()
            };

            setLabData(parsed);

            // Alert trigger if poor
            const analysis = analyzeQuality(parsed);
            if (analysis.status === 'Poor') {
                triggerAlert(parsed, analysis);
            }
        };
        reader.readAsText(file);
    };

    const triggerAlert = async (data, analysis) => {
        try {
            await axios.post('http://localhost:5000/api/alerts', {
                pipeline_name: `LAB REPORT: ${data.sensor_id}`,
                location: 'Central Lab',
                severity: 'High',
                description: `Manual Lab Report detected Poor Water Quality: ${analysis.issues.join(', ')}`
            });
        } catch (err) {
            console.error("Failed to trigger lab alert:", err);
        }
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
            {/* Header with Mode Toggle & Pipeline Selector */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 className="text-3xl font-black dark:text-white tracking-tighter uppercase">Water Quality Intelligence</h2>
                    <p className="text-gray-500 font-bold text-sm tracking-widest mt-1 uppercase">
                        {selectedPipelineId ? `Pipeline: ${pipelines.find(p => String(p.id) === String(selectedPipelineId))?.name}` : 'Regional Quality Overview'}
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
                            {pipelines.map(p => (
                                <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                            <Activity size={14} />
                        </div>
                    </div>

                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl shadow-inner border border-white/5">
                        <button
                            onClick={() => setMode('live')}
                            className={`flex items-center space-x-2 px-6 py-2 rounded-xl text-xs font-black transition-all ${mode === 'live' ? 'bg-white dark:bg-gray-700 shadow-xl text-primary-500' : 'text-gray-400 hover:text-gray-500'}`}
                        >
                            <Activity size={14} />
                            <span>LIVE IOT FEED</span>
                        </button>
                        <button
                            onClick={() => setMode('upload')}
                            className={`flex items-center space-x-2 px-6 py-2 rounded-xl text-xs font-black transition-all ${mode === 'upload' ? 'bg-white dark:bg-gray-700 shadow-xl text-primary-500' : 'text-gray-400 hover:text-gray-500'}`}
                        >
                            <Upload size={14} />
                            <span>LAB REPORT IMPORT</span>
                        </button>
                    </div>
                </div>
            </div>

            {mode === 'live' ? (
                <div className="space-y-8">
                    {/* Live Overview Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        {(() => {
                            const analysis = analyzeQuality(aggregateData);
                            return (
                                <>
                                    <div className={`lg:col-span-1 p-6 rounded-3xl border ${analysis.border} ${analysis.bg} flex flex-col justify-between relative overflow-hidden group min-h-[160px]`}>
                                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                            <Droplet size={80} />
                                        </div>
                                        <div className="relative z-10">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Health Analysis</span>
                                            <h4 className={`text-2xl font-black tracking-tighter mt-2 ${analysis.textColor}`}>{analysis.status}</h4>
                                            <div className="flex items-center space-x-2 mt-4">
                                                <div className={`w-2 h-2 rounded-full ${analysis.drinkable ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                                                <span className="text-[9px] font-black uppercase text-gray-500">{analysis.drinkable ? 'Drinkable' : 'Not for Drinking'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    {renderMetricCard('Mineral Profiling', analysis.mineralLabel, '', Info, analysis.textColor)}
                                    {renderMetricCard('Chemical Clarity', aggregateData.turbidity?.toFixed(2) || '0.00', 'NTU', RefreshCw, 'text-amber-500')}
                                    {renderMetricCard('Current pH', aggregateData.ph?.toFixed(2) || '0.00', 'pH', FlaskConical, 'text-blue-500')}
                                </>
                            )
                        })()}
                    </div>

                    <div className="bg-white dark:bg-gray-800/50 backdrop-blur-xl p-8 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xl">
                        <div className="flex items-center space-x-3 mb-4">
                            <Brain className="text-primary-500" size={20} />
                            <h3 className="text-sm font-black dark:text-white uppercase tracking-widest">Clinical Insight Engine</h3>
                        </div>
                        <p className="text-lg font-bold dark:text-gray-200 tracking-tight leading-snug">
                            {analyzeQuality(aggregateData).explanation}. This {selectedPipelineId ? 'pipeline' : 'sector'} exhibits {analyzeQuality(aggregateData).mineralLabel.toLowerCase()} levels, making the water {analyzeQuality(aggregateData).drinkable ? 'fully compliant with drinking standards' : 'suitable for localized industrial or washing utilities only'}.
                        </p>
                    </div>

                    {/* Quality Trend Table */}
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
                                        <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">TDS Flow</th>
                                        <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Turbidity</th>
                                        <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Cognitive Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-gray-700">
                                    {filteredSensors.map(sensor => {
                                        const q = analyzeQuality(sensor);
                                        return (
                                            <tr key={sensor.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-all">
                                                <td className="p-6">
                                                    <span className="font-black text-sm dark:text-white uppercase tracking-tighter">{sensor.name}</span>
                                                    <p className="text-[8px] text-gray-400 font-bold uppercase mt-0.5">{sensor.pipeline_name || 'Independent Node'}</p>
                                                </td>
                                                <td className="p-6 text-sm font-bold dark:text-gray-400">{sensor.ph?.toFixed(2)}</td>
                                                <td className="p-6 text-sm font-bold dark:text-gray-400">{sensor.tds?.toFixed(2)} mg/L</td>
                                                <td className="p-6 text-sm font-bold dark:text-gray-400">{sensor.turbidity?.toFixed(2)} NTU</td>
                                                <td className="p-6">
                                                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${q.bg} ${q.textColor} ${q.border}`}>
                                                        {q.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white dark:bg-gray-900 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-[2.5rem] p-16 text-center group hover:border-primary-500/50 transition-all cursor-pointer relative overflow-hidden">
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileUpload}
                            className="absolute inset-0 opacity-0 cursor-pointer z-20"
                        />
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="p-6 bg-primary-500/10 rounded-3xl text-primary-500 mb-6 group-hover:scale-110 transition-transform">
                                <FileText size={48} />
                            </div>
                            <h3 className="text-2xl font-black dark:text-white tracking-tighter uppercase mb-2">Upload Chemical Lab Report</h3>
                            <p className="text-gray-500 font-bold text-sm tracking-widest uppercase">Select CSV file for automated cognitive classification</p>
                            <div className="mt-8 flex items-center space-x-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                <Info size={12} />
                                <span>Format: id, ph, turbidity, tds</span>
                            </div>
                        </div>
                    </div>

                    {labData && (() => {
                        const analysis = analyzeQuality(labData);
                        return (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-1 animate-in zoom-in-95 duration-500">
                                <div className="lg:col-span-1 space-y-6">
                                    <div className={`p-8 rounded-[2rem] border ${analysis.border} ${analysis.bg} h-full flex flex-col justify-between`}>
                                        <div>
                                            <div className="flex justify-between items-start mb-6">
                                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Lab Diagnostic Result</span>
                                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${analysis.color} ${analysis.border}`}>
                                                    {analysis.level}
                                                </span>
                                            </div>
                                            <h4 className={`text-5xl font-black tracking-tighter ${analysis.color}`}>{analysis.status}</h4>
                                            <p className="text-sm font-bold dark:text-gray-400 mt-4 leading-relaxed">
                                                {analysis.status === 'Good'
                                                    ? 'The lab specimen indicates clinical grade stability. Safe for generic and industrial distribution.'
                                                    : 'The specimen exhibits significant chemical deviations. Immediate alert containment procedures initialized.'}
                                            </p>
                                        </div>
                                        <div className="mt-8 pt-8 border-t border-white/5 space-y-4">
                                            {analysis.issues.map((issue, i) => (
                                                <div key={i} className="flex items-center space-x-3">
                                                    <div className={`w-2 h-2 rounded-full ${analysis.status === 'Good' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                                                    <span className="text-[10px] font-black uppercase text-gray-500">{issue}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="lg:col-span-2 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {renderMetricCard('Reported pH', labData.ph, 'pH', FlaskConical, 'text-blue-500')}
                                        {renderMetricCard('Turbidity Index', labData.turbidity, 'NTU', RefreshCw, 'text-amber-500')}
                                        {renderMetricCard('TDS Profile', labData.tds, 'mg/L', Activity, 'text-emerald-500')}
                                    </div>

                                    <div className="bg-white dark:bg-gray-900/40 p-8 rounded-[2rem] border border-gray-100 dark:border-white/5">
                                        <div className="flex items-center space-x-3 mb-8">
                                            <ShieldCheck className="text-primary-500" size={20} />
                                            <h3 className="text-sm font-black dark:text-white uppercase tracking-widest">Cognitive Recommendation</h3>
                                        </div>
                                        <div className="p-5 bg-primary-500/10 rounded-2xl border border-primary-500/20">
                                            <p className="text-xs font-bold dark:text-gray-200 leading-relaxed">
                                                {analysis.status === 'Good'
                                                    ? 'Laboratory data confirms sensor telemetry accuracy. No manual override required. Maintain current distribution protocols.'
                                                    : 'Manual lab report contradicts previous optimal status. Overriding IoT status and triggering secondary containment alert across the central sector.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })()}
                </div>
            )}
        </div>
    );
};

export default WaterQualityIntelligence;
