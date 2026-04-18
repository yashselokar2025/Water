import React, { useState, useEffect, useMemo } from 'react';
import {
    Plus,
    RefreshCcw,
    AlertTriangle,
    Droplet,
    Trash2,
    Settings,
    ShieldCheck,
    ChevronDown,
    ChevronUp,
    Database,
    GripVertical,
    Send,
    MousePointer2,
    PenTool,
    Filter,
    Activity,
    Server,
    Layout,
    MapPin
} from 'lucide-react';
import axios from 'axios';
import { exportToCSV } from '../utils/csvExport';
import MapView from './MapView';

const SensorSimulation = ({ sensors, fetchData, initialFilter, onFilterChange }) => {
    const [isAdminOpen, setIsAdminOpen] = useState(false);
    const [drawingMode, setDrawingMode] = useState(null);
    const [pipelines, setPipelines] = useState([]);
    const [selectedPipelineFilter, setSelectedPipelineFilter] = useState(initialFilter || '');
    const [newPipeline, setNewPipeline] = useState({ name: '', start_location: '', end_location: '', coordinates: [] });
    const [newSensor, setNewSensor] = useState({ name: '', location: '', lat: '', lng: '', pipeline_id: '' });

    useEffect(() => {
        if (initialFilter !== undefined) {
            setSelectedPipelineFilter(initialFilter);
        }
    }, [initialFilter]);

    const handleFilterChange = (val) => {
        setSelectedPipelineFilter(val);
        if (onFilterChange) onFilterChange(val);
    };

    useEffect(() => {
        fetchPipelines();
    }, []);

    const fetchPipelines = async () => {
        const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/pipelines`);
        setPipelines(res.data);
    };

    // Filter sensors for the table and map
    const filteredSensors = useMemo(() => {
        if (!selectedPipelineFilter) return sensors;
        return sensors.filter(s => s.pipeline_id === parseInt(selectedPipelineFilter));
    }, [sensors, selectedPipelineFilter]);

    const activePipelineName = useMemo(() => {
        if (!selectedPipelineFilter) return 'All Network Nodes';
        return pipelines.find(p => p.id === parseInt(selectedPipelineFilter))?.name || 'Selected Pipeline';
    }, [selectedPipelineFilter, pipelines]);

    const triggerSimulation = async (type) => {
        try {
            await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/simulate/${type}`);
            fetchData();
        } catch (err) { console.error(err); }
    };

    const resetSystem = async () => {
        try {
            await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/simulate/reset`);
            fetchData();
        } catch (err) { console.error(err); }
    };

    // --- Utility: Dist to Path ---
    const getDistance = (p1, p2) => {
        const R = 6371e3; // metres
        const φ1 = p1.lat * Math.PI / 180;
        const φ2 = p2.lat * Math.PI / 180;
        const Δφ = (p2.lat - p1.lat) * Math.PI / 180;
        const Δλ = (p2.lng - p1.lng) * Math.PI / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const findClosestPointOnCurve = (point, path) => {
        let minDist = Infinity;
        let closestPoint = null;
        for (let i = 0; i < path.length - 1; i++) {
            const p1 = { lat: path[i][0], lng: path[i][1] };
            const p2 = { lat: path[i + 1][0], lng: path[i + 1][1] };
            // Simple interpolation for snapping
            for (let t = 0; t <= 1; t += 0.1) {
                const interp = {
                    lat: p1.lat + (p2.lat - p1.lat) * t,
                    lng: p1.lng + (p2.lng - p1.lng) * t
                };
                const d = getDistance(point, interp);
                if (d < minDist) {
                    minDist = d;
                    closestPoint = interp;
                }
            }
        }
        return { point: closestPoint, distance: minDist };
    };

    const handleAddPipeline = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/pipelines`, newPipeline);
            setNewPipeline({ name: '', start_location: '', end_location: '', coordinates: [] });
            setDrawingMode(null);
            await fetchPipelines();
            // Try to filter to the new pipeline automatically
            const allPipes = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/pipelines`);
            const created = allPipes.data.find(p => p.name === newPipeline.name);
            if (created) handleFilterChange(String(created.id));
        } catch (err) { console.error(err); }
    };

    const handleAddSensor = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/sensors`, newSensor);
            setNewSensor({ name: '', location: '', lat: '', lng: '', pipeline_id: '' });
            setDrawingMode(null);
            fetchData();
        } catch (err) { console.error(err); }
    };

    const onCoordinateSelect = (latlng) => {
        if (drawingMode === 'sensor') {
            if (!newSensor.pipeline_id) {
                alert("Please select a parent pipeline first!");
                return;
            }
            const parent = pipelines.find(p => String(p.id) === String(newSensor.pipeline_id));
            if (!parent) return;

            const path = JSON.parse(parent.coordinates || '[]');
            const snap = findClosestPointOnCurve(latlng, path);

            if (snap.distance > 50) { // 50m threshold
                alert("Placement failed: Sensor must be within 50m of its parent pipeline corridor.");
                return;
            }

            setNewSensor({ ...newSensor, lat: snap.point.lat.toFixed(6), lng: snap.point.lng.toFixed(6) });
            setDrawingMode(null);
        } else if (drawingMode === 'pipeline') {
            setNewPipeline(prev => ({ ...prev, coordinates: [...prev.coordinates, [latlng.lat, latlng.lng]] }));
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500 pb-20">
            {/* Control Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div>
                    <h2 className="text-2xl font-black dark:text-white flex items-center">
                        <Server className="mr-3 text-primary-500" /> Infrastructure Control Center
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 uppercase tracking-widest font-bold text-[10px]">Real-time Network Manipulation & Stress Testing</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button onClick={() => triggerSimulation('leak')} className="bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center shadow-lg transform transition-transform active:scale-95 group">
                        <AlertTriangle size={18} className="mr-2 group-hover:animate-pulse" /> Simulate Leak
                    </button>
                    <button onClick={() => triggerSimulation('contamination')} className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center shadow-lg transform transition-transform active:scale-95 group">
                        <Droplet size={18} className="mr-2 group-hover:animate-bounce" /> Simulate Contamination
                    </button>
                    <button onClick={resetSystem} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center shadow-lg transform transition-transform active:scale-95 group">
                        <ShieldCheck size={18} className="mr-2 group-hover:rotate-12" /> Reset Grid
                    </button>
                </div>
            </div>

            {/* Admin Control Panel */}
            <div className="glass-card overflow-hidden border-2 border-primary-500/10">
                <button
                    onClick={() => setIsAdminOpen(!isAdminOpen)}
                    className="w-full p-4 flex items-center justify-between bg-primary-500/5 hover:bg-primary-500/10 transition-colors"
                >
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-primary-500 rounded-xl text-white shadow-lg shadow-primary-500/20">
                            <Layout size={20} />
                        </div>
                        <div className="text-left">
                            <h3 className="font-bold dark:text-white">Engineering Blueprints</h3>
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Pipeline Drawing & Asset Deployment</p>
                        </div>
                    </div>
                    {isAdminOpen ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
                </button>

                {isAdminOpen && (
                    <div className="p-8 space-y-10 animate-in slide-in-from-top-4 duration-500 bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800">
                        <div className="flex flex-col xl:flex-row gap-8 min-h-[700px]">
                            {/* Map Interaction Column (60% width on XL) */}
                            <div className="xl:w-[65%] rounded-3xl overflow-hidden border-4 border-white dark:border-gray-800 shadow-2xl relative group">
                                <div className="absolute top-4 left-4 z-[1000] pointer-events-none">
                                    <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 flex items-center space-x-3">
                                        <div className={`w-3 h-3 rounded-full ${drawingMode ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                                        <span className="text-[10px] font-black text-white uppercase tracking-widest">
                                            {drawingMode ? `RECORDING: ${drawingMode.toUpperCase()}` : 'SYSTEM READY'}
                                        </span>
                                    </div>
                                </div>
                                <MapView
                                    sensors={sensors}
                                    pipelines={pipelines}
                                    isAdmin={true}
                                    drawingMode={drawingMode}
                                    onCoordinateSelect={onCoordinateSelect}
                                    tempPath={newPipeline.coordinates}
                                    selectedCoord={newSensor.lat ? [newSensor.lat, newSensor.lng] : null}
                                    filterPipelineId={selectedPipelineFilter || newSensor.pipeline_id}
                                />
                            </div>

                            {/* Form Column (40% width on XL) */}
                            <div className="xl:w-[35%] space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                                {/* Add Pipeline Form */}
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                    <form onSubmit={handleAddPipeline} className="space-y-6">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center space-x-3">
                                                <div className="p-2 bg-primary-500/10 rounded-lg text-primary-500">
                                                    <PenTool size={18} />
                                                </div>
                                                <h4 className="font-black dark:text-gray-100 uppercase tracking-tighter text-sm">Route Deployment</h4>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setDrawingMode(drawingMode === 'pipeline' ? null : 'pipeline')}
                                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border-2 ${drawingMode === 'pipeline' ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/30' : 'border-primary-500/20 text-primary-600 hover:bg-primary-50'}`}
                                            >
                                                {drawingMode === 'pipeline' ? 'LOCKING POINTS...' : 'Start Drawing'}
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Pipeline ID</label>
                                                <input required value={newPipeline.name} onChange={e => setNewPipeline({ ...newPipeline, name: e.target.value })} placeholder="e.g. ALPHA-LINE-01" className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl py-3 px-4 text-sm font-bold focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all outline-none dark:text-white" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Origin</label>
                                                    <input required value={newPipeline.start_location} onChange={e => setNewPipeline({ ...newPipeline, start_location: e.target.value })} placeholder="Source" className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl py-3 px-4 text-sm font-bold focus:border-primary-500 transition-all outline-none dark:text-white" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Destination</label>
                                                    <input required value={newPipeline.end_location} onChange={e => setNewPipeline({ ...newPipeline, end_location: e.target.value })} placeholder="Target" className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl py-3 px-4 text-sm font-bold focus:border-primary-500 transition-all outline-none dark:text-white" />
                                                </div>
                                            </div>

                                            <div className="p-4 bg-gray-900 rounded-2xl border border-white/5 flex items-center justify-between group">
                                                <div>
                                                    <p className="text-[9px] font-black text-primary-400 uppercase tracking-[0.2em] mb-1">Telemetry Nodes</p>
                                                    <div className="flex items-center space-x-2">
                                                        <Activity size={14} className="text-white animate-pulse" />
                                                        <span className="text-lg font-mono font-black text-white">{newPipeline.coordinates.length < 10 ? `0${newPipeline.coordinates.length}` : newPipeline.coordinates.length}</span>
                                                    </div>
                                                </div>
                                                <button type="button" onClick={() => setNewPipeline({ ...newPipeline, coordinates: [] })} className="p-3 hover:bg-red-500/20 rounded-xl text-red-500 transition-colors">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>

                                            <button type="submit" disabled={newPipeline.coordinates.length < 2} className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-30 disabled:grayscale text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary-500/25 transform transition-all active:scale-95 flex items-center justify-center">
                                                <Database size={18} className="mr-2" /> Commit Route to DB
                                            </button>
                                        </div>
                                    </form>
                                </div>

                                {/* Add Sensor Form */}
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                    <form onSubmit={handleAddSensor} className="space-y-6">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center space-x-3">
                                                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                                                    <Server size={18} />
                                                </div>
                                                <h4 className="font-black dark:text-gray-100 uppercase tracking-tighter text-sm">IoT Node Deployment</h4>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setDrawingMode(drawingMode === 'sensor' ? null : 'sensor')}
                                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border-2 ${drawingMode === 'sensor' ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/30' : 'border-blue-500/20 text-blue-600 hover:bg-blue-50'}`}
                                            >
                                                {drawingMode === 'sensor' ? 'POSITIONING...' : 'Locate Node'}
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Node Name</label>
                                                    <input required value={newSensor.name} onChange={e => setNewSensor({ ...newSensor, name: e.target.value })} placeholder="e.g. SN-402" className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl py-3 px-4 text-sm font-bold focus:border-blue-500 transition-all outline-none dark:text-white" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Parent Pipeline</label>
                                                    <select required value={newSensor.pipeline_id} onChange={e => setNewSensor({ ...newSensor, pipeline_id: e.target.value })} className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl py-3 px-4 text-xs font-bold focus:border-blue-500 transition-all outline-none dark:text-white appearance-none">
                                                        <option value="">Select Carrier</option>
                                                        {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Operational Area</label>
                                                <input required value={newSensor.location} onChange={e => setNewSensor({ ...newSensor, location: e.target.value })} placeholder="Village / Sector" className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl py-3 px-4 text-sm font-bold focus:border-blue-500 transition-all outline-none dark:text-white" />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border border-gray-100 dark:border-gray-800">
                                                    <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Lat Coordinate</p>
                                                    <code className="text-[11px] font-mono font-black text-blue-500">{newSensor.lat || '00.000000'}</code>
                                                </div>
                                                <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border border-gray-100 dark:border-gray-800">
                                                    <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Lng Coordinate</p>
                                                    <code className="text-[11px] font-mono font-black text-blue-500">{newSensor.lng || '00.000000'}</code>
                                                </div>
                                            </div>

                                            <button type="submit" disabled={!newSensor.lat} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-30 disabled:grayscale text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-500/25 transform transition-all active:scale-95 flex items-center justify-center">
                                                <Send size={18} className="mr-2" /> Initialize Node
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Filter & List Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700">
                <div className="flex items-center">
                    <div className="h-10 w-1 bg-primary-500 rounded-full mr-4"></div>
                    <div>
                        <h4 className="font-black dark:text-white uppercase tracking-tighter">Live Network Nodes</h4>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                            Showing: <span className="text-primary-500 font-black">{activePipelineName}</span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center space-x-4 w-full md:w-auto">
                    <button
                        onClick={() => exportToCSV(filteredSensors, `smartwater_node_inventory_${new Date().toISOString().split('T')[0]}`)}
                        className="text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/10 px-4 py-2 rounded-xl flex items-center hover:bg-blue-500 hover:text-white transition-all border border-blue-500/20"
                    >
                        Export Node Inventory
                    </button>
                    <div className="relative flex-1 md:w-64">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <select
                            value={selectedPipelineFilter}
                            onChange={(e) => handleFilterChange(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl py-3 pl-10 pr-4 text-sm font-bold dark:text-white focus:ring-2 focus:ring-primary-500 transition-all outline-none"
                        >
                            <option value="">All Pipelines</option>
                            {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700">
                        <span className="text-[10px] font-black text-gray-400 uppercase mr-2">Count:</span>
                        <span className="font-black dark:text-white">{filteredSensors.length}</span>
                    </div>
                </div>
            </div>

            {/* Existing Sensors List */}
            <div className="glass-card overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-100/50 dark:bg-gray-700/30">
                        <tr>
                            <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Node Grid</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Regional Data</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Real-Time Ops</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Grid Health</th>
                            <th className="p-4 text-center text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Commands</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredSensors.map((sensor) => (
                            <tr key={sensor.id} className="hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-colors group">
                                <td className="p-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="h-12 w-12 bg-white dark:bg-gray-700 rounded-2xl flex items-center justify-center text-primary-500 shadow-sm border border-gray-100 dark:border-gray-600 group-hover:scale-110 transition-transform">
                                            <Activity size={20} />
                                        </div>
                                        <div>
                                            <span className="font-bold dark:text-white block text-sm">{sensor.name}</span>
                                            <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest">{sensor.pipeline_name || 'Generic Trunk'}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center text-xs font-bold text-gray-500 dark:text-gray-400">
                                        <MapPin size={14} className="mr-2 text-red-400" />
                                        {sensor.location}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex space-x-3">
                                        <div className="bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-xl border border-blue-100 dark:border-blue-800">
                                            <span className="text-[8px] block text-blue-400 font-black uppercase tracking-tighter">Pressure</span>
                                            <span className="font-mono text-xs text-blue-700 dark:text-blue-400 font-bold">{sensor.pressure?.toFixed(1)} bar</span>
                                        </div>
                                        <div className="bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-800">
                                            <span className="text-[8px] block text-emerald-400 font-black uppercase tracking-tighter">Flow</span>
                                            <span className="font-mono text-xs text-emerald-700 dark:text-emerald-400 font-bold">{sensor.flow?.toFixed(1)} L/s</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className={`inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${sensor.status === 'Active' ? 'bg-green-100 text-green-700 border border-green-200' :
                                        sensor.status === 'Warning' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 'bg-red-100 text-red-700 border border-red-200'
                                        }`}>
                                        <div className={`h-1.5 w-1.5 rounded-full mr-2 ${sensor.status === 'Active' ? 'bg-green-500' :
                                            sensor.status === 'Warning' ? 'bg-yellow-500' : 'bg-red-500 shadow-[0_0_8px_red]'
                                            }`}></div>
                                        {sensor.status}
                                    </div>
                                </td>
                                <td className="p-4 text-center">
                                    <div className="flex justify-center space-x-2">
                                        <button className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-all"><RefreshCcw size={18} /></button>
                                        <button className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"><Trash2 size={18} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredSensors.length === 0 && (
                    <div className="p-12 text-center">
                        <div className="h-20 w-20 bg-gray-50 dark:bg-gray-800 rounded-3xl flex items-center justify-center mx-auto mb-4 text-gray-300">
                            <Activity size={40} />
                        </div>
                        <h5 className="font-black dark:text-white uppercase tracking-widest">No nodes detected</h5>
                        <p className="text-xs text-gray-400 mt-1">No infrastructure assets matching this filter profile.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SensorSimulation;
