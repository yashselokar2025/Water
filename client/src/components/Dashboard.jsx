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
    MapPin
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
import axios from 'axios';
import { exportToCSV } from '../utils/csvExport';
import AIInsights from './AIInsights';

const Dashboard = ({ kpis, lastUpdated, sensors: propsSensors, pipelines: propsPipelines }) => {
    const navigate = useNavigate();
    const [villages, setVillages] = useState([]);

    const sensors = useMemo(() => propsSensors || [], [propsSensors]);
    const pipelines = useMemo(() => propsPipelines || [], [propsPipelines]);

    useEffect(() => {
        const fetchVillages = async () => {
            try {
                const villageRes = await axios.get('http://localhost:5000/api/villages');
                setVillages(villageRes.data);
            } catch (err) { console.error(err); }
        };
        fetchVillages();
        const interval = setInterval(fetchVillages, 10000); // Villages change less often
        return () => clearInterval(interval);
    }, []);

    const kpiData = [
        { label: 'Active Sensors', value: kpis.activeSensors || 0, icon: Activity, color: 'text-blue-500', trend: '+2%' },
        { label: 'Unsafe Sources', value: kpis.unsafeSources || 0, icon: Droplets, color: 'text-orange-500', trend: '-1%' },
        { label: 'Leak Alerts', value: kpis.leakAlerts || 0, icon: AlertCircle, color: 'text-red-500', trend: 'Stable' },
        { label: 'Network Health', value: '94%', icon: Waves, color: 'text-emerald-500', trend: '+0.5%' },
        { label: 'Outbreak Risks', value: kpis.outbreakRisks || 0, icon: Users, color: 'text-pink-500', trend: 'Low' },
    ];

    const qualityChartData = useMemo(() => {
        if (!kpis || !kpis.activeSensors) return [
            { name: '00:00', safe: 0, unsafe: 0 },
            { name: '12:00', safe: 0, unsafe: 0 },
            { name: '23:59', safe: 0, unsafe: 0 }
        ];
        return [
            { name: '00:00', safe: parseFloat((kpis.activeSensors * 0.4).toFixed(2)), unsafe: parseFloat((kpis.unsafeSources * 0.2).toFixed(2)) },
            { name: '06:00', safe: parseFloat((kpis.activeSensors * 0.5).toFixed(2)), unsafe: parseFloat((kpis.unsafeSources * 0.4).toFixed(2)) },
            { name: '12:00', safe: parseFloat((kpis.activeSensors * 0.8).toFixed(2)), unsafe: parseFloat((kpis.unsafeSources * 0.6).toFixed(2)) },
            { name: '18:00', safe: parseFloat((kpis.activeSensors * 0.9).toFixed(2)), unsafe: parseFloat((kpis.unsafeSources * 0.3).toFixed(2)) },
            { name: '24:00', safe: parseFloat((kpis.activeSensors * 0.7).toFixed(2)), unsafe: parseFloat((kpis.unsafeSources * 0.5).toFixed(2)) }
        ];
    }, [kpis]);

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-black dark:text-white tracking-tighter uppercase">Regional Mission Control</h2>
                    <p className="text-gray-500 font-bold text-sm tracking-widest mt-1">REAL-TIME INFRASTRUCTURE OVERVIEW</p>
                </div>
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => exportToCSV(sensors, `smartwater_sensors_${new Date().toISOString().split('T')[0]}`)}
                        className="text-[10px] font-black text-primary-500 uppercase tracking-widest bg-primary-500/10 px-4 py-2 rounded-xl flex items-center hover:bg-primary-500 hover:text-white transition-all shadow-lg shadow-primary-500/10"
                    >
                        Export System Report
                    </button>
                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-xl flex items-center">
                        <span className={`h-2 w-2 rounded-full mr-2 ${navigator.onLine ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></span>
                        {navigator.onLine ? 'LIVE FEED SYNC: ' : 'LOCAL CACHE: '} {lastUpdated || 'Initial...'}
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                {kpiData.map((kpi, i) => (
                    <div key={i} className="glass-card p-6 border-b-4 border-b-primary-500/20 hover:border-b-primary-500 transition-all group">
                        <div className="flex justify-between items-start">
                            <div className={`p-3 rounded-2xl bg-gray-50 dark:bg-gray-700/50 ${kpi.color} group-hover:scale-110 transition-transform`}>
                                <kpi.icon size={28} />
                            </div>
                            <span className="text-[10px] font-black text-green-500 uppercase tracking-widest flex items-center bg-green-500/10 px-2 py-1 rounded-lg">
                                {kpi.trend}
                            </span>
                        </div>
                        <div className="mt-6">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{kpi.label}</p>
                            <h3 className="text-3xl font-black dark:text-white mt-1 leading-none tracking-tighter">{kpi.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {/* AI DECISION SUPPORT LAYER (New Integrated Panel) */}
            <div className="pt-4">
                <AIInsights />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Network Critical Segments */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="font-black dark:text-white uppercase tracking-tighter">Infrastructure Segments</h3>
                        <span className="text-[10px] font-black text-primary-500 uppercase tracking-widest">Active Focus</span>
                    </div>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                        {pipelines.map(pipe => (
                            <button
                                key={pipe.id}
                                onClick={() => navigate(`/pipeline/${pipe.id}`)}
                                className="w-full glass-card p-4 flex items-center justify-between hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all border-l-4 border-l-primary-500 group"
                            >
                                <div className="flex items-center space-x-4">
                                    <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-xl group-hover:rotate-12 transition-transform">
                                        <ShieldAlert size={18} className="text-primary-500" />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-black text-sm dark:text-gray-200 uppercase tracking-tighter leading-none">{pipe.name}</p>
                                        <p className="text-[9px] text-gray-400 font-bold uppercase mt-1 tracking-widest">{pipe.location || 'Central Sector'}</p>
                                    </div>
                                </div>
                                <ChevronRight size={16} className="text-gray-300 group-hover:translate-x-1 transition-transform" />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Performance Analytics */}
                <div className="lg:col-span-2 glass-card p-8 min-h-[400px]">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h3 className="text-xl font-black dark:text-white tracking-tighter uppercase">Network Telemetry Analysis</h3>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Aggregate Volumetric & Quality Flow</p>
                        </div>
                        <div className="flex space-x-2">
                            <span className="h-3 w-3 rounded-full bg-emerald-500"></span>
                            <span className="h-3 w-3 rounded-full bg-primary-500"></span>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={320} minWidth={0} minHeight={320}>
                        <AreaChart data={[...qualityChartData]}>
                            <defs>
                                <linearGradient id="colorSafe" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="#374151" opacity={0.1} />
                            <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} fontWeight="bold" />
                            <YAxis stroke="#9ca3af" fontSize={10} fontWeight="bold" />
                            <Tooltip contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '16px' }} />
                            <Area type="monotone" dataKey="safe" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorSafe)" />
                            <Area type="monotone" dataKey="unsafe" stroke="#ef4444" strokeWidth={4} fill="transparent" strokeDasharray="10 10" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Smart Risk Matrix */}
            <div className="glass-card overflow-hidden">
                <div className="p-8 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                    <div>
                        <h3 className="text-xl font-black dark:text-white tracking-tighter uppercase">Village Risk Matrix</h3>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Population-Weighted Vulnerability Indices</p>
                    </div>
                    <button className="text-[10px] font-black text-primary-500 uppercase tracking-widest bg-primary-500/10 px-4 py-2 rounded-xl">Recalculate Indices</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-800/30">
                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Geographic Sector</th>
                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Water Integrity</th>
                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Outbreak Probability</th>
                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Vulnerability Score</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-gray-700">
                            {villages.map((village) => (
                                <tr key={village.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-all cursor-crosshair">
                                    <td className="p-6">
                                        <div className="flex items-center space-x-3">
                                            <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg"><MapPin size={14} className="text-gray-400" /></div>
                                            <span className="font-black text-sm dark:text-gray-200 uppercase tracking-tighter">{village.name}</span>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center space-x-4">
                                            <div className="flex-1 bg-gray-100 dark:bg-gray-700 h-2 rounded-full overflow-hidden max-w-[100px]">
                                                <div className={`h-full rounded-full ${village.water_quality === 'Good' ? 'bg-green-500 w-full' : (village.water_quality === 'Fair' ? 'bg-amber-500 w-2/3' : 'bg-red-500 w-1/3')}`}></div>
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest">{village.water_quality}</span>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${village.risk_level === 'Low' ? 'bg-green-100 text-green-600' : (village.risk_level === 'Medium' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600')}`}>
                                            {village.risk_level} Risk
                                        </span>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center space-x-3">
                                            <span className="font-black text-lg dark:text-white">{village.status_score || '92'}%</span>
                                            <div className="flex h-1 w-8 bg-gray-100 dark:bg-gray-700 rounded-full">
                                                <div className="h-full bg-primary-500 w-4/5 rounded-full"></div>
                                            </div>
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

export default Dashboard;
