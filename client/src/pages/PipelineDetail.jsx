import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Activity,
    Droplet,
    Thermometer,
    Wind,
    ChevronLeft,
    AlertTriangle,
    CheckCircle2,
    Server,
    TrendingUp,
    BarChart3
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
    Area
} from 'recharts';

const PipelineDetail = ({ sensors, pipelines }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [history, setHistory] = useState([]);

    const pipeline = useMemo(() => pipelines.find(p => String(p.id) === String(id)), [pipelines, id]);
    const pipelineSensors = useMemo(() => sensors.filter(s => String(s.pipeline_id) === String(id)), [sensors, id]);

    useEffect(() => {
        if (pipelineSensors.length > 0) {
            fetchHistory();
            const interval = setInterval(fetchHistory, 2000);
            return () => clearInterval(interval);
        }
    }, [id, pipelineSensors]);

    const fetchHistory = async () => {
        try {
            // Fetch for the first sensor just as a sample for trends
            const res = await axios.get(`http://localhost:5000/api/analytics/${pipelineSensors[0].id}`);
            setHistory(res.data);
        } catch (err) { console.error(err); }
    };

    const stats = useMemo(() => {
        if (!pipelineSensors.length) return null;
        return {
            avgPressure: pipelineSensors.reduce((acc, s) => acc + s.pressure, 0) / pipelineSensors.length,
            avgFlow: pipelineSensors.reduce((acc, s) => acc + s.flow, 0) / pipelineSensors.length,
            avgTds: pipelineSensors.reduce((acc, s) => acc + s.tds, 0) / pipelineSensors.length,
            avgTurbidity: pipelineSensors.reduce((acc, s) => acc + s.turbidity, 0) / pipelineSensors.length,
            maxLeakRisk: Math.max(...pipelineSensors.map(s => s.leakScore)),
            status: pipelineSensors.some(s => s.status !== 'Safe') ? 'Warning' : 'Safe'
        };
    }, [pipelineSensors]);

    if (!pipeline) return <div className="p-8 text-center">Pipeline not found</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors dark:text-gray-400">
                        <ChevronLeft />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black dark:text-white uppercase tracking-tighter flex items-center">
                            {pipeline.name}
                            <span className={`ml-3 px-3 py-1 rounded-full text-[10px] uppercase font-black tracking-widest ${stats?.status === 'Safe' ? 'bg-green-100 text-green-600 dark:bg-green-900/20' : 'bg-red-100 text-red-600 dark:bg-red-900/20'}`}>
                                {stats?.status || 'Unknown'}
                            </span>
                        </h1>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{pipeline.start_location} → {pipeline.end_location}</p>
                    </div>
                </div>
                <div className="flex space-x-3">
                    <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center space-x-2">
                        <Server size={16} className="text-blue-500" />
                        <span className="text-sm font-black dark:text-gray-300">{pipelineSensors.length} Nodes Online</span>
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Avg Pressure', value: stats?.avgPressure.toFixed(2), unit: 'bar', icon: Wind, color: 'text-blue-500' },
                    { label: 'Avg Flow', value: stats?.avgFlow.toFixed(2), unit: 'L/s', icon: Droplet, color: 'text-indigo-500' },
                    { label: 'Avg TDS', value: stats?.avgTds.toFixed(2), unit: 'ppm', icon: Activity, color: 'text-emerald-500' },
                    { label: 'Leak Risk', value: stats?.maxLeakRisk.toFixed(2), unit: '%', icon: AlertTriangle, color: 'text-amber-500' }
                ].map((s, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden group">
                        <div className={`absolute top-0 left-0 w-1 h-full bg-${s.color.split('-')[1]}-500`}></div>
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{s.label}</p>
                                <h3 className="text-2xl font-black dark:text-white">{s.value} <span className="text-xs font-bold text-gray-400 uppercase">{s.unit}</span></h3>
                            </div>
                            <s.icon className={s.color} size={24} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-[40px] border border-gray-100 dark:border-gray-700 shadow-xl">
                    <div className="flex items-center justify-between mb-8">
                        <h4 className="font-black dark:text-white uppercase tracking-tighter flex items-center">
                            <TrendingUp className="mr-2 text-blue-500" /> Pressure Stability Index
                        </h4>
                    </div>
                    <div className="h-[350px]">
                        <ResponsiveContainer width="100%" height={350} minWidth={0} minHeight={350}>
                            <AreaChart data={[...history]}>
                                <defs>
                                    <linearGradient id="colorPressure" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                <XAxis dataKey="timestamp" hide />
                                <YAxis orientation="right" strokeOpacity={0.5} stroke="#94a3b8" fontSize={10} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)' }}
                                />
                                <Area type="monotone" dataKey="pressure" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorPressure)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-8 rounded-[40px] border border-gray-100 dark:border-gray-700 shadow-xl">
                    <div className="flex items-center justify-between mb-8">
                        <h4 className="font-black dark:text-white uppercase tracking-tighter flex items-center">
                            <BarChart3 className="mr-2 text-emerald-500" /> Quality Analytics (TDS)
                        </h4>
                    </div>
                    <div className="h-[350px]">
                        <ResponsiveContainer width="100%" height={350} minWidth={0} minHeight={350}>
                            <LineChart data={[...history]}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                <XAxis dataKey="timestamp" hide />
                                <YAxis orientation="right" strokeOpacity={0.5} stroke="#94a3b8" fontSize={10} />
                                <Tooltip />
                                <Line type="stepAfter" dataKey="tds" stroke="#10b981" strokeWidth={4} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Sensor List in this Pipeline */}
            <div className="bg-white dark:bg-gray-800 rounded-[40px] border border-gray-100 dark:border-gray-700 overflow-hidden shadow-xl">
                <div className="p-8 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                    <h4 className="font-black dark:text-white uppercase tracking-tighter">Linked IoT Terminals</h4>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-50 dark:border-gray-700">
                                <th className="px-8 py-4">Terminal ID</th>
                                <th className="px-8 py-4">Region</th>
                                <th className="px-8 py-4">Pressure</th>
                                <th className="px-8 py-4">TDS</th>
                                <th className="px-8 py-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                            {pipelineSensors.map(s => (
                                <tr key={s.id} className="group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="px-8 py-4 font-black dark:text-gray-200">{s.name}</td>
                                    <td className="px-8 py-4 text-sm text-gray-500">{s.location}</td>
                                    <td className="px-8 py-4 font-mono text-xs">{s.pressure.toFixed(2)} bar</td>
                                    <td className="px-8 py-4 font-mono text-xs">{s.tds?.toFixed(2)} ppm</td>
                                    <td className="px-8 py-4">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${s.status === 'Safe' ? 'text-green-500 bg-green-500/10' : 'text-red-500 bg-red-500/10'}`}>
                                            {s.status}
                                        </span>
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
