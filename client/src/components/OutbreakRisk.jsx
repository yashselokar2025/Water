import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Info, TrendingUp, TrendingDown, Minus, Users, Droplet, MessageSquare, ChevronDown, ChevronUp, BellRing, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#64748b'];

const OutbreakRisk = () => {
    const [risks, setRisks] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const fetchData = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/ai/outbreak-risk`);
            setRisks(res.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    const getRiskColor = (level) => {
        switch (level) {
            case 'Low': return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500';
            case 'Medium': return 'border-amber-500/20 bg-amber-500/10 text-amber-500';
            case 'High': return 'border-red-500/20 bg-red-500/10 text-red-500';
            default: return 'border-gray-500/20 bg-gray-500/10 text-gray-400';
        }
    };

    const getTrendIcon = (trend) => {
        switch (trend) {
            case 'INCREASING': return <TrendingUp size={20} className="text-red-500" />;
            case 'DECREASING': return <TrendingDown size={20} className="text-emerald-500" />;
            default: return <Minus size={20} className="text-gray-400" />;
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary-500"></div>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* Real-time Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-900/50 p-6 rounded-3xl border border-gray-100/10 backdrop-blur-xl">
                <div>
                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none mb-1 flex items-center gap-2">
                        <ShieldAlert className="text-primary-500" size={32} />
                        Outbreak Vector Analytics
                    </h2>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-10">
                        Neural correlation of community complaints to infrastructure health
                    </p>
                </div>
                <div className="px-5 py-2 bg-primary-500/10 border border-primary-500/20 rounded-2xl flex items-center gap-3">
                    <span className="w-2.5 h-2.5 bg-primary-500 rounded-full animate-ping" />
                    <span className="text-[10px] font-black text-primary-500 uppercase tracking-widest">Global Telemetry Hub</span>
                </div>
            </div>

            {/* Critical Alerts Section */}
            {risks.some(r => r.alertTriggered) && (
                <div className="space-y-3">
                    {risks.filter(r => r.alertTriggered).map(r => (
                        <div key={`alert-${r.pipelineId}`} className="bg-red-500/20 border border-red-500/50 backdrop-blur-md p-5 rounded-2xl flex items-center justify-between animate-in slide-in-from-left-4">
                            <div className="flex items-center space-x-4">
                                <div className="p-3 bg-red-500 text-white rounded-xl shadow-lg shadow-red-500/40">
                                    <BellRing size={24} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-white uppercase tracking-widest">Rapid Spike Detected</h4>
                                    <p className="text-xs font-bold text-red-400 uppercase tracking-tighter mt-0.5">{r.pipelineName} Sector Deployment High priority</p>
                                </div>
                            </div>
                            <button onClick={() => navigate(`/pipeline/${r.pipelineId}`)} className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-500/20">
                                Intercept Vector
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Pipeline Analytics Grid */}
            <div className="grid grid-cols-1 gap-5">
                {risks.map((pipeline) => (
                    <div 
                        key={pipeline.pipelineId} 
                        className={`group relative overflow-hidden bg-gray-900/40 backdrop-blur-sm border border-gray-100/10 p-7 rounded-[2.5rem] flex flex-col xl:flex-row items-center justify-between gap-8 transition-all hover:bg-gray-900/60 hover:border-gray-100/20 border-l-[12px] ${
                            pipeline.level === 'High' ? 'border-l-red-500' : (pipeline.level === 'Medium' ? 'border-l-amber-500' : 'border-l-emerald-500')
                        }`}
                        onClick={() => navigate(`/pipeline/${pipeline.pipelineId}`)}
                    >
                        {/* Pipeline Identity */}
                        <div className="flex-1 w-full xl:w-auto">
                            <div className="flex items-center space-x-4 mb-3">
                                <h3 className="text-2xl font-black text-white uppercase tracking-tighter group-hover:text-primary-400 transition-colors uppercase">{pipeline.pipelineName}</h3>
                                <div className={`px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${getRiskColor(pipeline.level)}`}>
                                    {pipeline.level} Risk
                                </div>
                            </div>
                            <div className="flex items-center space-x-3 text-gray-500">
                                {getTrendIcon(pipeline.trend)}
                                <span className="text-[10px] font-black uppercase tracking-widest">{pipeline.trend} Trend Pattern</span>
                            </div>
                        </div>

                        {/* Comparative Analytics */}
                        <div className="flex items-center space-x-12 px-10 border-x border-gray-100/5 w-full xl:w-auto overflow-x-auto justify-between lg:justify-start py-2">
                            <div className="text-center min-w-[110px]">
                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">Current Window</p>
                                <p className="text-4xl font-black text-white">{pipeline.currentCount}</p>
                            </div>
                            <div className="text-center min-w-[110px]">
                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">Previous Block</p>
                                <p className="text-4xl font-black text-gray-600">{pipeline.previousCount}</p>
                            </div>
                            <div className="text-center min-w-[110px]">
                                <p className="text-[9px] font-black text-primary-500/60 uppercase tracking-[0.2em] mb-2">Sector Total</p>
                                <p className="text-4xl font-black text-primary-500/80">{pipeline.totalCount || 0}</p>
                            </div>
                        </div>

                        {/* AI Narrative Section */}
                        <div className="flex-1 max-w-sm w-full xl:w-auto">
                            <div className="bg-black/20 p-5 rounded-3xl border border-white/5 group-hover:border-primary-500/20 transition-all">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Target size={14} className="text-primary-500" />
                                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Primary Vector</span>
                                    </div>
                                    <span className="text-[10px] font-black text-white bg-white/5 px-2 py-0.5 rounded-md uppercase tracking-tighter">
                                        {pipeline.topIssue}
                                    </span>
                                </div>
                                <p className="text-[11px] font-bold text-gray-300 leading-snug">
                                    {pipeline.insight}
                                </p>
                            </div>
                        </div>

                        {/* Score Visualization */}
                        <div className="flex flex-col items-center justify-center w-28 h-28 rounded-[2rem] bg-black/40 border-b-4 border-gray-800 shadow-2xl shrink-0 group-hover:scale-105 transition-all">
                            <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Index Score</span>
                            <span className={`text-4xl font-black ${pipeline.level === 'High' ? 'text-red-500' : (pipeline.level === 'Medium' ? 'text-amber-500' : 'text-emerald-500')}`}>
                                {pipeline.riskScore}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Methodology Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-primary-500/5 p-8 rounded-[3rem] border border-primary-500/10">
                <div className="flex items-center gap-6">
                    <div className="p-4 bg-primary-500 rounded-[1.5rem] shadow-xl shadow-primary-500/30 text-white">
                        <TrendingUp size={28} />
                    </div>
                    <div>
                        <h4 className="text-sm font-black text-white uppercase tracking-widest mb-1">Predictive Trend Engines</h4>
                        <p className="text-[10px] font-bold text-gray-500 leading-relaxed uppercase tracking-widest">
                            Our AI utilizes a cross-validated dual window temporal analysis to differentiate between isolated noise and sustained outbreak patterns.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4 text-gray-500 text-[10px] font-black uppercase tracking-widest border-l border-white/5 pl-8">
                    <div className="space-y-2">
                        <p className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-red-500 rounded-full"/> Acceleration {">"} 30% = Warning</p>
                        <p className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"/> Stabilization {"<"} 5% = Safe</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default OutbreakRisk;
