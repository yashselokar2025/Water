import React, { useState, useEffect } from 'react';
import { MessageSquare, MapPin, Flag, Send, Info, CheckCircle, TrendingUp, ShieldCheck, AlertTriangle, ChevronDown, ChevronUp, User, Crosshair, Thermometer, Activity, Camera, Image as ImageIcon, X } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import useOffline from '../hooks/useOffline';

// Leaflet icon fix
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const MapEvents = ({ onMapClick }) => {
    useMapEvents({
        click(e) {
            onMapClick(e.latlng);
        },
    });
    return null;
};

const ChangeView = ({ center }) => {
    const map = useMap();
    useEffect(() => {
        if (center) map.setView(center, map.getZoom());
    }, [center, map]);
    return null;
};

const Complaints = ({ pipelines = [], isAdmin = false, user = {} }) => {
    // --- CITIZEN STATE ---
    const [formData, setFormData] = useState({
        pipeline_id: '',
        type: 'Leakage',
        description: '',
        location: '',
        priority: 'Low',
        lat: null,
        lng: null,
        symptoms: [],
        image: null
    });
    const [submitted, setSubmitted] = useState(false);
    const [mapCenter, setMapCenter] = useState([12.9716, 77.5946]);
    
    // --- OFFLINE STATE ---
    const { isOnline, bufferComplaint } = useOffline();
    const [isOfflineStored, setIsOfflineStored] = useState(false);

    const [complaints, setComplaints] = useState([]);
    const [expandedPipeline, setExpandedPipeline] = useState(null);

    const fetchComplaints = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/complaint/all');
            setComplaints(res.data);
        } catch (err) {
            console.error("Error fetching complaints:", err);
        }
    };

    // --- ADMIN AUTO-POLLING ---
    useEffect(() => {
        if (!isAdmin) return;
        
        fetchComplaints();
        const interval = setInterval(fetchComplaints, 3000);
        return () => clearInterval(interval);
    }, [isAdmin]);

    const handleResolve = async (id) => {
        console.log("Attempting to resolve complaint:", id);
        try {
            const res = await axios.put(`http://localhost:5000/api/complaint/status/${id}`, { status: 'Resolved' });
            console.log("Resolve response:", res.data);
            if (res.data.success) {
                fetchComplaints(); // Immediate refresh
            } else {
                alert("Failed to resolve: " + JSON.stringify(res.data));
            }
        } catch (err) {
            console.error("Error resolving complaint:", err);
            alert("Network error while resolving. Check if server is running on port 5000.");
        }
    };

    const handleDelete = async (id) => {
        console.log("Attempting to delete complaint:", id);
        if (!window.confirm("Are you sure you want to permanently delete this complaint?")) return;
        try {
            const res = await axios.delete(`http://localhost:5000/api/complaint/${id}`);
            console.log("Delete response:", res.data);
            if (res.data.success) {
                fetchComplaints(); // Immediate refresh
            } else {
                alert("Failed to delete: " + JSON.stringify(res.data));
            }
        } catch (err) {
            console.error("Error deleting complaint:", err);
            alert("Network error while deleting. Check if server is running on port 5000.");
        }
    };

    // --- CITIZEN SUBMIT ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.pipeline_id) {
            alert("Please select an affected pipeline via the map or dropdown.");
            return;
        }

        const payload = {
            ...formData,
            user_id: user?.id || 1
        };

        try {
            if (isOnline) {
                await axios.post('http://localhost:5000/api/complaint/add', payload);
                setSubmitted(true);
                setTimeout(() => setSubmitted(false), 3000);
            } else {
                bufferComplaint(payload);
                setIsOfflineStored(true);
                setTimeout(() => setIsOfflineStored(false), 3000);
            }
            setFormData({ pipeline_id: '', type: 'Leakage', description: '', location: '', priority: 'Low', lat: null, lng: null, symptoms: [], image: null });
        } catch (err) {
            console.error(err);
            bufferComplaint(payload);
            setIsOfflineStored(true);
            setTimeout(() => setIsOfflineStored(false), 3000);
            setFormData({ pipeline_id: '', type: 'Leakage', description: '', location: '', priority: 'Low', lat: null, lng: null, symptoms: [], image: null });
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, image: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const toggleSymptom = (symptom) => {
        setFormData(prev => ({
            ...prev,
            symptoms: prev.symptoms.includes(symptom)
                ? prev.symptoms.filter(s => s !== symptom)
                : [...prev.symptoms, symptom]
        }));
    };

    const handleMapClick = (latlng) => {
        setFormData(prev => ({
            ...prev,
            lat: latlng.lat,
            lng: latlng.lng,
            location: `Pinpointed: ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`
        }));
    };

    const handlePipelineMapClick = (pId) => {
        setFormData(prev => ({ ...prev, pipeline_id: pId }));
    };

    const detectLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                const { latitude, longitude } = position.coords;
                setMapCenter([latitude, longitude]);
                setFormData(prev => ({
                    ...prev,
                    lat: latitude,
                    lng: longitude,
                    location: `Detected: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
                }));
            });
        }
    };

    // --- RENDER ADMIN VIEW ---
    if (isAdmin) {
        const grouped = complaints.reduce((acc, curr) => {
            // Only count non-resolved in the primary aggregated count, but keep in list
            const pid = curr.pipeline_id || 'unknown';
            const pName = curr.pipeline_name || `Pipeline ${pid}`;
            
            if (!acc[pid]) {
                acc[pid] = { name: pName, list: [], count: 0, byType: {} };
            }
            acc[pid].list.push(curr);
            if (curr.status !== 'Resolved') {
                acc[pid].count++;
                acc[pid].byType[curr.type] = (acc[pid].byType[curr.type] || 0) + 1;
            }
            return acc;
        }, {});

        const pipelineGroups = Object.keys(grouped).map(k => ({ pid: k, ...grouped[k] })).sort((a,b) => b.count - a.count);

        return (
            <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-500">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-black dark:text-white tracking-tight flex items-center gap-2">
                            <ShieldCheck size={28} className="text-primary-500" />
                            Government Complaint Hub
                        </h2>
                        <p className="text-gray-500 mt-2 font-bold uppercase tracking-widest text-xs">Live real-time public feedback aggregator</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    {pipelineGroups.map(group => {
                        const isHighPriority = group.count > 3;
                        const isExpanded = expandedPipeline === group.pid;

                        return (
                            <div key={group.pid} className={`glass-card p-0 overflow-hidden transition-all ${isHighPriority ? 'border-red-500 shadow-xl shadow-red-500/10' : ''}`}>
                                <div 
                                    className="p-6 flex flex-col md:flex-row items-center justify-between cursor-pointer"
                                    onClick={() => setExpandedPipeline(isExpanded ? null : group.pid)}
                                >
                                    <div className="flex items-center gap-6">
                                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl ${isHighPriority ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'}`}>
                                            {group.count}
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black dark:text-white uppercase">{group.name}</h3>
                                            <div className="flex gap-2 mt-2 flex-wrap">
                                                {Object.keys(group.byType).map(type => (
                                                    <span key={type} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-md text-[10px] font-black uppercase flex items-center gap-1">
                                                        {type}: <span className="text-primary-500">{group.byType[type]}</span>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 mt-4 md:mt-0">
                                        <div className="text-gray-400 hover:text-primary-500 transition-colors">
                                            {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                                        </div>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 p-6">
                                        <div className="space-y-4">
                                            {group.list.map((c, i) => (
                                                <div key={i} className={`bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border ${c.status === 'Resolved' ? 'opacity-50 border-emerald-500/30' : 'border-gray-100 dark:border-gray-800'}`}>
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 text-[10px] font-black px-2 py-0.5 rounded-sm uppercase tracking-wider">
                                                                {c.type}
                                                            </div>
                                                            {c.status === 'Resolved' ? (
                                                                <div className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-sm uppercase tracking-wider">
                                                                    Resolved
                                                                </div>
                                                            ) : (
                                                                <div className={`text-[10px] font-black px-2 py-0.5 rounded-sm uppercase tracking-wider ${c.priority === 'High' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                                                                    {c.priority} Priority
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{new Date(c.created_at).toLocaleString()}</div>
                                                            <div className="flex items-center gap-1">
                                                                {c.status !== 'Resolved' && (
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); handleResolve(c.id); }}
                                                                        className="relative z-10 p-1.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-lg transition-all"
                                                                        title="Mark as Resolved"
                                                                    >
                                                                        <CheckCircle size={14} />
                                                                    </button>
                                                                )}
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                                                                    className="relative z-10 p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all"
                                                                    title="Delete Permanently"
                                                                >
                                                                    <AlertTriangle size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <p className="text-sm text-gray-700 dark:text-gray-300 font-medium mb-3">{c.description}</p>
                                                    
                                                    {/* New: Symptoms & Media Display */}
                                                    {(c.symptoms || c.image) && (
                                                        <div className="flex flex-wrap items-center gap-4 mb-3 border-t dark:border-gray-800 pt-3">
                                                            {c.symptoms && JSON.parse(c.symptoms).length > 0 && (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {JSON.parse(c.symptoms).map(s => (
                                                                        <span key={s} className="bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 text-[9px] font-black px-2 py-0.5 rounded flex items-center gap-1 uppercase">
                                                                            <Thermometer size={10} /> {s}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {c.image && (
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); window.open().document.write(`<img src="${c.image}" style="max-width:100%;height:auto;"/>`); }}
                                                                    className="flex items-center gap-1 text-[10px] font-black text-blue-500 uppercase hover:underline"
                                                                >
                                                                    <ImageIcon size={12} /> View Evidence Photo
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="flex flex-col md:flex-row md:items-center gap-4 text-xs font-bold text-gray-400">
                                                        <span className="flex items-center gap-1"><User size={12} /> {c.user_name || `User ID: ${c.user_id}`}</span>
                                                        <span className="flex items-center gap-1"><MapPin size={12} /> {c.location}</span>
                                                        {c.lat && (
                                                            <a 
                                                                href={`https://www.google.com/maps?q=${c.lat},${c.lng}`} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="text-primary-500 hover:underline flex items-center gap-1"
                                                            >
                                                                <Crosshair size={12} /> Precise Location Pin
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // --- RENDER CITIZEN VIEW ---
    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-8 duration-500 mb-20">
            <div className="text-center">
                <div className="h-16 w-16 bg-blue-100 dark:bg-blue-900/30 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageSquare size={32} />
                </div>
                <h2 className="text-3xl font-black dark:text-white tracking-tight">Public Incident Reporting</h2>
                <p className="text-gray-500 mt-2">Use the map to identify the pipeline or pinpoint the exact location of the issue.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Section 1: Interactive Map Selection */}
                <div className="space-y-4">
                    <div className="flex justify-between items-end mb-2">
                        <label className="text-xs font-black uppercase text-gray-400 tracking-widest flex items-center">
                            <MapPin size={14} className="mr-2 text-primary-500" /> 
                            {formData.lat ? 'Location Pinpointed' : 'Tap Map to Pinpoint location'}
                        </label>
                        <button 
                            type="button"
                            onClick={detectLocation}
                            className="bg-primary-500/10 hover:bg-primary-500/20 text-primary-500 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all"
                        >
                            <Crosshair size={12} /> Use My Location
                        </button>
                    </div>
                    <div className="h-[450px] rounded-3xl overflow-hidden border-4 border-white dark:border-gray-800 shadow-2xl relative z-0">
                        <MapContainer center={mapCenter} zoom={14} style={{ height: '100%', width: '100%' }}>
                            <ChangeView center={mapCenter} />
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            <MapEvents onMapClick={handleMapClick} />
                            
                            {pipelines.map(pipe => {
                                let coords = [];
                                try {
                                    coords = typeof pipe.coordinates === 'string' ? JSON.parse(pipe.coordinates || '[]') : (pipe.coordinates || []);
                                } catch(e) {}
                                
                                if (coords.length < 2) return null;
                                const isSelected = String(formData.pipeline_id) === String(pipe.id);

                                return (
                                    <Polyline 
                                        key={pipe.id}
                                        positions={coords}
                                        color={isSelected ? '#f59e0b' : '#3b82f6'}
                                        weight={isSelected ? 10 : 6}
                                        opacity={isSelected ? 1 : 0.6}
                                        eventHandlers={{
                                            click: (e) => {
                                                L.DomEvent.stopPropagation(e);
                                                handlePipelineMapClick(pipe.id);
                                            }
                                        }}
                                    >
                                        <Popup>
                                            <div className="text-center font-black uppercase text-[10px]">
                                                {pipe.name}
                                                <div className="text-blue-500 mt-1">Click line to Select</div>
                                            </div>
                                        </Popup>
                                    </Polyline>
                                );
                            })}

                            {formData.lat && (
                                <Marker position={[formData.lat, formData.lng]}>
                                    <Popup>
                                        <p className="font-bold text-[10px] uppercase">Reported Location</p>
                                    </Popup>
                                </Marker>
                            )}
                        </MapContainer>
                    </div>
                </div>

                {/* Section 2: Form Details */}
                <form onSubmit={handleSubmit} className="glass-card p-8 space-y-6 flex flex-col justify-between">
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-gray-400 tracking-widest flex items-center"><MapPin size={14} className="mr-2" /> Affected Pipeline</label>
                            <select 
                                required 
                                value={formData.pipeline_id} 
                                onChange={e => setFormData({ ...formData, pipeline_id: e.target.value })} 
                                className="w-full bg-gray-50 dark:bg-gray-700/50 border-none rounded-xl p-4 focus:ring-2 focus:ring-primary-500 dark:text-white font-bold"
                            >
                                <option value="" disabled>-- Select a Pipeline --</option>
                                {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <p className="text-[10px] text-gray-400 font-bold uppercase">TIP: You can also tap a pipeline on the map to select it.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-gray-400 tracking-widest flex items-center"><Flag size={14} className="mr-2" /> Issue Type</label>
                                <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className="w-full bg-gray-50 dark:bg-gray-700/50 border-none rounded-xl p-4 focus:ring-2 focus:ring-primary-500 dark:text-white font-bold">
                                    <option>Leakage</option>
                                    <option>Dirty Water</option>
                                    <option>No Supply</option>
                                    <option>Low Pressure</option>
                                    <option>Bad Smell</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-gray-400 tracking-widest flex items-center"><TrendingUp size={14} className="mr-2" /> Priority</label>
                                <select value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })} className="w-full bg-gray-50 dark:bg-gray-700/50 border-none rounded-xl p-4 focus:ring-2 focus:ring-primary-500 dark:text-white font-bold">
                                    <option>Low</option>
                                    <option>Medium</option>
                                    <option>High</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-gray-400 tracking-widest flex items-center"><Info size={14} className="mr-2" /> Description</label>
                            <textarea required value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full bg-gray-50 dark:bg-gray-700/50 border-none rounded-xl p-4 focus:ring-2 focus:ring-primary-500 dark:text-white min-h-[100px] font-medium" placeholder="Describe what you see..." />
                        </div>
                    </div>

                        <div className="space-y-4">
                            <label className="text-xs font-bold uppercase text-gray-400 tracking-widest flex items-center"><Thermometer size={14} className="mr-2" /> Related Symptoms (Optional)</label>
                            <div className="grid grid-cols-2 gap-3">
                                {['Diarrhea', 'Vomiting', 'Fever', 'Skin Rash'].map(s => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => toggleSymptom(s)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                                            formData.symptoms.includes(s) 
                                            ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/20' 
                                            : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-400'
                                        }`}
                                    >
                                        <Activity size={12} /> {s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-xs font-bold uppercase text-gray-400 tracking-widest flex items-center"><Camera size={14} className="mr-2" /> Visual Evidence</label>
                            
                            {formData.image ? (
                                <div className="relative rounded-2xl overflow-hidden border-2 border-primary-500/30">
                                    <img src={formData.image} alt="Evidence" className="w-full h-32 object-cover" />
                                    <button 
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, image: null }))}
                                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <ImageIcon size={24} className="text-gray-400 mb-2" />
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Upload Leak/Water Photo</p>
                                    </div>
                                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                                </label>
                            )}
                        </div>

                        <button type="submit" className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-500/30 transition-all flex items-center justify-center space-x-2 uppercase tracking-widest mt-6">
                            <Send size={18} /> <span>File Digital Complaint</span>
                        </button>
                </form>
            </div>

            {submitted && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-emerald-500 text-white font-black px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-10 z-50">
                    <CheckCircle size={20} /> COMPLAINT DISPATCHED SUCCESSFULLY
                </div>
            )}
        </div>
    );
};

export default Complaints;
