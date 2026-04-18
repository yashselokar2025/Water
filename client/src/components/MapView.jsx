import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents, CircleMarker } from 'react-leaflet';
import { useNavigate, useLocation } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Search, MapPin, Navigation, Info, Crosshair, PenTool, Filter, Eye, EyeOff, BarChart3, AlertCircle, ChevronRight, Activity, X, RefreshCcw } from 'lucide-react';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';

// Fix for default leaflet icons
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const ChangeView = ({ center, zoom }) => {
    const map = useMap();
    useEffect(() => {
        if (center) map.flyTo(center, zoom, { animate: true, duration: 2 });
    }, [center, zoom, map]);
    return null;
};

const MapEvents = ({ onMapClick, drawingMode }) => {
    useMapEvents({
        click(e) {
            if (drawingMode) {
                onMapClick(e.latlng);
            }
        },
    });
    return null;
};

const MapView = ({ sensors, pipelines, isAdmin, onCoordinateSelect, drawingMode, tempPath, selectedCoord, filterPipelineId, onFilterChange }) => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const location = useLocation();
    const isMainGisView = location.pathname === '/map';
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [mapFocus, setMapFocus] = useState({ center: [12.9716, 77.5946], zoom: 14 });
    const [showResults, setShowResults] = useState(false);
    const [highlightId, setHighlightId] = useState(null); // {id, type}

    const selectedPipelineName = useMemo(() => {
        if (!filterPipelineId) return null;
        return pipelines.find(p => String(p.id) === String(filterPipelineId))?.name;
    }, [filterPipelineId, pipelines]);

    // Filter sensors based on pipeline selection
    const filteredSensors = useMemo(() => {
        if (!filterPipelineId) return sensors;
        return sensors.filter(s => String(s.pipeline_id) === String(filterPipelineId));
    }, [sensors, filterPipelineId]);

    const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`;

    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async (e) => {
        const query = e.target.value;
        setSearchQuery(query);
        if (query.length > 2) {
            performSearch(query);
        } else {
            setSearchResults([]);
            setShowResults(false);
        }
    };

    const performSearch = async (query) => {
        setIsSearching(true);
        try {
            const localRes = await axios.get(`${API_BASE}/search?q=${query}`);
            let results = localRes.data;
            if (results.length < 3) {
                const globalRes = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&countrycodes=in`);
                const globalItems = globalRes.data.map(item => ({
                    id: item.place_id,
                    name: item.display_name,
                    type: 'location',
                    lat: item.lat,
                    lng: item.lon,
                    location: 'Global Location'
                }));
                results = [...results, ...globalItems];
            }
            setSearchResults(results);
            setShowResults(true);
        } catch (err) {
            console.error(err);
        } finally {
            setIsSearching(false);
        }
    };

    const focusOn = (item) => {
        if (!item) return;
        let lat = 0, lng = 0;

        if (item.lat && item.lng) {
            lat = parseFloat(item.lat);
            lng = parseFloat(item.lng);
        } else if (item.type === 'pipeline') {
            const pipe = pipelines.find(p => String(p.id) === String(item.id));
            if (pipe?.coordinates) {
                try {
                    const coords = typeof pipe.coordinates === 'string' ? JSON.parse(pipe.coordinates) : pipe.coordinates;
                    if (coords.length > 0) {
                        lat = coords.reduce((acc, c) => acc + c[0], 0) / coords.length;
                        lng = coords.reduce((acc, c) => acc + c[1], 0) / coords.length;
                    }
                } catch (e) { lat = 12.9716; lng = 77.5946; }
            } else { lat = 12.9716; lng = 77.5946; }
        } else {
            lat = 12.9716; lng = 77.5946;
        }

        const zoomLevel = item.type === 'location' ? 12 : 17;
        setMapFocus({ center: [lat, lng], zoom: zoomLevel });

        if (item.type !== 'location') {
            setHighlightId({ id: item.id, type: item.type });
            setTimeout(() => setHighlightId(null), 5000);
        }
        setShowResults(false);
        setSearchQuery(item.name.split(',')[0]);
    };

    const triggerSearch = async () => {
        if (searchQuery.length > 2) {
            if (searchResults.length > 0) {
                focusOn(searchResults[0]);
            } else {
                await performSearch(searchQuery);
            }
        }
    };

    const getPipelineStats = (pipeId) => {
        const pipeSensors = sensors.filter(s => String(s.pipeline_id) === String(pipeId));
        if (!pipeSensors.length) return { status: 'Safe', risk: 0, sensorCount: 0, quality: 'Good' };
        const risk = Math.max(...pipeSensors.map(s => s.leakScore || 0));
        const status = pipeSensors.some(s => s.status === 'Critical') ? 'Critical' : (pipeSensors.some(s => s.status === 'Warning') ? 'Warning' : 'Safe');

        // Quality logic
        const avgTds = pipeSensors.reduce((acc, s) => acc + (s.tds || 0), 0) / pipeSensors.length;
        const avgTurb = pipeSensors.reduce((acc, s) => acc + (s.turbidity || 0), 0) / pipeSensors.length;
        let quality = 'Good';
        if (avgTds > 600 || avgTurb > 5) quality = 'Poor';
        else if (avgTds > 300 || avgTurb > 2) quality = 'Fair';

        return { status, risk, sensorCount: pipeSensors.length, quality };
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Active': case 'Safe': return 'text-green-500';
            case 'Warning': return 'text-yellow-500';
            case 'Critical': return 'text-red-500';
            default: return 'text-gray-500';
        }
    };

    return (
        <div className="h-full glass-card overflow-hidden flex flex-col animate-in fade-in duration-500 relative">
            {/* Floating Search Hub - Positioned Top-Left but offset from map controls */}
            <div className="absolute top-6 left-16 z-[1000] w-full max-w-sm block">
                <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border border-white/20 dark:border-gray-700/30 rounded-2xl shadow-2xl flex items-center p-2 group transition-all focus-within:ring-4 focus-within:ring-primary-500/10">
                    <button
                        onClick={triggerSearch}
                        className={`p-3 text-white rounded-xl shadow-lg transition-colors active:scale-95 ${isSearching ? 'bg-primary-400' : 'bg-primary-500 hover:bg-primary-600 shadow-primary-500/20'}`}
                    >
                        {isSearching ? <RefreshCcw size={20} className="animate-spin" /> : <Search size={20} />}
                    </button>
                    <input
                        value={searchQuery}
                        onChange={handleSearch}
                        onKeyDown={(e) => e.key === 'Enter' && triggerSearch()}
                        placeholder={t('map.searchPlaceholder')}
                        className="flex-1 bg-transparent border-none py-3 px-2 text-sm font-black dark:text-white outline-none placeholder:text-gray-400"
                    />
                </div>

                {showResults && (
                    <div className="absolute top-full mt-3 w-full bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl border border-white/20 dark:border-gray-700/50 rounded-2xl shadow-2xl overflow-hidden max-h-[400px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-300">
                        {searchResults.length > 0 ? (
                            searchResults.map((item, i) => (
                                <button
                                    key={i}
                                    onClick={() => focusOn(item)}
                                    className="w-full flex items-center p-4 hover:bg-primary-500/10 transition-colors text-left border-b border-gray-100 dark:border-gray-800 last:border-0"
                                >
                                    <div className={`p-2 rounded-lg mr-3 shadow-inner ${item.type === 'sensor' ? 'bg-emerald-100 text-emerald-600' : (item.type === 'pipeline' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600')}`}>
                                        {item.type === 'sensor' ? <Activity size={16} /> : (item.type === 'pipeline' ? <Navigation size={16} /> : <MapPin size={16} />)}
                                    </div>
                                    <div>
                                        <p className="text-xs font-black dark:text-white uppercase tracking-tighter">{item.name}</p>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{item.location}</p>
                                    </div>
                                    <ChevronRight className="ml-auto text-gray-300" size={16} />
                                </button>
                            ))
                        ) : (
                            !isSearching && (
                                <div className="p-8 text-center">
                                    <Info size={32} className="mx-auto text-gray-300 mb-2" />
                                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{t('map.noResults')}</p>
                                </div>
                            )
                        )}
                        {isSearching && searchResults.length === 0 && (
                            <div className="p-8 text-center">
                                <RefreshCcw size={32} className="mx-auto text-primary-500 mb-2 animate-spin" />
                                <p className="text-xs font-black text-primary-500 uppercase tracking-widest">{t('map.broadcasting')}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Mission Control HUD - Dynamic Centered Display */}
            {selectedPipelineName && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] animate-in slide-in-from-top-4 duration-500">
                    <div className="bg-gray-900/90 backdrop-blur-xl border border-white/10 px-8 py-3 rounded-full shadow-2xl flex items-center space-x-6">
                        <div className="flex items-center space-x-3">
                            <div className="relative">
                                <Activity size={18} className="text-amber-500 animate-pulse" />
                                <div className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full"></div>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest leading-none">Inspecting Segment</span>
                                <span className="text-sm font-black text-white uppercase tracking-tighter leading-tight mt-0.5">{selectedPipelineName}</span>
                            </div>
                        </div>
                        <div className="h-6 w-px bg-white/10"></div>
                        <button
                            onClick={() => onFilterChange('')}
                            className="bg-red-500/20 hover:bg-red-500/40 text-red-400 p-2 rounded-full transition-all hover:rotate-90 group"
                            title="Deselect Infrastructure"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}
            <div className="flex-1 z-0 relative">
                <MapContainer
                    center={mapFocus.center}
                    zoom={mapFocus.zoom}
                    maxBounds={[[6.746, 68.032], [35.513, 97.402]]}
                    maxBoundsViscosity={0.8}
                    style={{ height: '100%', width: '100%' }}
                >
                    <ChangeView center={mapFocus.center} zoom={mapFocus.zoom} />
                    <MapEvents onMapClick={onCoordinateSelect} drawingMode={drawingMode} />
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; OpenStreetMap contributors'
                    />

                    {/* Pipelines */}
                    {pipelines.map((pipe) => {
                        if (filterPipelineId && !isMainGisView && String(pipe.id) !== String(filterPipelineId)) return null;
                        const isSelected = filterPipelineId && String(filterPipelineId) === String(pipe.id);
                        const isHighlighted = highlightId?.type === 'pipeline' && String(highlightId.id) === String(pipe.id);
                        const stats = getPipelineStats(pipe.id);

                        if (isHighlighted) return null;

                        try {
                            const coords = typeof pipe.coordinates === 'string' ? JSON.parse(pipe.coordinates || '[]') : (pipe.coordinates || []);
                            if (coords.length > 1) {
                                return (
                                    <Polyline
                                        key={pipe.id}
                                        positions={coords}
                                        color={isSelected ? '#f59e0b' : (stats.status === 'Critical' ? '#ef4444' : "#3b82f6")}
                                        weight={isSelected ? 12 : (stats.status === 'Critical' ? 12 : 6)}
                                        opacity={isSelected ? 1 : (stats.status === 'Critical' ? 1 : (filterPipelineId ? 0.2 : 0.8))}
                                        eventHandlers={{
                                            click: (e) => {
                                                if (onFilterChange) onFilterChange(String(pipe.id));
                                                // Leaflet popup will open automatically because it's a child
                                            }
                                        }}
                                    >
                                        <Popup>
                                            <div className="p-4 min-w-[240px] glass-card border-none shadow-none bg-white dark:bg-gray-800">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <h5 className="font-black dark:text-gray-100 uppercase tracking-tighter text-[14px] leading-tight">{pipe.name}</h5>
                                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">{pipe.start_location} → {pipe.end_location}</p>
                                                    </div>
                                                    <div className={`p-2 rounded-xl flex flex-col items-center ${stats.status === 'Safe' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                                        <Activity size={12} />
                                                        <span className="text-[8px] font-black uppercase mt-1">{stats.status}</span>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-3 gap-2 mb-4">
                                                    <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded-xl flex flex-col items-center justify-center border border-gray-100 dark:border-gray-700">
                                                        <span className="text-[8px] block text-gray-400 font-black uppercase mb-1">Sensors</span>
                                                        <span className="font-black text-[14px] dark:text-white leading-none">{stats.sensorCount}</span>
                                                    </div>
                                                    <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded-xl flex flex-col items-center justify-center border border-gray-100 dark:border-gray-700">
                                                        <span className="text-[8px] block text-gray-400 font-black uppercase mb-1">Leak Risk</span>
                                                        <span className={`font-black text-[14px] leading-none ${stats.risk > 40 ? 'text-red-500' : 'text-emerald-500'}`}>{stats.risk}%</span>
                                                    </div>
                                                    <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded-xl flex flex-col items-center justify-center border border-gray-100 dark:border-gray-700">
                                                        <span className="text-[8px] block text-gray-400 font-black uppercase mb-1">Quality</span>
                                                        <span className={`font-black text-[14px] leading-none ${stats.quality === 'Good' ? 'text-blue-500' : (stats.quality === 'Fair' ? 'text-amber-500' : 'text-red-500')}`}>{stats.quality}</span>
                                                    </div>
                                                </div>

                                                {isMainGisView && (
                                                    <button
                                                        onClick={() => navigate(`/pipeline/${pipe.id}`)}
                                                        className="w-full bg-gray-900 dark:bg-primary-500 text-white py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-gray-900/10 dark:shadow-primary-500/20"
                                                    >
                                                        <BarChart3 size={14} className="mr-2" /> View Detailed Analysis <ChevronRight size={14} className="ml-1" />
                                                    </button>
                                                )}
                                            </div>
                                        </Popup>
                                    </Polyline>
                                );
                            }
                        } catch (e) { return null; }
                        return null;
                    })}

                    {/* Sensor Markers */}
                    {filteredSensors.map((sensor) => {
                        const isHighRisk = sensor.leakScore > 75 || sensor.status === 'Critical' || (sensor.turbidity > 5.0 || sensor.tds > 500);
                        const isMediumRisk = sensor.leakScore > 40 || sensor.status === 'Warning';
                        const isSelected = filterPipelineId && String(filterPipelineId) === String(sensor.pipeline_id);

                        return (
                            <React.Fragment key={sensor.id}>
                                {/* Hazard Visualization Layers */}
                                {isHighRisk && (
                                    <CircleMarker
                                        center={[parseFloat(sensor.lat), parseFloat(sensor.lng)]}
                                        radius={25}
                                        pathOptions={{
                                            color: '#ef4444',
                                            fillColor: '#ef4444',
                                            fillOpacity: 0.15,
                                            weight: 1
                                        }}
                                        className="animate-pulse-red"
                                    >
                                        <Popup className="risk-tooltip">
                                            <div className="text-center">
                                                <p className="font-black text-[10px] m-0">🚨 CRITICAL HAZARD 🚨</p>
                                                <p className="text-[9px] m-0 opacity-90 mt-1 uppercase">Leak/Contamination Detected</p>
                                            </div>
                                        </Popup>
                                    </CircleMarker>
                                )}

                                {isMediumRisk && !isHighRisk && (
                                    <CircleMarker
                                        center={[parseFloat(sensor.lat), parseFloat(sensor.lng)]}
                                        radius={18}
                                        pathOptions={{
                                            color: '#f59e0b',
                                            fillColor: '#f59e0b',
                                            fillOpacity: 0.15,
                                            weight: 1
                                        }}
                                        className="animate-pulse-orange"
                                    />
                                )}

                                <CircleMarker
                                    center={[parseFloat(sensor.lat), parseFloat(sensor.lng)]}
                                    radius={isSelected ? 14 : 10}
                                    pathOptions={{
                                        fillColor: (sensor.status === 'Critical' || sensor.isAnomaly || sensor.leakScore > 75) ? '#ef4444' : (isSelected ? '#eab308' : '#22c55e'),
                                        color: (sensor.status === 'Critical' || sensor.isAnomaly || sensor.leakScore > 75) ? '#7f1d1d' : (isSelected ? '#ca8a04' : '#15803d'),
                                        fillOpacity: 1,
                                        weight: (sensor.isAnomaly || isSelected || sensor.leakScore > 75) ? 5 : 2
                                    }}
                                    className={(sensor.status === 'Critical' || sensor.isAnomaly || sensor.leakScore > 75) ? 'animate-pulse' : ''}
                                >
                                    <Popup>
                                        <div className="p-2 min-w-[200px]">
                                            <div className="flex justify-between items-center mb-2">
                                                <div>
                                                    <h4 className="font-black text-gray-800 leading-tight">{sensor.name}</h4>
                                                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{sensor.location}</p>
                                                </div>
                                                <div className={`h-3 w-3 rounded-full ${getStatusColor(sensor.status).replace('text-', 'bg-')} shadow-sm border border-white`}></div>
                                            </div>
                                            <div className="space-y-2 pt-2 border-t">
                                                <div className="flex justify-between text-[10px] font-black">
                                                    <span className="text-gray-400 uppercase tracking-widest">Pressure</span>
                                                    <span className="text-blue-600 tracking-tighter">{sensor.pressure?.toFixed(2)} bar</span>
                                                </div>
                                                {sensor.peerAvgPressure !== undefined && (
                                                    <div className="bg-gray-50 p-2 rounded-lg mt-1 border-l-2 border-primary-500">
                                                        <div className="flex justify-between text-[8px] font-black uppercase text-gray-400 mb-1">
                                                            <span>Peer Avg</span>
                                                            <span className="text-primary-500">{sensor.peerAvgPressure?.toFixed(2)} bar</span>
                                                        </div>
                                                        <div className="flex justify-between text-[9px] font-black uppercase">
                                                            <span>Deviation</span>
                                                            <span className={sensor.pressureDeviation > 0.8 ? 'text-red-500' : 'text-emerald-500'}>
                                                                {sensor.pressureDeviation > 0 ? `±${sensor.pressureDeviation?.toFixed(2)}` : '0.00'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="flex justify-between text-[10px] font-black pt-2">
                                                    <span className="text-gray-400 uppercase tracking-widest">Flow</span>
                                                    <span className="text-emerald-600 tracking-tighter">{sensor.flow?.toFixed(2)} L/s</span>
                                                </div>
                                                {sensor.isAnomaly && (
                                                    <div className="mt-3 p-2 bg-red-50 border border-red-100 rounded-xl">
                                                        <p className="text-[9px] font-black text-red-600 uppercase tracking-widest flex items-center">
                                                            <AlertCircle size={12} className="mr-1" /> AI Detection Flag
                                                        </p>
                                                        <p className="text-[8px] text-red-500 font-bold mt-0.5">{sensor.anomalyReason || 'Unusual behavior compared to neighbors'}</p>
                                                    </div>
                                                )}
                                                <div className="flex justify-between text-[10px] font-black pt-2">
                                                    <span className="text-gray-400 uppercase tracking-widest">Leak Risk</span>
                                                    <span className={`${isHighRisk ? 'text-red-500' : 'text-gray-600'} tracking-tighter`}>{sensor.leakScore?.toFixed(2)}%</span>
                                                </div>
                                                <div className="flex justify-between text-[10px] font-black">
                                                    <span className="text-gray-400 uppercase tracking-widest">Quality (TDS)</span>
                                                    <span className={`${sensor.tds > 500 ? 'text-red-500' : 'text-emerald-500'} tracking-tighter`}>{sensor.tds?.toFixed(2)}ppm</span>
                                                </div>
                                            </div>
                                        </div>
                                    </Popup>
                                </CircleMarker>
                            </React.Fragment>
                        );
                    })}

                    {/* Active Drawing: Current Pipeline Path preview */}
                    {drawingMode === 'pipeline' && tempPath && tempPath.length > 0 && (
                        <>
                            <Polyline
                                positions={tempPath}
                                color="#ef4444"
                                weight={4}
                                dashArray="10, 10"
                                opacity={0.6}
                            />
                            {tempPath.map((pos, idx) => (
                                <CircleMarker
                                    key={`temp-node-${idx}`}
                                    center={pos}
                                    radius={4}
                                    pathOptions={{ color: '#ef4444', fillOpacity: 1 }}
                                />
                            ))}
                        </>
                    )}

                    {/* Active Selection: Current Sensor Placement preview */}
                    {selectedCoord && (
                        <Marker position={selectedCoord}>
                            <Popup>
                                <div className="p-2">
                                    <p className="font-black text-[10px] uppercase tracking-widest text-primary-500">Proposed Node Position</p>
                                    <p className="text-[9px] text-gray-400 font-bold">{selectedCoord[0]}, {selectedCoord[1]}</p>
                                </div>
                            </Popup>
                        </Marker>
                    )}
                </MapContainer>
            </div>
        </div>
    );
};

export default MapView;
