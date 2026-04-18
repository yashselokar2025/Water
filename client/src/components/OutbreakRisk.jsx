import React, { useState, useEffect } from 'react';
import { ShieldAlert, Info, TrendingUp, Users, Droplet, MessageSquare } from 'lucide-react';
import axios from 'axios';

const OutbreakRisk = () => {
    const [risks, setRisks] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get('http://localhost:5000/api/ai/outbreak-risk');
                setRisks(res.data);
            } catch (err) {
                console.error(err);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    const getRiskColor = (level) => {
        switch (level) {
            case 'Low': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case 'Medium': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
            case 'High': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold dark:text-white">Village-level Outbreak Risk Analysis</h2>
                <div className="text-xs text-gray-500 dark:text-gray-400 max-w-xs text-right">
                    Risk calculated based on water purity, health reports, and community complaints.
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {risks.map((risk) => (
                    <div key={risk.villageId} className="glass-card p-6 flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-8">
                        <div className={`h-24 w-24 rounded-2xl flex items-center justify-center shrink-0 ${risk.level === 'High' ? 'bg-red-500 shadow-lg shadow-red-500/30' : (risk.level === 'Medium' ? 'bg-yellow-500' : 'bg-green-500')}`}>
                            <ShieldAlert size={48} className="text-white" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                                <h3 className="text-xl font-bold dark:text-white">{risk.villageName}</h3>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getRiskColor(risk.level)}`}>
                                    {risk.level} Risk
                                </span>
                            </div>
                            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">{risk.explanation}</p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {[
                                    { label: 'Water Quality', icon: Droplet, color: 'text-blue-500' },
                                    { label: 'Health Cases', icon: Users, color: 'text-purple-500' },
                                    { label: 'Complaints', icon: MessageSquare, color: 'text-orange-500' },
                                ].map((stat, i) => (
                                    <div key={i} className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                                        <stat.icon size={14} className={stat.color} />
                                        <span>{stat.label} Factor</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="text-center md:text-right shrink-0">
                            <div className="text-sm font-medium text-gray-400 mb-1 uppercase tracking-widest">Risk Score</div>
                            <div className="text-5xl font-black text-gray-800 dark:text-white">{risk.riskScore}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-6 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-2xl flex items-start space-x-4">
                <Info className="text-blue-500 shrink-0" size={20} />
                <div>
                    <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-1">AI Calculation Logic</h4>
                    <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                        risk_score = (Water_Quality_Score + Health_Cases_Weight + Complaint_Density) / 3.
                        Scores above 60 trigger automated alerts to regional health offices.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default OutbreakRisk;
