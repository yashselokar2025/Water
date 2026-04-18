import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronLeft,
    ArrowUpRight,
    ArrowDownRight,
    Droplets,
    Activity,
    AlertTriangle,
    ShieldCheck,
    Timer,
    MapPin,
    Navigation,
    Waves
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell
} from 'recharts';
import axios from 'axios';
import { exportToCSV } from '../utils/csvExport';

const PipelineDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [pipeline, setPipeline] = useState(null);
    const [sensors, setSensors] = useState([]);
    const [loading, setLoading] = useState(true);

    const [analytics, setAnalytics] = useState([]);

    const fetchDetail = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/pipelines');
            const pipe = res.data.find(p => String(p.id) === String(id));
            setPipeline(pipe);

            const sensorRes = await axios.get('http://localhost:5000/api/sensors');
            setSensors(sensorRes.data.filter(s => String(s.pipeline_id) === String(id)));

            const analyticsRes = await axios.get(`http://localhost:5000/api/analytics/pipeline/${id}`);
            setAnalytics(analyticsRes.data);

            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetail();
        const interval = setInterval(fetchDetail, 5000);
        return () => clearInterval(interval);
    }, [id]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[600px] animate-pulse">
            <div className="w-12 h-12 bg-primary-500 rounded-full mb-4"></div>
            <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Synchronizing Pipeline Telemetry...</p>
        </div>
    );

    if (!pipeline) return (
        <div className="p-12 text-center glass-card">
            <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
            <h3 className="text-xl font-black dark:text-white uppercase">Pipeline Not Found</h3>
            <button onClick={() => navigate(-1)} className="mt-4 text-primary-500 font-bold uppercase text-xs">Return to Network View</button>
        </div>
    );

    const avgPressure = sensors.length > 0 
        ? (sensors.reduce((acc, s) => acc + s.pressure, 0) / sensors.length).toFixed(1)
        : '0.0';
    
    const maxRisk = sensors.length > 0 
        ? Math.max(...sensors.map(s => s.leakScore || 0))
        : 0;

    const integrityLevel = maxRisk > 70 ? 'Critical' : (maxRisk > 30 ? 'Warning' : 'High');
    const integrityColor = maxRisk > 70 ? 'text-red-500' : (maxRisk > 30 ? 'text-amber-500' : 'text-indigo-500');

    const stats = [
        { label: 'Flow Consistency', value: maxRisk > 50 ? 'Low' : '98.2%', icon: Waves, color: 'text-blue-500' },
        { label: 'Pressure Avg', value: `${avgPressure} bar`, icon: Activity, color: 'text-emerald-500' },
        { label: 'Integrity Index', value: integrityLevel, icon: ShieldCheck, color: integrityColor },
        { label: 'Active Sensors', value: sensors.length, icon: Navigation, color: 'text-primary-500' },
    ];

    const flowData = analytics.length > 0 ? analytics.map(a => ({
        time: a.time,
        flow: a.flow,
        pressure: a.pressure
    })) : [
        { time: 'N/A', flow: 0, pressure: 0 }
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center space-x-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-xl hover:scale-110 transition-transform active:scale-95 border border-gray-100 dark:border-gray-700"
                    >
                        <ChevronLeft size={24} className="dark:text-white" />
                    </button>
                    <div>
                        <div className="flex items-center space-x-3 mb-1">
                            <h2 className="text-3xl font-black dark:text-white tracking-tighter uppercase">{pipeline.name}</h2>
                            <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg border ${
                                maxRisk > 70 ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                                (maxRisk > 30 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20')
                            }`}>
                                {maxRisk > 70 ? 'CRITICAL ALERT' : (maxRisk > 30 ? 'UNSTABLE' : 'OPERATIONAL')}
                            </span>
                        </div>
                        <p className="text-gray-500 font-bold text-sm tracking-widest uppercase">{pipeline.start_location} → {pipeline.end_location}</p>
                    </div>
                </div>
                <div className="flex space-x-3">
                    <button
                        onClick={() => exportToCSV(sensors, `pipeline_${pipeline.name}_analytics_${new Date().toISOString().split('T')[0]}`)}
                        className="bg-emerald-500 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all active:scale-95"
                    >
                        Download Analytics
                    </button>
                    <button onClick={() => navigate('/simulation-hub', { state: { pipelineId: id } })} className="bg-primary-500 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary-500/25 hover:shadow-primary-500/40 transition-all active:scale-95">
                        Add Telemetry Node
                    </button>
                    <button onClick={() => navigate('/map', { state: { focusId: id, type: 'pipeline' } })} className="bg-white dark:bg-gray-800 dark:text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 transition-all active:scale-95">
                        Focus on GIS
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                    <div key={i} className="glass-card p-6 border-b-4 border-b-primary-500/20 transition-all hover:border-b-primary-500">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-2xl bg-gray-50 dark:bg-gray-800 ${stat.color}`}>
                                <stat.icon size={24} />
                            </div>
                            <Timer size={16} className="text-gray-300" />
                        </div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{stat.label}</p>
                        <h3 className="text-2xl font-black dark:text-white mt-1 tracking-tighter">{stat.value}</h3>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Volumetric Performance */}
                <div className="lg:col-span-2 glass-card p-8 min-h-[400px]">
                    <div className="flex justify-between items-center mb-10">
                        <div>
                            <h3 className="text-xl font-black dark:text-white tracking-tighter uppercase">Volumetric Flow Trends</h3>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Real-time throughput analytics (24h period)</p>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                                <span className="w-3 h-3 rounded-full bg-primary-500"></span>
                                <span className="text-[9px] font-black uppercase dark:text-gray-400">Current Flow</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
                                <span className="text-[9px] font-black uppercase dark:text-gray-400">Pressure</span>
                            </div>
                        </div>
                    </div>
                    <div style={{ width: '100%', height: '300px' }}>
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={flowData}>
                                <defs>
                                    <linearGradient id="colorFlow" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.1} />
                                <XAxis dataKey="time" stroke="#9ca3af" fontSize={10} fontWeight="bold" />
                                <YAxis stroke="#9ca3af" fontSize={10} fontWeight="bold" />
                                <Tooltip contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '16px' }} />
                                <Area type="monotone" dataKey="flow" stroke="#0ea5e9" strokeWidth={4} fillOpacity={1} fill="url(#colorFlow)" />
                                <Area type="monotone" dataKey="pressure" stroke="#6366f1" strokeWidth={2} fill="transparent" strokeDasharray="5 5" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Node Health Decomposition */}
                <div className="lg:col-span-1 glass-card p-8">
                    <h3 className="text-xl font-black dark:text-white tracking-tighter uppercase mb-2">Node Efficiency</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-8">Performance metrics by telemetry point</p>

                    <div className="space-y-6">
                        {sensors.map(sensor => (
                            <div key={sensor.id} className="group">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-black text-xs dark:text-gray-200 uppercase tracking-tighter">{sensor.name}</span>
                                    <span className={`text-[10px] font-black ${sensor.leakScore > 70 ? 'text-red-500' : (sensor.leakScore > 30 ? 'text-amber-500' : 'text-primary-500')}`}>
                                        {sensor.leakScore > 70 ? 'LEAK DETECTED' : (sensor.leakScore > 30 ? 'DEVIATION DETECTED' : 'OPTIMAL')}
                                    </span>
                                </div>
                                <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${sensor.leakScore > 70 ? 'bg-red-500' : (sensor.leakScore > 30 ? 'bg-amber-500 animate-pulse' : 'bg-primary-500')}`}
                                        style={{ width: `${Math.max(10, 100 - (sensor.leakScore || 0))}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                        {sensors.length === 0 && (
                            <p className="text-center text-gray-400 text-xs font-bold uppercase py-10">No telemetry nodes active on this segment</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Active Nodes Table */}
            <div className="glass-card overflow-hidden">
                <div className="p-8 border-b dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
                    <h3 className="text-xl font-black dark:text-white tracking-tighter uppercase">Deployed Telemetry Nodes</h3>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-white dark:bg-gray-700 px-3 py-1 rounded-lg">LIVE FEED</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-800/30">
                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Asset Identifier</th>
                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Metric Profile</th>
                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">AI Forecast & Trends</th>
                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Prescriptive Action</th>
                                <th className="p-6 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Executive Decision</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-gray-700">
                            {sensors.map((sensor) => (
                                <tr key={sensor.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-all">
                                    <td className="p-6">
                                        <div className="flex items-center space-x-4">
                                            <div className="p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 group-hover:scale-110 transition-transform">
                                                <Activity size={20} className={sensor.riskLevel === 'High' ? 'text-red-500' : 'text-primary-500'} />
                                            </div>
                                            <div>
                                                <span className="font-black text-sm dark:text-white uppercase tracking-tighter block">{sensor.name}</span>
                                                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{sensor.location}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex space-x-3">
                                            <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-500 rounded-lg text-[10px] font-black border border-blue-100 dark:border-blue-800">
                                                {sensor.pressure?.toFixed(1)} BAR
                                            </span>
                                            <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 rounded-lg text-[10px] font-black border border-indigo-100 dark:border-indigo-800">
                                                {sensor.flow?.toFixed(1)} L/S
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex flex-col space-y-1 max-w-[180px]">
                                            <div className="flex justify-between text-[9px] font-black uppercase text-gray-400">
                                                <span>Diagnosis</span>
                                                <span className={sensor.leakScore > 70 ? 'text-red-500' : 'text-primary-500'}>{sensor.leakScore > 70 ? 'ANOMALY' : 'NORMAL'}</span>
                                            </div>
                                            <p className="text-[10px] font-bold dark:text-gray-300 leading-tight">
                                                {sensor.anomalyReason || 'Sensor environment operating within baseline parameters.'}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex flex-col space-y-2">
                                            <div className="flex items-start space-x-1">
                                                <div className="w-1 h-1 rounded-full bg-primary-500 mt-1.5"></div>
                                                <span className="text-[10px] font-bold dark:text-gray-400 leading-none">
                                                    {sensor.leakScore > 70 ? 'IMMEDIATE SITE INSPECTION' : 'CONTINUE MONITORING'}
                                                </span>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase w-fit ${sensor.riskLevel === 'High' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' :
                                                (sensor.riskLevel === 'Medium' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white')
                                                }`}>
                                                {sensor.riskLevel || 'LOW'} RISK
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-6 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className={`text-[10px] font-black uppercase tracking-widest mb-1 ${sensor.leakScore > 70 ? 'text-red-500 animate-pulse' : 'text-primary-500'
                                                }`}>
                                                {sensor.leakScore > 70 ? 'IMMEDIATE ACTION' : 'STABLE'}
                                            </span>
                                            <button className="text-[8px] font-black text-gray-400 uppercase tracking-[0.2em] hover:text-primary-500 transition-colors">
                                                Execute Action Profile
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PipelineDetail;
