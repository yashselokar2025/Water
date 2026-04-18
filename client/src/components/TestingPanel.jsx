import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Beaker,
    Droplets,
    Zap,
    Settings,
    RefreshCw,
    AlertTriangle,
    Activity,
    FlaskConical,
    Save,
    RotateCcw,
    Layers,
    Target,
    Gauge,
    Thermometer
} from 'lucide-react';

const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`;

const TestingPanel = () => {
    const [pipelines, setPipelines] = useState([]);
    const [sensors, setSensors] = useState([]);
    const [targetPipeline, setTargetPipeline] = useState('');
    const [targetSensor, setTargetSensor] = useState('');
    const [manualValues, setManualValues] = useState({
        pressure: '',
        flow: '',
        ph: '',
        turbidity: '',
        tds: ''
    });
    const [status, setStatus] = useState({ type: '', text: '' });
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        fetchMetadata();
    }, []);

    const fetchMetadata = async () => {
        try {
            const [pRes, sRes] = await Promise.all([
                axios.get(`${API_BASE}/pipelines`),
                axios.get(`${API_BASE}/sensors`)
            ]);
            setPipelines(pRes.data);
            setSensors(sRes.data);
        } catch (err) {
            console.error("Failed to load metadata");
        }
    };

    const filteredSensors = targetPipeline
        ? sensors.filter(s => s.pipeline_id === parseInt(targetPipeline))
        : sensors;

    const showStatus = (type, text) => {
        setStatus({ type, text });
        setTimeout(() => setStatus({ type: '', text: '' }), 3000);
    };

    const handleSimulate = async (type) => {
        setIsLoading(true);
        try {
            const endpoint = type === 'leak' ? '/testing/simulate-leak' : '/testing/simulate-contamination';
            await axios.post(`${API_BASE}${endpoint}`, {
                pipelineId: targetPipeline,
                sensorId: targetSensor
            });
            showStatus('success', `${type.toUpperCase()} simulation active`);
        } catch (err) {
            showStatus('error', `Failed to trigger ${type}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleManualOverride = async () => {
        if (!targetSensor) return showStatus('error', 'Select a specific sensor for manual override');
        setIsLoading(true);
        try {
            await axios.post(`${API_BASE}/testing/override`, {
                sensorId: targetSensor,
                ...Object.fromEntries(
                    Object.entries(manualValues).filter(([_, v]) => v !== '').map(([k, v]) => [k, parseFloat(v)])
                )
            });
            showStatus('success', 'Manual values injected');
        } catch (err) {
            showStatus('error', 'Override failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleReset = async () => {
        setIsLoading(true);
        try {
            await axios.post(`${API_BASE}/testing/reset`, {
                pipelineId: targetPipeline,
                sensorId: targetSensor
            });
            setManualValues({ pressure: '', flow: '', ph: '', turbidity: '', tds: '' });
            showStatus('success', 'System restored to normal');
        } catch (err) {
            showStatus('error', 'Reset failed');
        } finally {
            setIsLoading(false);
        }
    };

    const InputField = ({ label, name, icon: Icon, unit }) => (
        <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{label}</label>
            <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors">
                    <Icon size={14} />
                </div>
                <input
                    type="number"
                    value={manualValues[name]}
                    onChange={(e) => setManualValues({ ...manualValues, [name]: e.target.value })}
                    placeholder={`Enter ${label}`}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-white/5 rounded-2xl py-3 pl-10 pr-12 text-sm font-bold dark:text-white outline-none focus:border-primary-500/50 focus:ring-4 focus:ring-primary-500/10 transition-all"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-gray-400">{unit}</span>
            </div>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black dark:text-white tracking-tighter uppercase flex items-center gap-3">
                        <Beaker className="text-primary-500" />
                        Infrastructure Scenario Simulator
                    </h2>
                    <p className="text-gray-500 font-bold text-sm tracking-widest uppercase mt-1">Controlled Environment for AI Validation</p>
                </div>
                {status.text && (
                    <div className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest animate-in zoom-in-95 ${status.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                        {status.text}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 1. Target Selection */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-gray-900/40 p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-xl">
                        <div className="flex items-center gap-3 mb-8">
                            <Target className="text-primary-500" size={20} />
                            <h3 className="text-sm font-black dark:text-white uppercase tracking-widest">Target Selection</h3>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Pipeline Target</label>
                                <select
                                    value={targetPipeline}
                                    onChange={(e) => { setTargetPipeline(e.target.value); setTargetSensor(''); }}
                                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-white/5 rounded-2xl p-4 text-sm font-bold dark:text-white outline-none focus:ring-4 focus:ring-primary-500/10 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="">Global (All Assets)</option>
                                    {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Specific Sensor (Optional)</label>
                                <select
                                    value={targetSensor}
                                    onChange={(e) => setTargetSensor(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-white/5 rounded-2xl p-4 text-sm font-bold dark:text-white outline-none focus:ring-4 focus:ring-primary-500/10 transition-all appearance-none cursor-pointer"
                                    disabled={!targetPipeline && filteredSensors.length > 10}
                                >
                                    <option value="">Full Pipeline Branch</option>
                                    {filteredSensors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleReset}
                        disabled={isLoading}
                        className="w-full bg-white dark:bg-gray-900/40 py-6 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-xl flex items-center justify-center gap-3 text-red-500 hover:bg-red-500 hover:text-white transition-all group font-black uppercase tracking-widest text-xs"
                    >
                        <RotateCcw size={16} className="group-hover:rotate-180 transition-transform duration-500" />
                        Reset All Infrastructure
                    </button>
                </div>

                {/* 2. Simulation & Overrides */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Macro Triggers */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <button
                            onClick={() => handleSimulate('leak')}
                            className="bg-red-500/10 hover:bg-red-500 hover:text-white transition-all border border-red-500/20 p-8 rounded-[2.5rem] text-red-500 flex flex-col items-center gap-4 group"
                        >
                            <Droplets size={40} className="group-hover:scale-110 transition-transform" />
                            <div className="text-center">
                                <span className="text-xs font-black uppercase tracking-widest block">Event Trigger</span>
                                <h4 className="text-2xl font-black tracking-tighter uppercase">Simulate Leak</h4>
                            </div>
                        </button>

                        <button
                            onClick={() => handleSimulate('contamination')}
                            className="bg-amber-500/10 hover:bg-amber-500 hover:text-white transition-all border border-amber-500/20 p-8 rounded-[2.5rem] text-amber-500 flex flex-col items-center gap-4 group"
                        >
                            <FlaskConical size={40} className="group-hover:scale-110 transition-transform" />
                            <div className="text-center">
                                <span className="text-xs font-black uppercase tracking-widest block">Event Trigger</span>
                                <h4 className="text-2xl font-black tracking-tighter uppercase">Contamination</h4>
                            </div>
                        </button>
                    </div>

                    {/* Manual Override Grid */}
                    <div className="bg-white dark:bg-gray-900/40 p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-xl">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <Settings className="text-primary-500" size={20} />
                                <h3 className="text-sm font-black dark:text-white uppercase tracking-widest">Manual Telemetry Injection</h3>
                            </div>
                            <button
                                onClick={handleManualOverride}
                                disabled={isLoading || !targetSensor}
                                className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${targetSensor ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30 hover:scale-105' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                            >
                                <Save size={14} />
                                Inject Values
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <InputField label="Pressure" name="pressure" icon={Gauge} unit="BAR" />
                            <InputField label="Flow Rate" name="flow" icon={Activity} unit="L/S" />
                            <InputField label="pH Level" name="ph" icon={Thermometer} unit="PH" />
                            <InputField label="Turbidity" name="turbidity" icon={Droplets} unit="NTU" />
                            <InputField label="TDS Level" name="tds" icon={Zap} unit="MG/L" />
                        </div>

                        {!targetSensor && (
                            <div className="mt-8 flex items-center gap-3 p-4 bg-primary-500/5 rounded-2xl border border-primary-500/10 text-[10px] font-black text-primary-500 uppercase tracking-widest">
                                <Info size={14} />
                                Manual injection requires a specific sensor target
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const Info = ({ size }) => <RefreshCw size={size} />; // Fallback

export default TestingPanel;
