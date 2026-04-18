import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
    Activity,
    AlertTriangle,
    Beaker,
    ChevronDown,
    ChevronUp,
    Database,
    Droplet,
    FlaskConical,
    Gauge,
    Layout,
    Layers,
    MapPin,
    MousePointer2,
    PenTool,
    RefreshCcw,
    RotateCcw,
    Save,
    Send,
    Server,
    Settings,
    ShieldCheck,
    Target,
    Thermometer,
    Trash2,
    Zap,
    X,
    Plus,
    Filter,
    ArrowRight
} from 'lucide-react';
import MapView from './MapView';
import { useLanguage } from '../context/LanguageContext';

const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`;

const SimulationHub = ({ sensors, fetchData }) => {
    const { t } = useLanguage();
    const [pipelines, setPipelines] = useState([]);
    const [activeTab, setActiveTab] = useState('infrastructure');
    const [drawingMode, setDrawingMode] = useState(null);
    const [targetPipeline, setTargetPipeline] = useState('');
    const [targetSensor, setTargetSensor] = useState('');

    // Form States
    const [newPipeline, setNewPipeline] = useState({ name: '', start_location: '', end_location: '', coordinates: [] });
    const [newSensor, setNewSensor] = useState({ name: '', location: '', lat: '', lng: '', pipeline_id: '' });
    const [manualValues, setManualValues] = useState({ pressure: '', flow: '', ph: '', turbidity: '', tds: '' });

    // UI States
    const [status, setStatus] = useState({ type: '', text: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(null);

    useEffect(() => {
        fetchPipelines();
    }, []);

    const fetchPipelines = async () => {
        try {
            const res = await axios.get(`${API_BASE}/pipelines`);
            setPipelines(res.data);
        } catch (err) { console.error("Metadata fetch failed"); }
    };

    const showStatus = (type, text) => {
        setStatus({ type, text });
        setTimeout(() => setStatus({ type: '', text: '' }), 4000);
    };

    // --- Infrastructure Handlers ---
    const handleAddPipeline = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_BASE}/pipelines`, newPipeline);
            setNewPipeline({ name: '', start_location: '', end_location: '', coordinates: [] });
            setDrawingMode(null);
            fetchPipelines();
            showStatus('success', 'Pipeline Segment Deployed');
        } catch (err) { showStatus('error', 'Deployment Failed'); }
    };

    const handleAddSensor = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_BASE}/sensors`, newSensor);
            setNewSensor({ name: '', location: '', lat: '', lng: '', pipeline_id: '' });
            setDrawingMode(null);
            fetchData();
            showStatus('success', 'IoT Node Initialized');
        } catch (err) { showStatus('error', 'Node Initialization Failed'); }
    };

    const handleDeletePipeline = async (id) => {
        if (!window.confirm("CRITICAL ACTION: This will decommission the pipeline and all associated sensors, readings, and overrides. Proceed?")) return;
        setIsLoading(true);
        try {
            await axios.delete(`${API_BASE}/pipelines/${id}`);
            fetchPipelines();
            fetchData();
            if (targetPipeline === String(id)) setTargetPipeline('');
            showStatus('success', 'Infrastructure segment decommissioned');
        } catch (err) { showStatus('error', 'Cleanup failed'); }
        finally { setIsLoading(false); }
    };

    const [simulationIntensity, setSimulationIntensity] = useState('high');

    // --- Simulation Handlers ---
    const handleScenario = async (type) => {
        setIsLoading(true);
        try {
            const endpoint = type === 'leak' ? '/testing/simulate-leak' : '/testing/simulate-contamination';
            await axios.post(`${API_BASE}${endpoint}`, {
                pipelineId: targetPipeline,
                sensorId: targetSensor,
                intensity: simulationIntensity
            });
            showStatus('success', `${type.toUpperCase()} scenario (${simulationIntensity.toUpperCase()}) injected`);
            fetchData();
        } catch (err) { showStatus('error', `Scenario Injection Failed`); }
        finally { setIsLoading(false); }
    };

    const handleManualOverride = async () => {
        if (!targetSensor) return showStatus('error', 'Manual injection requires a specific sensor target');
        setIsLoading(true);
        try {
            await axios.post(`${API_BASE}/testing/override`, {
                sensorId: targetSensor,
                ...Object.fromEntries(
                    Object.entries(manualValues).filter(([_, v]) => v !== '').map(([k, v]) => [k, parseFloat(v)])
                )
            });
            showStatus('success', 'Telemetry override synchronized');
            fetchData();
        } catch (err) { showStatus('error', 'Synchronization failed'); }
        finally { setIsLoading(false); }
    };

    const handleGlobalReset = async () => {
        setIsLoading(true);
        try {
            await axios.post(`${API_BASE}/testing/reset`, {
                pipelineId: targetPipeline,
                sensorId: targetSensor
            });
            setManualValues({ pressure: '', flow: '', ph: '', turbidity: '', tds: '' });
            showStatus('success', 'Network stability restored');
            fetchData();
        } catch (err) { showStatus('error', 'Reset failed'); }
        finally { setIsLoading(false); }
    };

    const onCoordinateSelect = (latlng) => {
        if (drawingMode === 'pipeline') {
            setNewPipeline(prev => ({ ...prev, coordinates: [...prev.coordinates, [latlng.lat, latlng.lng]] }));
        } else if (drawingMode === 'sensor') {
            if (!newSensor.pipeline_id) return showStatus('error', 'Select parent pipeline first');
            setNewSensor({ ...newSensor, lat: latlng.lat.toFixed(6), lng: latlng.lng.toFixed(6) });
            setDrawingMode(null);
        }
    };

    // Filter calculations
    const filteredSensors = useMemo(() => {
        const pipeId = targetPipeline || newSensor.pipeline_id;
        if (!pipeId) return sensors;
        return sensors.filter(s => String(s.pipeline_id) === String(pipeId));
    }, [sensors, targetPipeline, newSensor.pipeline_id]);

    // Search/Filter States
    const [inventorySearch, setInventorySearch] = useState('');
    const [scenarioSearch, setScenarioSearch] = useState('');

    const InputField = ({ label, name, icon: Icon, unit }) => (
        <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</label>
            <div className="relative group">
                <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary-500 transition-colors" />
                <input
                    type="number"
                    value={manualValues[name]}
                    onChange={(e) => setManualValues({ ...manualValues, [name]: e.target.value })}
                    placeholder={`-`}
                    className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-gray-100 dark:border-white/5 rounded-xl py-2 pl-9 pr-8 text-xs font-bold dark:text-white outline-none focus:border-primary-500/50 transition-all"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-gray-400">{unit}</span>
            </div>
        </div>
    );

    const filteredPipelines = useMemo(() => {
        return pipelines.filter(p =>
            p.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
            p.start_location.toLowerCase().includes(inventorySearch.toLowerCase()) ||
            p.end_location.toLowerCase().includes(inventorySearch.toLowerCase())
        );
    }, [pipelines, inventorySearch]);

    const scenarioPipelines = useMemo(() => {
        return pipelines.filter(p => p.name.toLowerCase().includes(scenarioSearch.toLowerCase()));
    }, [pipelines, scenarioSearch]);

    return (
        <div className="max-w-[1600px] mx-auto h-[calc(100vh-12rem)] flex flex-col space-y-6 animate-in fade-in duration-700">
            {/* Mission Control Header */}
            <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary-500 text-white rounded-2xl shadow-lg shadow-primary-500/20">
                        <Server size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black dark:text-white tracking-tighter uppercase flex items-center gap-3">
                            Infrastructure Simulation Hub
                        </h2>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
                            <p className="text-gray-500 font-bold text-[10px] tracking-widest uppercase">Administrative Command & Blueprint Control</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {status.text && (
                        <div className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest animate-in zoom-in-95 ${status.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                            {status.text}
                        </div>
                    )}
                    <button
                        onClick={handleGlobalReset}
                        className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-500/20 transition-all active:scale-95"
                    >
                        <RotateCcw size={16} />
                        Network Reset
                    </button>
                </div>
            </div>

            <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
                {/* GIS CANVAS - LEFT COLUMN */}
                <div className="flex-[3] bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-xl overflow-hidden relative">
                    <div className="absolute top-6 left-6 z-[1000] flex flex-col gap-3">
                        <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 flex items-center space-x-3">
                            <div className={`w-3 h-3 rounded-full ${drawingMode ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">
                                {drawingMode ? `RECORDING: ${drawingMode.toUpperCase()} PATH` : 'SYSTEM: OPERATIONAL'}
                            </span>
                        </div>
                    </div>

                    <MapView
                        sensors={sensors}
                        pipelines={pipelines}
                        isAdmin={true}
                        drawingMode={drawingMode}
                        tempPath={newPipeline.coordinates}
                        selectedCoord={newSensor.lat ? [newSensor.lat, newSensor.lng] : null}
                        onCoordinateSelect={onCoordinateSelect}
                        filterPipelineId={targetPipeline || newSensor.pipeline_id}
                        onFilterChange={setTargetPipeline}
                    />
                </div>

                {/* CONTROL PANEL - RIGHT COLUMN */}
                <div className="flex-[1.8] flex flex-col gap-6 overflow-hidden min-w-[450px]">
                    {/* Tabs Navigation */}
                    <div className="bg-white dark:bg-gray-800 p-2 rounded-2xl border border-gray-100 dark:border-white/5 flex gap-2">
                        {[
                            { id: 'infrastructure', label: 'Blueprint', icon: PenTool },
                            { id: 'scenarios', label: 'Scenarios', icon: FlaskConical },
                            { id: 'precision', label: 'Precision', icon: Target }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700/50'}`}
                            >
                                <tab.icon size={16} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 bg-white dark:bg-gray-800/40 p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-xl overflow-y-auto custom-scrollbar space-y-8">

                        {/* 1. INFRASTRUCTURE TAB */}
                        {activeTab === 'infrastructure' && (
                            <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                                {/* Add Pipeline */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-black dark:text-white uppercase tracking-widest flex items-center gap-2">
                                            <Layers size={16} className="text-primary-500" /> Segment Deployment
                                        </h3>
                                        <button
                                            onClick={() => setDrawingMode(drawingMode === 'pipeline' ? null : 'pipeline')}
                                            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${drawingMode === 'pipeline' ? 'bg-red-500 text-white' : 'bg-primary-500/10 text-primary-500'}`}
                                        >
                                            {drawingMode === 'pipeline' ? 'LOCKING NODES...' : 'Draw New Route'}
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <input value={newPipeline.name} onChange={e => setNewPipeline({ ...newPipeline, name: e.target.value })} placeholder="Pipeline ID" className="bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-white/5 p-3 rounded-xl text-xs font-bold dark:text-white outline-none" />
                                        <div className="bg-gray-900 px-4 flex items-center justify-between rounded-xl border border-white/5">
                                            <span className="text-[9px] font-black text-primary-400">POINTS: {newPipeline.coordinates.length}</span>
                                            <button onClick={() => setNewPipeline({ ...newPipeline, coordinates: [] })} className="text-red-500 p-1"><X size={12} /></button>
                                        </div>
                                    </div>
                                    <button disabled={newPipeline.coordinates.length < 2 || !newPipeline.name} onClick={handleAddPipeline} className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-30 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                                        <Database size={14} /> Commit Blueprint
                                    </button>
                                </div>

                                <div className="h-px bg-gray-100 dark:bg-white/5"></div>

                                {/* Add Sensor */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-black dark:text-white uppercase tracking-widest flex items-center gap-2">
                                            <Activity size={16} className="text-blue-500" /> IoT Node Initialization
                                        </h3>
                                        <button
                                            onClick={() => setDrawingMode(drawingMode === 'sensor' ? null : 'sensor')}
                                            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${drawingMode === 'sensor' ? 'bg-blue-500 text-white' : 'bg-blue-500/10 text-blue-500'}`}
                                        >
                                            {drawingMode === 'sensor' ? t('common.locating') : t('common.locateOnMap')}
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <input value={newSensor.name} onChange={e => setNewSensor({ ...newSensor, name: e.target.value })} placeholder={t('common.nodeName')} className="bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-white/5 p-3 rounded-xl text-xs font-bold dark:text-white outline-none" />
                                        <select value={newSensor.pipeline_id} onChange={e => setNewSensor({ ...newSensor, pipeline_id: e.target.value })} className="bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-white/5 p-3 rounded-xl text-[10px] font-black dark:text-white outline-none">
                                            <option value="">{t('common.selectParent')}</option>
                                            {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                    <button disabled={!newSensor.lat || !newSensor.name} onClick={handleAddSensor} className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-30 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                                        <Send size={14} /> {t('common.deployNode')}
                                    </button>
                                </div>

                                <div className="h-px bg-gray-100 dark:bg-white/5"></div>

                                {/* Infrastructure List & Deletion */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-black dark:text-white uppercase tracking-widest flex items-center gap-2">
                                            <Database size={16} className="text-gray-400" /> {t('simulation.inventory')}
                                        </h3>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder={t('simulation.search')}
                                                value={inventorySearch}
                                                onChange={(e) => setInventorySearch(e.target.value)}
                                                className="bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-white/5 px-3 py-1 rounded-lg text-[10px] font-bold outline-none focus:border-primary-500/50"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        {filteredPipelines.map(pipe => (
                                            <div key={pipe.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/20 border border-gray-100 dark:border-white/5 rounded-2xl group transition-all hover:border-primary-500/30">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-white dark:bg-gray-700 rounded-lg text-primary-500 border border-gray-100 dark:border-gray-600">
                                                        <Activity size={14} />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black dark:text-white uppercase tracking-tighter">{pipe.name}</p>
                                                        <p className="text-[9px] text-gray-500 font-bold uppercase">{pipe.start_location} → {pipe.end_location}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => setTargetPipeline(String(pipe.id))} className="p-2 text-primary-500 hover:bg-primary-500 hover:text-white rounded-lg transition-colors"><Target size={14} /></button>
                                                    <button onClick={() => handleDeletePipeline(pipe.id)} className="p-2 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors"><Trash2 size={14} /></button>
                                                </div>
                                            </div>
                                        ))}
                                        {filteredPipelines.length === 0 && (
                                            <div className="text-center py-8 text-gray-500 text-[10px] font-black uppercase tracking-widest border-2 border-dashed border-gray-100 dark:border-white/5 rounded-2xl">
                                                No matches found
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 2. SCENARIOS TAB */}
                        {activeTab === 'scenarios' && (
                            <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Target className="text-primary-500" size={18} />
                                            <h3 className="text-xs font-black dark:text-white uppercase tracking-widest">Target Configuration</h3>
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Quick Find..."
                                            value={scenarioSearch}
                                            onChange={(e) => setScenarioSearch(e.target.value)}
                                            className="bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-white/5 px-3 py-1 rounded-lg text-[10px] font-bold outline-none focus:border-primary-500/50"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Infrastructure Focus</label>
                                            <select value={targetPipeline} onChange={e => { setTargetPipeline(e.target.value); setTargetSensor(''); }} className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-gray-100 dark:border-white/5 p-4 rounded-xl text-xs font-bold dark:text-white outline-none cursor-pointer">
                                                <option value="">Global Network</option>
                                                {scenarioPipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Asset Isolation</label>
                                            <select value={targetSensor} onChange={e => setTargetSensor(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-gray-100 dark:border-white/5 p-4 rounded-xl text-xs font-bold dark:text-white outline-none cursor-pointer">
                                                <option value="">All Segment Nodes</option>
                                                {filteredSensors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <Zap className="text-amber-500" size={18} />
                                        <h3 className="text-xs font-black dark:text-white uppercase tracking-widest">Simulation Intensity</h3>
                                    </div>
                                    <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-white/5">
                                        {['low', 'medium', 'high'].map(intensity => (
                                            <button
                                                key={intensity}
                                                onClick={() => setSimulationIntensity(intensity)}
                                                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${simulationIntensity === intensity ? (intensity === 'high' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : intensity === 'medium' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20') : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                                            >
                                                {intensity}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest text-center">
                                        {simulationIntensity === 'high' ? '⚠️ CRITICAL: 60% PRESSURE DROP | TOXIC TURBIDITY' : simulationIntensity === 'medium' ? '⚡ MODERATE: 30% DEVIATION | WARNING LEVELS' : '✅ LOW: SUBTLE FLUCTUATIONS | MINOR ANOMALIES'}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <button onClick={() => handleScenario('leak')} className="bg-red-500/10 hover:bg-red-500 hover:text-white border border-red-500/20 p-8 rounded-[2rem] text-red-500 flex flex-col items-center gap-3 group transition-all shadow-xl hover:shadow-red-500/20">
                                        <Droplet size={40} className="group-hover:scale-110 transition-transform" />
                                        <div className="text-center">
                                            <h4 className="text-lg font-black uppercase tracking-tighter">SIMULATE LEAK</h4>
                                            <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mt-1">Pressure Drop & Flow Surge</p>
                                        </div>
                                    </button>
                                    <button onClick={() => handleScenario('contamination')} className="bg-amber-500/10 hover:bg-amber-500 hover:text-white border border-amber-500/20 p-8 rounded-[1.8rem] text-amber-500 flex flex-col items-center gap-3 group transition-all shadow-xl hover:shadow-amber-500/20">
                                        <FlaskConical size={40} className="group-hover:scale-110 transition-transform" />
                                        <div className="text-center">
                                            <h4 className="text-lg font-black uppercase tracking-tighter">SIMULATE TOXICITY</h4>
                                            <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mt-1">PH / TDS / Turbidity Breach</p>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 3. PRECISION TAB */}
                        {activeTab === 'precision' && (
                            <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-black dark:text-white uppercase tracking-widest flex items-center gap-2">
                                        <Settings className="text-primary-500" size={16} /> Manual Telemetry Injection
                                    </h3>
                                    <button
                                        disabled={!targetSensor}
                                        onClick={handleManualOverride}
                                        className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${targetSensor ? 'bg-primary-500 text-white shadow-lg' : 'bg-gray-100 text-gray-400'}`}
                                    >
                                        <Save size={14} /> Synchronize
                                    </button>
                                </div>

                                {!targetSensor && (
                                    <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex items-center gap-3 text-orange-500 text-[10px] font-black uppercase tracking-widest">
                                        <AlertTriangle size={18} />
                                        Precision injection requires a single node target
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-6">
                                    <InputField label="Pressure" name="pressure" icon={Gauge} unit="BAR" />
                                    <InputField label="Flow Rate" name="flow" icon={Activity} unit="L/S" />
                                    <InputField label="pH Level" name="ph" icon={Thermometer} unit="PH" />
                                    <InputField label="Turbidity" name="turbidity" icon={Droplet} unit="NTU" />
                                    <div className="col-span-2">
                                        <InputField label="TDS Level (Mineral Density)" name="tds" icon={Zap} unit="MG/L" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div >
    );
};

export default SimulationHub;
