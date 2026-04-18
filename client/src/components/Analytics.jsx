import React, { useState, useEffect } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine
} from 'recharts';
import { Activity, Thermometer, Droplet, Wind, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Brain, Target, ShieldCheck } from 'lucide-react';
import axios from 'axios';

const Analytics = ({ sensors: propsSensors, pipelines = [], selectedPipelineId, onPipelineChange }) => {
    const [internalSensors, setInternalSensors] = useState([]);
    const sensors = propsSensors || internalSensors;

    // Auto-select first sensor of pipeline if not selected
    const filteredSensors = selectedPipelineId
        ? sensors.filter(s => String(s.pipeline_id) === String(selectedPipelineId))
        : sensors;

    const [selectedSensor, setSelectedSensor] = useState(filteredSensors[0]?.id || 1);
    const [data, setData] = useState([]);
    const [metric, setMetric] = useState('pressure');
    const [aiInsights, setAiInsights] = useState(null);

    // Sync selected sensor when pipeline changes
    useEffect(() => {
        if (filteredSensors.length > 0 && !filteredSensors.find(s => String(s.id) === String(selectedSensor))) {
            setSelectedSensor(filteredSensors[0].id);
        }
    }, [selectedPipelineId, filteredSensors]);

    const metrics = [
        { id: 'pressure', label: 'Pressure', unit: 'bar', color: '#3b82f6', threshold: 2 },
        { id: 'flow', label: 'Flow', unit: 'L/s', color: '#8b5cf6', threshold: 10 },
        { id: 'ph', label: 'pH Level', unit: '', color: '#10b981', threshold: 7 },
        { id: 'turbidity', label: 'Turbidity', unit: 'NTU', color: '#f59e0b', threshold: 5 },
        { id: 'tds', label: 'TDS', unit: 'ppm', color: '#ef4444', threshold: 400 },
    ];

    const fetchData = async () => {
        if (!selectedSensor) return;
        console.log("Analytics: Sensor update running");
        try {
            const res = await axios.get(`http://localhost:5000/api/analytics/${selectedSensor}`);
            // Use functional update and ensure new array reference
            setData(prev => {
                const newData = [...res.data];
                console.log("Analytics: New data added", newData.length, "points");
                return newData;
            });

            const predRes = await axios.get(`http://localhost:5000/api/ai/predict/${selectedSensor}`);
            setAiInsights(prev => ({ ...predRes.data }));
        } catch (err) {
            console.error("Analytics sync failed:", err);
        }
    };

    useEffect(() => {
        if (selectedSensor) {
            fetchData();
            const interval = setInterval(fetchData, 2000);
            return () => clearInterval(interval);
        }
    }, [selectedSensor]);

    const currentMetric = metrics.find(m => m.id === metric);
    const latestValue = data.filter(d => !d.isForecast).slice(-1)[0];
    const trendInfo = aiInsights?.metrics?.[metric];

    const renderTrendIcon = (trend) => {
        if (trend === 'Increasing') return <TrendingUp size={16} className="text-emerald-500" />;
        if (trend === 'Decreasing') return <TrendingDown size={16} className="text-red-500" />;
        return <Minus size={16} className="text-gray-400" />;
    };

    return (
        <div className="space-y-6 animate-in zoom-in-95 duration-500 pb-20">
            {/* Header section updated */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center space-x-4">
                    <div className="p-3 bg-primary-500/10 rounded-2xl border border-primary-500/20">
                        <Brain className={sensors.find(s => String(s.id) === String(selectedSensor))?.isAnomaly ? 'text-red-500 animate-pulse' : 'text-primary-500'} size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black dark:text-white uppercase tracking-tighter">AI-Powered Infrastructure Analytics</h2>
                        <div className="flex items-center gap-2">
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-[0.2em]">{selectedPipelineId ? `Inspecting ${pipelines.find(p => String(p.id) === String(selectedPipelineId))?.name}` : 'Regional Infrastructure Deep-Dive'}</p>
                            {sensors.find(s => String(s.id) === String(selectedSensor))?.isAnomaly && (
                                <span className="bg-red-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full animate-bounce uppercase tracking-widest">Anomaly Active</span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex space-x-2">
                    <select
                        value={selectedPipelineId || ''}
                        onChange={(e) => onPipelineChange(e.target.value)}
                        className="bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-xl px-4 py-2.5 text-[10px] font-black dark:text-gray-200 outline-none focus:ring-2 focus:ring-primary-500 shadow-xl transition-all"
                    >
                        <option value="">ALL SYSTEMS</option>
                        {pipelines.map(p => <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>)}
                    </select>

                    <select
                        value={selectedSensor}
                        onChange={(e) => setSelectedSensor(e.target.value)}
                        className="bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-xl px-4 py-2.5 text-[10px] font-black dark:text-gray-200 outline-none focus:ring-2 focus:ring-primary-500 shadow-xl transition-all"
                    >
                        {filteredSensors.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()} – {s.location.toUpperCase()}</option>)}
                    </select>
                </div>
            </div>

            {/* --- WATER QUALITY PULSE ROW --- */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Pressure Status', value: sensors.find(s => String(s.id) === String(selectedSensor))?.pressure?.toFixed(2) + ' bar', icon: Target, color: 'text-blue-500', detail: 'Primary Force' },
                    { label: 'pH Stability', value: sensors.find(s => String(s.id) === String(selectedSensor))?.ph?.toFixed(2), icon: Droplet, color: 'text-emerald-500', detail: 'Potability' },
                    { label: 'Turbidity Index', value: sensors.find(s => String(s.id) === String(selectedSensor))?.turbidity?.toFixed(2) + ' NTU', icon: Wind, color: 'text-amber-500', detail: 'Clarity' },
                    { label: 'Mineral (TDS)', value: sensors.find(s => String(s.id) === String(selectedSensor))?.tds?.toFixed(2) + ' ppm', icon: Activity, color: 'text-red-500', detail: 'Solids' }
                ].map((p, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xl flex items-center gap-5">
                        <div className={`p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-white/5 ${p.color}`}>
                            <p.icon size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{p.label}</p>
                            <p className={`text-xl font-black dark:text-white tracking-tighter ${p.color}`}>{p.value}</p>
                            <p className="text-[9px] font-bold text-gray-500 uppercase mt-0.5">{p.detail}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3 glass-card p-8 min-h-[550px] flex flex-col relative overflow-hidden border-white/5 shadow-2xll border-2 border-gray-100 dark:border-white/5">
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
                        <Target size={240} />
                    </div>

                    <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4 relative z-10">
                        <div className="flex flex-wrap gap-2">
                            {metrics.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => setMetric(m.id)}
                                    className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${metric === m.id ? 'bg-primary-500 text-white shadow-xl scale-105' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-gray-500 border border-transparent hover:border-gray-200 dark:hover:border-gray-700'}`}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2 bg-emerald-500/10 px-4 py-1.5 rounded-full border border-emerald-500/20 text-xs shadow-inner">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Live Prediction</span>
                            </div>
                            <div className="text-[10px] font-black dark:text-gray-400 uppercase tracking-widest bg-gray-100 dark:bg-gray-800 px-4 py-1.5 rounded-full">
                                Limit: {currentMetric.threshold} {currentMetric.unit}
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 min-h-[350px]">
                        <ResponsiveContainer width="100%" height={380} minWidth={0} minHeight={380}>
                            <LineChart data={[...data]}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" strokeOpacity={0.05} />
                                <XAxis
                                    dataKey="time"
                                    stroke="#9ca3af"
                                    tick={{ fontSize: 10, fontWeight: 800 }}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#9ca3af"
                                    tick={{ fontSize: 10, fontWeight: 800 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const item = payload[0].payload;
                                            return (
                                                <div className="bg-gray-900 border border-white/10 p-4 rounded-2xl shadow-2xl backdrop-blur-xl">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">{item.time}</p>
                                                    <div className="flex items-center space-x-3">
                                                        <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: currentMetric.color }}></div>
                                                        <p className="text-lg font-black text-white">{payload[0].value.toFixed(2)} {currentMetric.unit}</p>
                                                    </div>
                                                    {item.isForecast && (
                                                        <div className="mt-2 text-[9px] font-black text-amber-500 uppercase flex items-center">
                                                            <Brain size={12} className="mr-1" /> AI FORECASTED POINT
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <ReferenceLine y={currentMetric.threshold} stroke={currentMetric.color} strokeDasharray="3 3" strokeOpacity={0.5} />

                                {/* Historical Line */}
                                <Line
                                    type="monotone"
                                    data={data.filter(d => !d.isForecast)}
                                    dataKey={metric}
                                    stroke={currentMetric.color}
                                    strokeWidth={4}
                                    dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                                    activeDot={{ r: 8, strokeWidth: 0 }}
                                    animationDuration={1500}
                                />
                                {/* Forecast Dotted Line */}
                                <Line
                                    type="monotone"
                                    data={data.filter((d, i) => d.isForecast || i === data.filter(pt => !pt.isForecast).length - 1)}
                                    dataKey={metric}
                                    stroke={currentMetric.color}
                                    strokeWidth={4}
                                    strokeDasharray="8 8"
                                    dot={{ r: 5, stroke: currentMetric.color, strokeWidth: 2, fill: '#1f2937' }}
                                    animationDuration={1500}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="mt-8 flex items-center justify-between border-t border-gray-100 dark:border-white/5 pt-6">
                        <div className="flex items-center space-x-8">
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Current Trend</p>
                                <div className="flex items-center space-x-2">
                                    {renderTrendIcon(trendInfo?.trend)}
                                    <span className="text-sm font-black dark:text-white uppercase tracking-tighter">{trendInfo?.trend || 'Stable'}</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">AI Confidence</p>
                                <div className="flex items-center space-x-3">
                                    <div className="w-24 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden shadow-inner">
                                        <div
                                            className="h-full bg-primary-500 transition-all duration-1000"
                                            style={{ width: `${aiInsights?.confidence || 0}%` }}
                                        />
                                    </div>
                                    <span className="text-sm font-black dark:text-white">{aiInsights?.confidence || 0}%</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2 text-[10px] font-black text-gray-400 uppercase">
                            <ShieldCheck size={14} className="text-primary-500" />
                            <span>Validated via Deep Insights Layer</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* XAI Card */}
                    <div className="glass-card p-6 border-l-4 border-indigo-500 bg-indigo-500/[0.03] relative overflow-hidden group">
                        <div className="absolute -top-4 -right-4 opacity-5 group-hover:scale-110 transition-transform">
                            <Brain size={80} />
                        </div>
                        <h4 className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-4 flex items-center">
                            <Activity size={14} className="mr-2" /> Explainable AI (XAI)
                        </h4>
                        <div className="space-y-4 relative z-10">
                            {aiInsights?.insights?.map((insight, idx) => (
                                <div key={idx} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black dark:text-white uppercase tracking-tighter">{insight.type}</span>
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded ${insight.level === 'High' ? 'bg-red-500/20 text-red-500' : 'bg-amber-500/20 text-amber-500'}`}>
                                            {insight.level.toUpperCase()} IMPACT
                                        </span>
                                    </div>
                                    <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 leading-relaxed italic">
                                        "{insight.explanation}"
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="glass-card p-6 border-l-4 border-emerald-500 shadow-xl">
                        <h4 className="text-[11px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-6 flex items-center">
                            <Target size={14} className="mr-2" /> Operational Summary
                        </h4>
                        <div className="space-y-6">
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Live Reading</p>
                                    <h5 className="text-4xl font-black dark:text-white tracking-tighter">
                                        {latestValue?.[metric]?.toFixed(2)}
                                        <span className="text-sm font-bold text-gray-500 ml-1">{currentMetric.unit}</span>
                                    </h5>
                                </div>
                                <div className={`p-2 rounded-xl ${latestValue?.[metric] > currentMetric.threshold ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                    {latestValue?.[metric] > currentMetric.threshold ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
                                </div>
                            </div>

                            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-white/10">
                                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2 flex items-center">
                                    <Wind size={12} className="mr-1" /> Predicted Next Phase
                                </p>
                                <p className="text-xl font-black dark:text-white tracking-tighter">
                                    ~{trendInfo?.predicted?.toFixed(2)}
                                    <span className="text-xs font-bold text-gray-500 ml-1">{currentMetric.unit}</span>
                                </p>
                                <p className="text-[9px] font-black text-gray-400 uppercase mt-2">Expected in next 10 minutes</p>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card p-6 bg-primary-500/[0.02] border border-primary-500/10 shadow-lg">
                        <div className="flex items-center space-x-3 mb-4">
                            <Target className="text-primary-500" size={16} />
                            <h4 className="text-[10px] font-black dark:text-white uppercase tracking-widest">Executive Decision Support</h4>
                        </div>
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 underline decoration-primary-500/30 underline-offset-4 leading-relaxed">
                            {aiInsights?.riskCalculated?.score > 50 ? 'Immediate crew deployment is prioritized based on forecasted parameter deviation.' : 'Proceed with routine maintenance schedule. Prediction models show low volatility.'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Analytics;
