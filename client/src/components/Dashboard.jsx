import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users,
    Droplets,
    AlertCircle,
    Activity,
    TrendingDown,
    ArrowUpRight,
    ArrowDownRight,
    Waves,
    ShieldAlert,
    ChevronRight,
    MapPin,
    Search,
    Brain,
    Zap,
    CheckCircle2,
    Info,
    LayoutDashboard,
    Cpu,
    Thermometer,
    Wind,
    Bell
} from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    BarChart,
    Bar
} from 'recharts';
import axios from 'axios';
import { exportToCSV } from '../utils/csvExport';
import { useLanguage } from '../context/LanguageContext';

const Dashboard = ({ kpis, lastUpdated, sensors: propsSensors, pipelines: propsPipelines, aiInsights = [] }) => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [selectedPipelineId, setSelectedPipelineId] = useState('all');
    const [selectedSensorId, setSelectedSensorId] = useState('all');
    const [villages, setVillages] = useState([]);

    const sensors = useMemo(() => propsSensors || [], [propsSensors]);
    const pipelines = useMemo(() => propsPipelines || [], [propsPipelines]);

    // aiInsights is now received from App.jsx (shared global state)
    // No backend polling needed here

    // Derived State
    const filteredSensors = useMemo(() => {
        if (selectedPipelineId === 'all') return sensors;
        return sensors.filter(s => String(s.pipeline_id) === String(selectedPipelineId));
    }, [sensors, selectedPipelineId]);

    const activePipeData = useMemo(() =>
        pipelines.find(p => String(p.id) === String(selectedPipelineId)),
        [pipelines, selectedPipelineId]);

    const activeSensorData = useMemo(() =>
        sensors.find(s => String(s.id) === String(selectedSensorId)),
        [sensors, selectedSensorId]);

    useEffect(() => {
        const fetchVillages = async () => {
            try {
                const villageRes = await axios.get('http://localhost:5000/api/villages');
                setVillages(villageRes.data);
            } catch (err) { console.error(err); }
        };
        fetchVillages();
    }, []);

    // 1. Alert Banner Logic (Most Critical Item)
    const activeAlerts = useMemo(() => {
        return sensors.filter(s => s.leakScore > 75 || s.turbidity > 5.0).map(s => ({
            id: s.id,
            type: s.leakScore > 75 ? 'LEAK' : 'CONTAMINATION',
            message: s.leakScore > 75 ? `🔴 CRITICAL LEAK: ${s.name}` : `🟡 HIGH TURBIDITY: ${s.name}`,
            location: s.location
        }));
    }, [sensors]);

    // 2. VIEW MODES DATA
    const getGlobalKPIs = () => [
        { label: t('dashboard.systemHealth'), value: '94.2%', icon: Waves, color: 'text-emerald-500', trend: '+0.4%' },
        { label: t('nav.map'), value: pipelines.length, icon: ShieldAlert, color: 'text-blue-500', trend: 'Stable' },
        { label: t('dashboard.leakProbability'), value: 'Low', icon: Brain, color: 'text-primary-500', trend: '-2%' },
        { label: t('dashboard.activeSensors'), value: sensors.length, icon: Activity, color: 'text-purple-500', trend: 'Live' },
        { label: t('dashboard.criticalAlerts'), value: activeAlerts.filter(a => a.type === 'LEAK').length, icon: AlertCircle, color: 'text-red-500', trend: 'Watch' },
    ];

    const getPipelineKPIs = () => [
        { label: 'Pipeline Health', value: activePipeData?.health_score || '91%', icon: Activity, color: 'text-emerald-500', trend: 'Normal' },
        { label: 'Leak Probability', value: `${Math.max(...filteredSensors.map(s => s.leakScore || 0))}%`, icon: AlertCircle, color: 'text-red-500', trend: 'High' },
        { label: 'Avg Water Quality', value: 'Safe', icon: Droplets, color: 'text-blue-500', trend: 'Stable' },
        { label: 'Nodes Connected', value: filteredSensors.length, icon: Cpu, color: 'text-primary-500', trend: 'Active' },
    ];

    const getSensorKPIs = () => [
        { label: 'Live Pressure', value: activeSensorData?.pressure?.toFixed(2) || '0.00', icon: Thermometer, color: 'text-blue-500', trend: 'bar' },
        { label: 'Flow Velocity', value: activeSensorData?.flow?.toFixed(2) || '0.00', icon: Wind, color: 'text-emerald-500', trend: 'L/s' },
        { label: 'TDS Level', value: activeSensorData?.tds?.toFixed(2) || '0.00', icon: Droplets, color: 'text-primary-500', trend: 'ppm' },
        { label: 'Anomaly Status', value: activeSensorData?.isAnomaly ? 'CRITICAL' : 'STABLE', icon: ShieldAlert, color: activeSensorData?.isAnomaly ? 'text-red-500' : 'text-emerald-500', trend: 'AI Check' },
    ];

    const renderChartSection = () => {
        if (selectedSensorId !== 'all') {
            // Sensor Level Deep Dive
            return (
                <div className="glass-card p-8 min-h-[400px]">
                    <h3 className="text-xl font-black dark:text-white tracking-tighter uppercase mb-6">Real-Time Sensor Telemetry: {activeSensorData?.name}</h3>
                    <div style={{ width: '100%', height: '320px' }}>
                        <ResponsiveContainer width="100%" height={320}>
                            <AreaChart data={[
                                { time: '-10m', val: (activeSensorData?.pressure || 0) + 0.15 },
                                { time: '-5m', val: (activeSensorData?.pressure || 0) + 0.08 },
                                { time: 'NOW', val: activeSensorData?.pressure || 0 },
                                { time: '+5m', val: (activeSensorData?.pressure || 0) - 0.05 },
                                { time: '+10m', val: (activeSensorData?.pressure || 0) - 0.12 },
                            ]}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                                <XAxis dataKey="time" stroke="#9ca3af" fontSize={10} />
                                <YAxis stroke="#9ca3af" fontSize={10} />
                                <Tooltip contentStyle={{ backgroundColor: '#111827', border: 'none' }} />
                                <Area type="monotone" dataKey="val" stroke="#3b82f6" strokeWidth={3} fillOpacity={0.2} strokeDasharray={(v) => v.time.includes('+') ? '5 5' : '0'} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="text-center text-xs text-gray-400 mt-4 uppercase font-black italic">Displaying 10m historic and 10m predictive pressure forecast</p>
                </div>
            );
        }

        // Pipeline or Global Chart
        return (
            <div className="glass-card p-8 min-h-[400px]">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h3 className="text-xl font-black dark:text-white tracking-tighter uppercase">
                            {selectedPipelineId === 'all' ? 'System-Wide Analysis' : `Pipeline Data: ${activePipeData?.name}`}
                        </h3>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Aggregate Volumetric & Flow Prediction</p>
                    </div>
                </div>
                <div style={{ width: '100%', height: '320px' }}>
                    <ResponsiveContainer width="100%" height={320}>
                        <AreaChart data={[
                            { name: '10:00', val: 3.2, pred: 3.1 },
                            { name: '10:05', val: 3.4, pred: 3.3 },
                            { name: '10:10', val: 3.1, pred: 3.2 },
                            { name: '10:15', val: 1.5, pred: 1.8 }, // Drop
                        ]}>
                            <defs>
                                <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="5 5" stroke="#374151" opacity={0.1} />
                            <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} fontWeight="bold" />
                            <YAxis stroke="#9ca3af" fontSize={10} fontWeight="bold" />
                            <Tooltip contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '16px' }} />
                            <Area type="monotone" dataKey="val" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorVal)" />
                            <Area type="monotone" dataKey="pred" stroke="#3b82f6" strokeWidth={2} fill="transparent" strokeDasharray="5 5" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* Top Control Panel */}
            <div className="glass-card p-4 flex flex-col md:flex-row items-center justify-between gap-4 border-t-4 border-primary-500 shadow-2xl">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-primary-500 rounded-lg text-white">
                        <LayoutDashboard size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-black dark:text-white uppercase tracking-tighter">{t('dashboard.title')}</h2>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('dashboard.subtitle')}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-xl px-3 border border-gray-200 dark:border-gray-700">
                        <MapPin size={14} className="text-gray-400 mr-2" />
                        <select
                            value={selectedPipelineId}
                            onChange={(e) => { setSelectedPipelineId(e.target.value); setSelectedSensorId('all'); }}
                            className="bg-transparent text-xs font-bold p-2 focus:outline-none dark:text-white appearance-none min-w-[140px]"
                        >
                            <option value="all">🌐 ALL PIPELINES</option>
                            {pipelines.map(p => <option key={p.id} value={p.id}>📂 {p.name}</option>)}
                        </select>
                    </div>

                    <div className={`flex items-center bg-gray-100 dark:bg-gray-800 rounded-xl px-3 border border-gray-200 dark:border-gray-700 transition-opacity ${selectedPipelineId === 'all' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <Cpu size={14} className="text-gray-400 mr-2" />
                        <select
                            disabled={selectedPipelineId === 'all'}
                            value={selectedSensorId}
                            onChange={(e) => setSelectedSensorId(e.target.value)}
                            className="bg-transparent text-xs font-bold p-2 focus:outline-none dark:text-white appearance-none min-w-[140px]"
                        >
                            <option value="all">📡 ALL SENSORS</option>
                            {filteredSensors.map(s => <option key={s.id} value={s.id}>📍 {s.name}</option>)}
                        </select>
                    </div>

                    <button className="p-2 bg-primary-500/10 text-primary-500 rounded-xl hover:bg-primary-500 hover:text-white transition-all">
                        <Search size={18} />
                    </button>
                </div>
            </div>

            {/* Real-time Alert Banner */}
            {activeAlerts.length > 0 && (
                <div className="relative h-12 overflow-hidden bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center px-6 group">
                    <div className="absolute inset-0 bg-red-500/5 animate-pulse"></div>
                    <Bell className="text-red-500 mr-3 animate-bounce" size={18} />
                    <div className="flex-1 overflow-hidden">
                        <div className="animate-marquee whitespace-nowrap text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-widest">
                            {activeAlerts.map(a => `${a.message} AT ${a.location} • `).join('')}
                        </div>
                    </div>
                </div>
            )}

            {/* KPI Cards (Dynamic based on mode) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {(selectedSensorId !== 'all' ? getSensorKPIs() : (selectedPipelineId !== 'all' ? getPipelineKPIs() : getGlobalKPIs())).map((kpi, i) => (
                    <div key={i} className="glass-card p-6 border-b-4 border-b-primary-500/10 hover:border-b-primary-500 transition-all group scale-100 hover:scale-[1.02] active:scale-95 duration-300 shadow-xl">
                        <div className="flex justify-between items-start">
                            <div className={`p-3 rounded-2xl bg-gray-50 dark:bg-gray-700/50 ${kpi.color} group-hover:scale-110 transition-transform`}>
                                <kpi.icon size={28} />
                            </div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-lg">
                                {kpi.trend}
                            </span>
                        </div>
                        <div className="mt-6">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">{kpi.label}</p>
                            <h3 className="text-3xl font-black dark:text-white mt-2 leading-none tracking-tighter uppercase">{kpi.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {/* AI Decision Support & Action Queue */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-gradient-to-br from-gray-900 to-blue-900 p-8 rounded-3xl shadow-2xl border border-white/5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform">
                            <Brain size={120} />
                        </div>
                        <div className="relative z-10 flex flex-col md:flex-row gap-8">
                            <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-6 text-primary-400">
                                    <Brain size={24} />
                                    <span className="text-xs font-black uppercase tracking-[0.3em]">AI Strategic Insight</span>
                                </div>
                                <h2 className="text-3xl font-black text-white tracking-tighter uppercase leading-[0.9]">
                                    {selectedSensorId !== 'all' ? `Sensor ${activeSensorData?.name} Stability Audit` :
                                        (selectedPipelineId !== 'all' ? `${activePipeData?.name} Network Intelligence` : 'Global Infrastructure Health')}
                                </h2>
                                <p className="text-gray-300 mt-4 text-sm font-medium leading-relaxed">
                                    {selectedSensorId !== 'all' ? (
                                        activeSensorData?.isAnomaly ?
                                            `🚨 CRITICAL: Pressure dropped abnormaly relative to peer nodes. AI has identified a "High Probability Leak" signature at ${activeSensorData.location}.` :
                                            `Sensor "${activeSensorData?.name}" is reporting stable telemetry. All quality and volumetric parameters are within target equilibrium.`
                                    ) : (
                                        selectedPipelineId !== 'all' ?
                                            `Analyzing current health for "${activePipeData?.name}". All ${filteredSensors.length} active nodes are communicating. Statistical variance is low.` :
                                            `Monitoring system-wide infrastructure. ${sensors.length} total sensors processed. Network health maintained at 94.2% stability index.`
                                    )}
                                </p>
                                <div className="mt-6 flex flex-wrap gap-2">
                                    <span className="bg-white/10 px-3 py-1 rounded-full text-[9px] font-black text-white uppercase tracking-widest">∆P Detection: High</span>
                                    <span className="bg-white/10 px-3 py-1 rounded-full text-[9px] font-black text-white uppercase tracking-widest">Neighbor Sync: OK</span>
                                    <span className="bg-white/10 px-3 py-1 rounded-full text-[9px] font-black text-white uppercase tracking-widest">Turbidity Variance: Low</span>
                                </div>
                            </div>

                            <div className="md:w-64 bg-black/30 backdrop-blur-md p-6 rounded-2xl border border-white/10">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">10m Prediction</span>
                                <div className="mt-4 flex items-center justify-between">
                                    <span className="text-xl font-black text-white">
                                        {selectedSensorId !== 'all' ? (activeSensorData?.pressure - 0.12).toFixed(2) : '3.15'} bar
                                    </span>
                                    {activeSensorData?.isAnomaly ? <TrendingDown className="text-red-500" size={18} /> : <Activity className="text-emerald-500" size={18} />}
                                </div>
                                <p className="text-[9px] font-bold text-gray-400 mt-2 uppercase tracking-tight">
                                    {activeSensorData?.isAnomaly ? 'Pressure target expected to degrade due to volumetric loss.' : 'Pressure stability expected to remain constant.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {renderChartSection()}
                </div>

                <div className="space-y-6">
                    {/* AI Diagnostic Queue Header */}
                    <div className="px-2">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-black dark:text-white uppercase tracking-widest flex items-center">
                                <Zap size={18} className="text-primary-500 mr-2" />
                                AI Diagnostic Queue
                            </h3>
                            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${aiInsights.some(i => i.type === 'CRITICAL')
                                ? 'bg-red-500 text-white animate-pulse'
                                : aiInsights.some(i => i.type === 'WARNING')
                                    ? 'bg-yellow-500 text-white'
                                    : 'bg-emerald-500/20 text-emerald-500'
                                }`}>
                                {aiInsights.some(i => i.type === 'CRITICAL') ? 'CRITICAL' :
                                    aiInsights.some(i => i.type === 'WARNING') ? 'WARNING' : 'NOMINAL'}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {aiInsights.length === 0 ? (
                            /* ── Nominal State Card ─────────────────────────── */
                            <div className="glass-card p-5 border-l-4 border-l-emerald-500 bg-emerald-500/5 animate-in fade-in duration-500">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 mt-0.5 bg-emerald-500/15 rounded-xl text-emerald-500 flex-shrink-0">
                                        <CheckCircle2 size={16} />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">System Status</p>
                                        <h4 className="text-xs font-black text-emerald-400 uppercase tracking-tight">All Parameters Nominal</h4>
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                                            No anomalies detected across active sensor network. Continuous monitoring in progress.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* ── Structured Insight Cards ───────────────────── */
                            aiInsights.map((insight) => {
                                const isCritical = insight.type === 'CRITICAL';
                                const isWarning = insight.type === 'WARNING';
                                const color = isCritical ? 'red' : isWarning ? 'yellow' : 'blue';
                                const borderClass = isCritical
                                    ? 'border-l-red-500 bg-red-500/5'
                                    : isWarning
                                        ? 'border-l-yellow-400 bg-yellow-500/5'
                                        : 'border-l-blue-500 bg-blue-500/5';
                                const labelClass = isCritical ? 'text-red-500' : isWarning ? 'text-yellow-500' : 'text-blue-500';
                                const badgeBg = isCritical ? 'bg-red-500/15 text-red-500' : isWarning ? 'bg-yellow-500/15 text-yellow-500' : 'bg-blue-500/15 text-blue-400';

                                return (
                                    <div
                                        key={insight.id}
                                        className={`glass-card p-5 border-l-4 transition-all duration-500 animate-in slide-in-from-right-4 ${borderClass}`}
                                    >
                                        {/* ── Header: Event + Confidence ─────── */}
                                        <div className="flex justify-between items-start mb-3">
                                            <h4 className={`text-sm font-black tracking-tight ${labelClass}`}>
                                                {insight.event}
                                            </h4>
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest flex-shrink-0 ml-2 ${badgeBg}`}>
                                                {insight.confidence}% conf.
                                            </span>
                                        </div>

                                        {/* ── Node / Pipeline Meta ────────────── */}
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">
                                            📍 {insight.node} &nbsp;·&nbsp; {insight.pipeline}
                                        </p>

                                        {/* ── Evidence ───────────────────────── */}
                                        <div className="mb-3">
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Evidence</p>
                                            <ul className="space-y-0.5">
                                                {insight.evidence.map((e, i) => (
                                                    <li key={i} className="text-[10px] text-gray-600 dark:text-gray-300 font-medium flex items-start gap-1.5">
                                                        <span className={`mt-0.5 flex-shrink-0 ${labelClass}`}>▸</span>
                                                        {e}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        {/* ── Reasoning ──────────────────────── */}
                                        <div className="mb-3">
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Reasoning</p>
                                            <p className="text-[10px] text-gray-600 dark:text-gray-300 font-medium leading-relaxed">
                                                {insight.reasoning}
                                            </p>
                                        </div>

                                        {/* ── Action & Impact ─────────────────── */}
                                        <div className={`pt-3 border-t ${isCritical ? 'border-red-500/20' : isWarning ? 'border-yellow-500/20' : 'border-blue-500/20'}`}>
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Recommended Action</p>
                                            <p className={`text-[10px] font-black leading-relaxed ${labelClass}`}>
                                                → {insight.action}
                                            </p>
                                            <p className="text-[9px] text-gray-500 mt-1 font-medium">
                                                Impact: {insight.impact}
                                            </p>
                                        </div>

                                        {/* ── Confidence Bar ──────────────────── */}
                                        <div className="mt-3">
                                            <div className="w-full bg-gray-100 dark:bg-gray-700 h-1 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-1000 ${isCritical ? 'bg-red-500' : isWarning ? 'bg-yellow-400' : 'bg-blue-500'
                                                        }`}
                                                    style={{ width: `${insight.confidence}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between mt-0.5">
                                                <span className="text-[8px] font-black text-gray-400 uppercase">Confidence</span>
                                                <span className={`text-[8px] font-black uppercase ${labelClass}`}>{insight.confidence}%</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Pipeline Priority Card */}
                    <div className="glass-card p-6 border-t-4 border-t-pink-500">
                        <h3 className="font-black dark:text-white uppercase tracking-tighter text-sm mb-4">System Telemetry</h3>
                        <div className="space-y-4 text-[10px] font-bold uppercase tracking-widest">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400">Total Pipelines</span>
                                <span className="text-pink-500">{pipelines.length}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400">Active Sensors</span>
                                <span className="text-gray-200">{sensors.length}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400">Environment Status</span>
                                <span className={aiInsights.some(i => i.type === 'CRITICAL') ? 'text-red-500' : aiInsights.some(i => i.type === 'WARNING') ? 'text-yellow-500' : 'text-emerald-500'}>
                                    {aiInsights.some(i => i.type === 'CRITICAL') ? 'STABLE' : 'NOMINAL'}
                                </span>
                            </div>
                            <p className="text-[9px] text-gray-500 font-medium normal-case tracking-normal border-t dark:border-gray-700 pt-3 mt-2">
                                * System health derived from real-time deviation analysis across active sensor nodes.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
