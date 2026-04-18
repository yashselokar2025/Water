import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Brain, AlertTriangle, ShieldCheck, Zap, Activity, Users, ArrowRight, CheckCircle2, Info, ListFilter } from 'lucide-react';

const AIInsights = () => {
    const [priorityList, setPriorityList] = useState([]);
    const [insights, setInsights] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [pRes, iRes] = await Promise.all([
                    axios.get('http://localhost:5000/api/ai/priority-maintenance'),
                    axios.get('http://localhost:5000/api/ai/insights')
                ]);
                setPriorityList(pRes.data);
                setInsights(iRes.data);
            } catch (err) {
                console.error("AI Insight Error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    if (loading) return (
        <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* Layer 6: Executive Support Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-6 rounded-3xl shadow-2xl border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Brain size={80} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center space-x-2 mb-4">
                            <div className="p-2 bg-primary-500/20 rounded-xl text-primary-400">
                                <ShieldCheck size={20} />
                            </div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Executive Decision</span>
                        </div>
                        <h2 className={`text-2xl font-black tracking-tighter mb-2 ${insights?.globalStatus === 'CRITICAL' ? 'text-red-500' :
                                (insights?.globalStatus === 'WARNING' ? 'text-amber-500' : 'text-emerald-500')
                            }`}>
                            {insights?.globalStatus || 'ANALYZING...'}
                        </h2>
                        <p className="text-xs text-gray-400 font-bold leading-relaxed">
                            {insights?.globalStatus === 'CRITICAL' ? 'Immediate tactical intervention required across high-risk segments.' :
                                insights?.globalStatus === 'WARNING' ? 'Preventive maintenance recommended for degrading infrastructure nodes.' :
                                    'Infrastructure operating within target stability parameters.'}
                        </p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800/50 backdrop-blur-xl p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xl flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Risk Stratification</span>
                            <div className="flex items-baseline space-x-2 mt-2">
                                <span className="text-3xl font-black dark:text-white">{insights?.highRiskCount || 0}</span>
                                <span className="text-[10px] font-black text-red-500 uppercase">Critical Nodes</span>
                            </div>
                        </div>
                        <div className="p-3 bg-red-500/10 text-red-500 rounded-2xl">
                            <AlertTriangle size={24} />
                        </div>
                    </div>
                    <div className="mt-4 w-full bg-gray-100 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                        <div
                            className="bg-red-500 h-full transition-all duration-1000"
                            style={{ width: `${Math.min(((insights?.highRiskCount || 0) / 10) * 100, 100)}%` }}
                        ></div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800/50 backdrop-blur-xl p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xl flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">AI Confidence</span>
                            <div className="flex items-baseline space-x-2 mt-2">
                                <span className="text-3xl font-black dark:text-white">94.8%</span>
                                <span className="text-[10px] font-black text-primary-500 uppercase">Decision Accuracy</span>
                            </div>
                        </div>
                        <div className="p-3 bg-primary-500/10 text-primary-500 rounded-2xl">
                            <Zap size={24} />
                        </div>
                    </div>
                    <div className="mt-4 flex items-center space-x-1">
                        {[1, 2, 3, 4, 5].map(i => <div key={i} className="flex-1 h-1.5 rounded-full bg-primary-500"></div>)}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Layer 5: Smart Resource Allocation */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center space-x-3">
                            <ListFilter className="text-primary-500" size={20} />
                            <h3 className="text-sm font-black dark:text-white uppercase tracking-widest">Smart Asset Allocation</h3>
                        </div>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Score Weighted by Impact</span>
                    </div>

                    <div className="space-y-3">
                        {priorityList.map((item, idx) => (
                            <div key={item.id} className="bg-white dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 p-4 rounded-3xl flex items-center justify-between group hover:border-primary-500/30 transition-all hover:shadow-lg">
                                <div className="flex items-center space-x-4">
                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${idx === 0 ? 'bg-red-500 text-white' :
                                            idx === 1 ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                                        }`}>
                                        {idx + 1}
                                    </div>
                                    <div>
                                        <h4 className="font-black text-[13px] dark:text-white uppercase tracking-tighter">{item.name}</h4>
                                        <div className="flex items-center space-x-3 mt-1 text-[9px] font-black uppercase tracking-widest text-gray-400">
                                            <span className="flex items-center"><Users size={10} className="mr-1" /> 12.5k Residents</span>
                                            <span className="flex items-center"><Activity size={10} className="mr-1" /> Critical Infrastructure</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-6">
                                    <div className="text-right">
                                        <div className={`text-xs font-black p-1 px-3 rounded-full ${item.riskLevel === 'High' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                                            }`}>
                                            {item.riskLevel} Risk
                                        </div>
                                        <div className="text-[9px] font-black text-gray-400 mt-1 uppercase tracking-widest">
                                            {item.techRequired} Technicians Advised
                                        </div>
                                    </div>
                                    <button className="p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl hover:bg-primary-500 hover:text-white transition-all">
                                        <ArrowRight size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Layer 4: Prescriptive Recommendations */}
                <div className="space-y-4">
                    <div className="flex items-center space-x-3 px-2">
                        <Brain className="text-primary-500" size={20} />
                        <h3 className="text-sm font-black dark:text-white uppercase tracking-widest">AI Action Queue</h3>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-emerald-500/5 border border-emerald-500/20 p-5 rounded-3xl relative overflow-hidden">
                            <div className="flex items-start space-x-4">
                                <div className="bg-emerald-500/20 p-2 rounded-xl text-emerald-500">
                                    <CheckCircle2 size={18} />
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Optimized Operation</span>
                                    <p className="text-xs font-bold dark:text-gray-200">Adjust Pressure Setpoint to 4.2 bar in Sector G.</p>
                                    <button className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] mt-2 flex items-center hover:translate-x-1 transition-transform">
                                        Auto-Resolve <ArrowRight size={10} className="ml-1" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-amber-500/5 border border-amber-500/20 p-5 rounded-3xl relative overflow-hidden">
                            <div className="flex items-start space-x-4">
                                <div className="bg-amber-500/20 p-2 rounded-xl text-amber-500">
                                    <Info size={18} />
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Prescriptive Maintenance</span>
                                    <p className="text-xs font-bold dark:text-gray-200">Schedule ultrasonic leak test for Node S-102 (Deterioration Trend Detected).</p>
                                    <button className="text-[9px] font-black text-amber-500 uppercase tracking-[0.2em] mt-2 flex items-center hover:translate-x-1 transition-transform">
                                        Dispatch Task <ArrowRight size={10} className="ml-1" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIInsights;
