import React, { useState, useEffect, useMemo } from 'react';
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
import { Activity, Thermometer, Droplet, Wind, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Brain, Target, ShieldCheck, Filter, Search, ChevronRight } from 'lucide-react';
import axios from 'axios';

const Analytics = ({ sensors: propsSensors, pipelines = [], selectedPipelineId, onPipelineChange }) => {
    const [internalSensors, setInternalSensors] = useState([]);
    const sensors = propsSensors || internalSensors;

    const filteredSensors = selectedPipelineId
        ? sensors.filter(s => String(s.pipeline_id) === String(selectedPipelineId))
        : sensors;

    const [selectedSensor, setSelectedSensor] = useState('aggregate');
    const [data, setData] = useState([]);
    const [metric, setMetric] = useState('pressure');
    const [aiInsights, setAiInsights] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Filter sensor list for sidebar
    const sidebarSensors = useMemo(() => {
        return filteredSensors.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.location.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = statusFilter === 'all' ||
                (statusFilter === 'critical' && (s.isAnomaly || s.leakScore > 75)) ||
                (statusFilter === 'stable' && !s.isAnomaly && s.leakScore <= 75);
            return matchesSearch && matchesStatus;
        });
    }, [filteredSensors, searchQuery, statusFilter]);

    useEffect(() => {
        setData([]); // Clear data on sensor change
        fetchData();
        const interval = setInterval(fetchData, 2000);
        return () => clearInterval(interval);
    }, [selectedSensor, selectedPipelineId]);

    const fetchData = async () => {
        try {
            if (selectedSensor === 'aggregate' && selectedPipelineId) {
                const res = await axios.get(`http://localhost:5000/api/analytics/pipeline/${selectedPipelineId}`);
                setData([...res.data]);
                setAiInsights(null); // No specific AI predict for pipeline yet
            } else if (selectedSensor !== 'aggregate') {
                const [histRes, predRes] = await Promise.all([
                    axios.get(`http://localhost:5000/api/analytics/${selectedSensor}`),
                    axios.get(`http://localhost:5000/api/ai/predict/${selectedSensor}`).catch(() => ({ data: null }))
                ]);
                setData([...histRes.data]);
                setAiInsights(predRes.data);
            }
        } catch (err) {
            console.error("Analytics sync failed:", err);
        }
    };

    const metrics = [
        { id: 'pressure', label: 'Pressure', unit: 'bar', color: '#3b82f6', threshold: 2 },
        { id: 'flow', label: 'Flow', unit: 'L/s', color: '#8b5cf6', threshold: 10 },
        { id: 'ph', label: 'pH Level', unit: '', color: '#10b981', threshold: 7 },
        { id: 'turbidity', label: 'Turbidity', unit: 'NTU', color: '#f59e0b', threshold: 5 },
        { id: 'tds', label: 'TDS', unit: 'ppm', color: '#ef4444', threshold: 400 },
    ];

    const currentMetric = metrics.find(m => m.id === metric);
    const latestDataPoint = data.length > 0 ? data[data.length - 1] : null;
    const trendInfo = aiInsights?.metrics?.[metric];

    // Compute aggregate KPIs if in aggregate mode
    const getKPIDisplay = (mId) => {
        if (selectedSensor === 'aggregate') {
            const avg = filteredSensors.reduce((acc, s) => acc + (s[mId] || 0), 0) / (filteredSensors.length || 1);
            return avg.toFixed(2);
        }
        const s = sensors.find(s => String(s.id) === String(selectedSensor));
        return s?.[mId]?.toFixed(2) || '0.00';
    };

    const isAnomaly = selectedSensor === 'aggregate'
        ? filteredSensors.some(s => s.isAnomaly || s.leakScore > 75)
        : sensors.find(s => String(s.id) === String(selectedSensor))?.isAnomaly;

    return (
        <div className="space-y-6 animate-in zoom-in-95 duration-500 pb-20">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center space-x-4">
                    <div className="p-3 bg-primary-500/10 rounded-2xl border border-primary-500/20">
                        <Brain className={isAnomaly ? 'text-red-500 animate-pulse' : 'text-primary-500'} size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black dark:text-white uppercase tracking-tighter">
                            {selectedSensor === 'aggregate' ? 'Pipeline Network Analytics' : 'Terminal Deep-Dive Analytics'}
                        </h2>
                        <div className="flex items-center gap-2">
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-[0.2em]">
                                {selectedPipelineId ? `MODE: ${selectedSensor === 'aggregate' ? 'PIPELINE AGGREGATE' : 'INDIVIDUAL NODE'}` : 'REGIONAL INFRASTRUCTURE'}
                            </p>
                            {isAnomaly && (
                                <span className="bg-red-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full animate-bounce uppercase tracking-widest">Anomaly Active</span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex space-x-2">
                    <select
                        value={selectedPipelineId || ''}
                        onChange={(e) => onPipelineChange(e.target.value)}
                        className="bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-xl px-4 py-2.5 text-[10px] font-black dark:text-gray-200 outline-none focus:ring-2 focus:ring-primary-500 shadow-xl"
                    >
                        <option value="">ALL SYSTEMS</option>
                        {pipelines.map(p => <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>)}
                    </select>

                    <select
                        value={selectedSensor}
                        onChange={(e) => setSelectedSensor(e.target.value)}
                        className="bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-xl px-4 py-2.5 text-[10px] font-black dark:text-gray-200 outline-none focus:ring-2 focus:ring-primary-500 shadow-xl"
                    >
                        <option value="aggregate">PIPELINE AGGREGATE (AVG)</option>
                        {filteredSensors.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()} – {s.location.toUpperCase()}</option>)}
                    </select>
                </div>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { id: 'pressure', label: 'Pressure Status', unit: 'bar', icon: Target, color: 'text-blue-500' },
                    { id: 'ph', label: 'pH Stability', unit: '', icon: Droplet, color: 'text-emerald-500' },
                    { id: 'turbidity', label: 'Turbidity Index', unit: 'NTU', icon: Wind, color: 'text-amber-500' },
                    { id: 'tds', label: 'Mineral (TDS)', unit: 'ppm', icon: Activity, color: 'text-red-500' }
                ].map((p, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xl flex items-center gap-5">
                        <div className={`p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-white/5 ${p.color}`}>
                            <p.icon size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{p.label}</p>
                            <p className={`text-xl font-black dark:text-white tracking-tighter ${p.color}`}>{getKPIDisplay(p.id)} {p.unit}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Main Content Pane */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="glass-card p-8 min-h-[500px] flex flex-col relative overflow-hidden border-2 border-gray-100 dark:border-white/5">
                        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 relative z-10">
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
                            <div className="flex items-center space-x-2 bg-emerald-500/10 px-4 py-1.5 rounded-full border border-emerald-500/20 text-[10px] font-black text-emerald-500 uppercase">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse mr-1" />
                                Live Telemetry
                            </div>
                        </div>

                        <div className="flex-1">
                            <ResponsiveContainer width="100%" height={380}>
                                <LineChart data={data}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.05} />
                                    <XAxis dataKey="time" stroke="#9ca3af" tick={{ fontSize: 10, fontWeight: 800 }} axisLine={false} />
                                    <YAxis stroke="#9ca3af" tick={{ fontSize: 10, fontWeight: 800 }} axisLine={false} tickLine={false} />
                                    <Tooltip
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const item = payload[0].payload;
                                                return (
                                                    <div className="bg-gray-900 border border-white/10 p-4 rounded-2xl shadow-2xl backdrop-blur-xl">
                                                        <p className="text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">{item.time}</p>
                                                        <p className="text-lg font-black text-white">{payload[0].value.toFixed(2)} {currentMetric.unit}</p>
                                                        {item.isForecast && <p className="text-[8px] text-amber-500 font-black mt-2">AI PREDICTION</p>}
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <ReferenceLine y={currentMetric.threshold} stroke={currentMetric.color} strokeDasharray="3 3" strokeOpacity={0.5} />
                                    <Line type="monotone" dataKey={metric} stroke={currentMetric.color} strokeWidth={4} dot={{ r: 4, fill: '#fff' }} animationDuration={500} isAnimationActive={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Operational Summary & Explainable AI */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="glass-card p-6 border-l-4 border-indigo-500 relative overflow-hidden h-fit">
                            <h4 className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-4 flex items-center">
                                <Brain size={16} className="mr-2" /> {selectedSensor === 'aggregate' ? 'Pipeline Network Status' : 'AI Analysis (XAI)'}
                            </h4>
                            <div className="space-y-4">
                                {selectedSensor === 'aggregate' ? (
                                    <div className="space-y-3">
                                        <p className="text-xs font-bold text-gray-500 leading-relaxed italic">
                                            Aggregated tracking of {filteredSensors.length} nodes. Overall network stability is being monitored via cross-referenced telemetry.
                                        </p>
                                        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-white/5">
                                            <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Max Deviation Found</p>
                                            <p className="text-lg font-black dark:text-white">
                                                {Math.max(...filteredSensors.map(s => s.leakScore)).toFixed(1)}% <span className="text-[10px] font-bold text-red-500 uppercase">Risk Level</span>
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    aiInsights?.insights?.map((insight, idx) => (
                                        <div key={idx} className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-black dark:text-white uppercase tracking-tighter">{insight.type}</span>
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded ${insight.level === 'High' ? 'bg-red-500/20 text-red-500' : 'bg-amber-500/20 text-amber-500'}`}>
                                                    {insight.level.toUpperCase()}
                                                </span>
                                            </div>
                                            <p className="text-[11px] font-bold text-gray-500 leading-relaxed italic">"{insight.explanation}"</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="glass-card p-6 border-l-4 border-emerald-500 h-fit">
                            <h4 className="text-[11px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-4 flex items-center">
                                <ShieldCheck size={16} className="mr-2" /> Live Analytics Summary
                            </h4>
                            <div className="space-y-3">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Current {currentMetric.label}</p>
                                        <p className="text-4xl font-black dark:text-white tracking-tighter">
                                            {latestDataPoint?.[metric]?.toFixed(2) || '0.00'}<span className="text-sm text-gray-400 ml-1">{currentMetric.unit}</span>
                                        </p>
                                    </div>
                                    <div className={`p-3 rounded-2xl ${latestDataPoint?.[metric] > currentMetric.threshold ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                        {latestDataPoint?.[metric] > currentMetric.threshold ? <AlertTriangle size={24} /> : <CheckCircle size={24} />}
                                    </div>
                                </div>
                                {trendInfo && (
                                    <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-2xl mt-4">
                                        <p className="text-[9px] font-black text-amber-500 uppercase mb-1">AI Prediction (10m)</p>
                                        <p className="text-lg font-black dark:text-white tracking-tighter">~{trendInfo.predicted.toFixed(2)} {currentMetric.unit}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sensor Filter Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="glass-card p-6 border-2 border-gray-100 dark:border-white/5 h-full flex flex-col min-h-[600px]">
                        <div className="flex items-center space-x-3 mb-6">
                            <Filter className="text-primary-500" size={18} />
                            <h4 className="text-xs font-black dark:text-white uppercase tracking-widest">Network Nodes</h4>
                        </div>

                        {/* Search & Filter Controls */}
                        <div className="space-y-3 mb-6">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                <input
                                    type="text"
                                    placeholder="SEARCH TERMINAL..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl py-2 pl-9 pr-4 text-[10px] font-black outline-none focus:ring-2 focus:ring-primary-500 transition-all dark:text-white"
                                />
                            </div>
                            <div className="flex gap-2">
                                {['all', 'critical', 'stable'].map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setStatusFilter(f)}
                                        className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${statusFilter === f ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 border-none' : 'bg-gray-50 dark:bg-gray-800 text-gray-400 border border-gray-100 dark:border-white/5'}`}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Sensor List Scroll Area */}
                        <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar max-h-[500px]">
                            <button
                                onClick={() => setSelectedSensor('aggregate')}
                                className={`w-full p-4 rounded-2xl flex items-center justify-between transition-all border ${selectedSensor === 'aggregate' ? 'bg-primary-500 border-primary-500 shadow-lg scale-[1.02]' : 'bg-gray-50 dark:bg-gray-800/40 border-gray-100 dark:border-white/5 hover:border-primary-500/50'}`}
                            >
                                <div className="text-left">
                                    <p className={`text-[10px] font-black uppercase tracking-widest ml-1 ${selectedSensor === 'aggregate' ? 'text-white/80' : 'text-primary-500'} mb-1`}>Network Mode</p>
                                    <h5 className={`text-xs font-black uppercase tracking-tighter ${selectedSensor === 'aggregate' ? 'text-white' : 'dark:text-white'}`}>Pipeline Aggregate</h5>
                                </div>
                                <ShieldCheck size={18} className={selectedSensor === 'aggregate' ? 'text-white' : 'text-primary-500'} />
                            </button>

                            {sidebarSensors.map(s => {
                                const isCritical = s.isAnomaly || s.leakScore > 75;
                                const isSelected = String(selectedSensor) === String(s.id);
                                return (
                                    <button
                                        key={s.id}
                                        onClick={() => setSelectedSensor(s.id)}
                                        className={`w-full p-4 rounded-2xl border transition-all flex items-center justify-between group ${isSelected
                                            ? 'bg-gray-900 dark:bg-white border-transparent'
                                            : 'bg-white dark:bg-gray-900/40 border-gray-100 dark:border-white/5 hover:border-primary-500/30'
                                            }`}
                                    >
                                        <div className="text-left overflow-hidden">
                                            <div className="flex items-center space-x-2 mb-1">
                                                <div className={`w-1.5 h-1.5 rounded-full ${isCritical ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                                                <p className={`text-[8px] font-black uppercase tracking-widest ${isSelected ? (s.isAnomaly ? 'text-red-300' : 'dark:text-gray-400 text-gray-500') : 'text-gray-400'}`}>Terminal {s.id}</p>
                                            </div>
                                            <h5 className={`text-[11px] font-black uppercase tracking-tighter truncate ${isSelected ? 'dark:text-gray-900 text-white' : 'dark:text-white'}`}>{s.name}</h5>
                                            <p className={`text-[9px] font-bold mt-1 truncate ${isSelected ? 'dark:text-gray-600 text-gray-400' : 'text-gray-500'}`}>{s.location}</p>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <p className={`text-xs font-black ${isSelected ? (isCritical ? 'text-red-400' : 'dark:text-gray-900 text-white') : (isCritical ? 'text-red-500' : 'text-blue-500')}`}>
                                                {s[metric]?.toFixed(1)}{currentMetric.unit}
                                            </p>
                                            <ChevronRight size={14} className={`mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${isSelected ? 'dark:text-gray-900 text-white' : 'text-gray-300'}`} />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Analytics;
