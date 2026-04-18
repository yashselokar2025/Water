import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Map as MapIcon,
  Activity,
  Droplets,
  AlertTriangle,
  Settings,
  UserCircle,
  Menu,
  X,
  Moon,
  Sun,
  ClipboardList,
  HeartPulse,
  TrendingUp,
  AlertCircle,
  LogOut,
  Bell,
  Navigation,
  MessageSquare
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import MapView from './components/MapView';
import SimulationHub from './components/SimulationHub';
import Analytics from './components/Analytics';
import WaterQuality from './components/WaterQualityIntelligence';
import HealthData from './components/HealthData';
import Complaints from './components/Complaints';
import LeakDetection from './components/LeakDetection';
import OutbreakRisk from './components/OutbreakRisk';
import Auth from './components/Auth';
import PipelineDetail from './components/PipelineDetail';
import useOffline from './hooks/useOffline';
import Profile from './components/Profile';
import { detectSensorAnomaly, generateAIInsight, mergeInsightQueue } from './utils/aiEngine';
import { useLanguage } from './context/LanguageContext';

const API_BASE = 'http://localhost:5000/api';

function App() {
  const { language, toggleLanguage, t } = useLanguage();
  const [user, setUser] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [sensors, setSensors] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [kpis, setKpis] = useState({});
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [alerts, setAlerts] = useState(JSON.parse(localStorage.getItem('cached_alerts') || '[]'));
  const [smsLogs, setSmsLogs] = useState([]);
  const [isAlertHistoryOpen, setIsAlertHistoryOpen] = useState(false);

  // ── AI Decision Engine shared state ────────────────────────────────────────
  // aiInsights: structured insight objects shown in Dashboard AI Queue
  const [aiInsights, setAiInsights] = useState([]);
  // anomalyPersistence: { [sensorId-eventType]: cycleCount } for temporal validation
  const anomalyPersistenceRef = React.useRef({});

  const navigate = useNavigate();
  const location = useLocation();
  const [lastUpdated, setLastUpdated] = useState(localStorage.getItem('last_updated_time') || null);

  const { isOnline, pendingSyncCount, lastSyncTime } = useOffline(() => fetchData());

  useEffect(() => {
    const savedUser = localStorage.getItem('smartwater_user');
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const fetchData = async () => {
    try {
      const sensorRes = await axios.get(`${API_BASE}/sensors`);
      setSensors(sensorRes.data);
      localStorage.setItem('cached_sensors', JSON.stringify(sensorRes.data));

      const pipeRes = await axios.get(`${API_BASE}/pipelines`);
      setPipelines(pipeRes.data);
      localStorage.setItem('cached_pipelines', JSON.stringify(pipeRes.data));

      const kpiRes = await axios.get(`${API_BASE}/dashboard/kpis`);
      setKpis(kpiRes.data);
      localStorage.setItem('cached_kpis', JSON.stringify(kpiRes.data));

      const now = new Date().toLocaleTimeString();
      setLastUpdated(now);
      localStorage.setItem('last_updated_time', now);
      localStorage.setItem('last_updated_time_ms', Date.now().toString());

      const smsRes = await axios.get(`${API_BASE}/sms-logs`);
      setSmsLogs(() => [...smsRes.data]);
      console.log("Telemetry sync complete");
    } catch (err) {
      console.error(`Error fetching data at ${err.config?.url}:`, err);
      // Fallback to cache if offline
      if (!navigator.onLine) {
        setSensors(JSON.parse(localStorage.getItem('cached_sensors') || '[]'));
        setPipelines(JSON.parse(localStorage.getItem('cached_pipelines') || '[]'));
        setKpis(JSON.parse(localStorage.getItem('cached_kpis') || '{}'));
      }
    }
  };

  useEffect(() => {
    if (user) {
      console.log("System: Starting 2s real-time sync with watchdog");
      fetchData();

      const interval = setInterval(() => {
        const timeSinceUpdate = Date.now() - new Date(localStorage.getItem('last_updated_time_ms') || 0).getTime();

        if (timeSinceUpdate > 10000) {
          console.warn("System watchdog: Data stale detected, restarting sync...");
          fetchData();
        } else {
          console.log("System: Sensor update running");
          fetchData();
        }
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [user]);

  const [lastAlertTime, setLastAlertTime] = useState({}); // Tracking { 'sensor-id-type': timestamp }

  // ── AI Decision Engine: runs on every sensor data update ─────────────────
  useEffect(() => {
    if (!sensors || sensors.length === 0) return;

    const now = Date.now();
    const THROTTLE_MS = 5 * 60 * 1000;
    const CYCLES_REQUIRED = 2;  // separate for leak and contamination
    const persistence = anomalyPersistenceRef.current;

    const newAlerts = [];
    const newInsightsBatch = [];

    sensors.forEach(sensor => {
      const neighbors = sensors.filter(
        s => String(s.pipeline_id) === String(sensor.pipeline_id) && s.id !== sensor.id
      );

      // ── Run fully separated detection ────────────────────────────────
      const { leakScore, contaminationLevel } = detectSensorAnomaly(sensor, neighbors);

      // ── SEPARATE temporal tracking ───────────────────────────────────
      const leakKey = `${sensor.id}-LEAK`;
      const contamKey = `${sensor.id}-CONTAMINATION`;

      if (leakScore >= 35) persistence[leakKey] = (persistence[leakKey] || 0) + 1;
      else delete persistence[leakKey];

      if (contaminationLevel >= 60) persistence[contamKey] = (persistence[contamKey] || 0) + 1;
      else delete persistence[contamKey];

      const leakCycles = persistence[leakKey] || 0;
      const contamCycles = persistence[contamKey] || 0;

      // ── Generate insight ─────────────────────────────────────────────
      if (leakCycles >= CYCLES_REQUIRED || contamCycles >= CYCLES_REQUIRED) {
        const insight = generateAIInsight(sensor, neighbors, leakCycles, contamCycles);
        if (insight) newInsightsBatch.push(insight); // This array is local to this render cycle, it's safe to mutate locally before setting state.
      }

      // ── Toast alerts ─────────────────────────────────────────────────
      if (leakScore > 70) {
        const alertKey = `leak-${sensor.id}`;
        if (!lastAlertTime[alertKey] || now - lastAlertTime[alertKey] > THROTTLE_MS) {
          newAlerts.push({
            id: `${alertKey}-${now}`,
            type: 'leak',
            severity: leakScore > 90 ? 'High' : 'Medium',
            message: `🚨 Leak Detected at ${sensor.name}`,
            location: sensor.location,
            pipelineId: sensor.pipeline_id,
            timestamp: new Date().toLocaleTimeString()
          });
          setLastAlertTime(prev => ({ ...prev, [alertKey]: now }));
        }
      }
      if (contaminationLevel >= 60) {
        const alertKey = `contam-${sensor.id}`;
        if (!lastAlertTime[alertKey] || now - lastAlertTime[alertKey] > THROTTLE_MS) {
          newAlerts.push({
            id: `${alertKey}-${now}`,
            type: 'contamination',
            severity: 'High',
            message: `⚠️ Contamination Detected at ${sensor.name}`,
            location: sensor.location,
            pipelineId: sensor.pipeline_id,
            timestamp: new Date().toLocaleTimeString()
          });
          setLastAlertTime(prev => ({ ...prev, [alertKey]: now }));
        }
      }
    });

    // ── Update AI insight queue ──────────────────────────────────────────
    setAiInsights(prev => mergeInsightQueue(prev, newInsightsBatch));

    // ── Update toast alerts ───────────────────────────────────────────────
    if (newAlerts.length > 0) {
      setAlerts(prev => {
        const uniqueNew = newAlerts.filter(na => !prev.some(pa => pa.message === na.message));
        if (uniqueNew.length > 0) {
          const updated = [...uniqueNew, ...prev].slice(0, 50);
          localStorage.setItem('cached_alerts', JSON.stringify(updated));
          return updated;
        }
        return prev;
      });
    }
  }, [sensors]);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('smartwater_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('smartwater_user');
    navigate('/');
  };

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  const isAdmin = user.role === 'admin';

  const menuItems = [
    { id: 'dashboard', path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'map', path: '/map', label: 'GIS Map View', icon: MapIcon },
    { id: 'analytics', path: '/analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'water-quality', path: '/water-quality', label: 'Water Quality', icon: Droplets },
    { id: 'health', path: '/health', label: 'Health Data', icon: ClipboardList },
    { id: 'complaints', path: '/complaints', label: 'Complaints', icon: ClipboardList },
  ];

  if (isAdmin) {
    menuItems.splice(2, 0, { id: 'simulation-hub', path: '/simulation-hub', label: 'Simulation Hub', icon: Settings });
    menuItems.splice(5, 0, { id: 'leaks', path: '/leaks', label: 'Leak Detection', icon: AlertTriangle });
    menuItems.splice(6, 0, { id: 'risks', path: '/risks', label: 'Outbreak Risk', icon: HeartPulse });
  }

  return (
    <div className={`min-h-screen flex flex-col ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      {/* Offline Status Banner */}
      {!isOnline && (
        <div className="bg-red-600 text-white text-[10px] font-black uppercase tracking-[0.2em] py-2 text-center animate-pulse z-[10000]">
          ⚠️ You are currently offline. Showing last available data from {lastUpdated || 'cache'}.
          {pendingSyncCount > 0 && <span className="ml-4 bg-white text-red-600 px-2 py-0.5 rounded-full">{pendingSyncCount} ACTIONS PENDING SYNC</span>}
        </div>
      )}
      {isOnline && pendingSyncCount > 0 && (
        <div className="bg-emerald-600 text-white text-[10px] font-black uppercase tracking-[0.2em] py-1 text-center z-[10000]">
          📡 Connection Restored. Synchronizing {pendingSyncCount} pending events...
        </div>
      )}

      <div className="flex-1 flex">
        {/* Alert Toasts Overlay */}
        <div className="fixed top-20 right-8 z-[9999] flex flex-col space-y-4 max-w-sm">
          {alerts.slice(0, 3).map(alert => (
            <div key={alert.id} className={`p-4 rounded-2xl shadow-2xl border-l-8 animate-in slide-in-from-right-10 duration-500 backdrop-blur-xl ${alert.type === 'leak' ? 'bg-red-500/10 border-red-500 text-red-700 dark:text-red-400' : 'bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-400'}`}>
              <div className="flex justify-between items-start">
                <p className="text-sm font-black uppercase tracking-widest">{alert.message}</p>
                <button onClick={() => setAlerts(prev => prev.filter(a => a.id !== alert.id))} className="text-gray-400 hover:text-gray-600 ml-2">
                  <X size={14} />
                </button>
              </div>
              <p className="text-[10px] font-bold mt-1 opacity-80 flex items-center justify-between">
                <span>{alert.location} • {alert.timestamp}</span>
                {smsLogs.some(log => log.message.includes(alert.location)) && (
                  <span className="bg-blue-500 text-white px-1.5 py-0.5 rounded flex items-center text-[7px] animate-pulse">
                    <MessageSquare size={8} className="mr-1" /> SMS SENT
                  </span>
                )}
              </p>
              <button
                onClick={() => {
                  setSelectedPipelineId(String(alert.pipelineId));
                  navigate(`/pipeline/${alert.pipelineId}`);
                  setAlerts(prev => prev.filter(a => a.id !== alert.id));
                }}
                className="mt-3 text-[10px] font-black uppercase tracking-tighter bg-white/20 px-2 py-1 rounded-lg hover:bg-white/40"
              >
                Analyze Threat
              </button>
            </div>
          ))}
        </div>

        {/* Sidebar */}
        <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 flex flex-col z-50`}>
          <div className="p-4 flex items-center justify-between">
            {isSidebarOpen && <h1 className="text-xl font-bold bg-gradient-to-r from-primary-400 to-blue-600 bg-clip-text text-transparent">SmartWater AI</h1>}
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          <nav className="flex-1 mt-4 overflow-y-auto overflow-x-hidden">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center p-4 transition-colors ${location.pathname === item.path ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 border-r-4 border-primary-500' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              >
                <item.icon size={20} className="min-w-[20px]" />
                {isSidebarOpen && <span className="ml-4 font-medium">{item.label}</span>}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
            <button onClick={() => setDarkMode(!darkMode)} className="w-full flex items-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors">
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              {isSidebarOpen && <span className="ml-3 font-medium">{darkMode ? 'Light' : 'Dark'}</span>}
            </button>
            <button onClick={handleLogout} className="w-full flex items-center p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors">
              <LogOut size={20} />
              {isSidebarOpen && <span className="ml-3 font-medium">Logout</span>}
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col h-screen overflow-hidden">
          <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-8 z-40">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2 bg-emerald-500/5 px-4 py-2 rounded-2xl border border-emerald-500/10">
                <Activity className="text-emerald-500" size={18} />
                <span className="font-black text-[10px] text-emerald-500 uppercase tracking-widest">Live Flow</span>
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
              </div>
              <button
                onClick={toggleLanguage}
                className="flex items-center space-x-2 bg-primary-500/10 text-primary-500 px-4 py-2 rounded-2xl border border-primary-500/20 hover:bg-primary-500/20 transition-all font-black text-[10px] uppercase tracking-widest"
              >
                <MessageSquare size={16} />
                <span>{language === 'en' ? 'Hindi' : 'English'}</span>
              </button>
              <button
                onClick={() => setIsAlertHistoryOpen(!isAlertHistoryOpen)}
                className="relative p-2 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 transition-all group"
              >
                <Bell size={18} className="text-gray-500 dark:text-gray-400 group-hover:scale-110 transition-transform" />
                {alerts.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full animate-bounce">{alerts.length}</span>}
              </button>
            </div>
            <div className="flex items-center space-x-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-2xl transition-all" onClick={() => navigate('/profile')}>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-black dark:text-white uppercase tracking-tighter leading-none mb-1">{user.fullName || user.username}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">{isAdmin ? 'Authority Account' : 'Citizen Platform'}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 border-2 border-white/20 shadow-lg flex items-center justify-center overflow-hidden">
                {user.profilePicture ? (
                  <img src={user.profilePicture} alt="User" className="w-full h-full object-cover" />
                ) : (
                  <UserCircle className="text-gray-400" size={32} />
                )}
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-8 relative">
            {/* Alert History Panel */}
            {isAlertHistoryOpen && (
              <div className="absolute top-0 right-8 w-80 bg-white dark:bg-gray-800 rounded-b-3xl shadow-2xl border-x border-b border-gray-100 dark:border-gray-700 z-[45] p-6 animate-in slide-in-from-top-4 duration-300 max-h-[70vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-black dark:text-white uppercase tracking-tighter">Event Logs</h3>
                  <button onClick={() => setAlerts([])} className="text-[9px] font-black text-gray-400 hover:text-red-500 uppercase tracking-widest">Clear All</button>
                </div>
                <div className="space-y-4">
                  {alerts.length === 0 ? (
                    <p className="text-xs text-gray-400 italic text-center py-8">No critical events recorded.</p>
                  ) : (
                    alerts.map(a => (
                      <div key={a.id} className="p-3 border-b border-gray-50 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors rounded-xl">
                        <p className="text-xs font-black dark:text-gray-200">{a.message}</p>
                        <p className="text-[9px] text-gray-400 mt-1 uppercase font-bold tracking-widest flex items-center">
                          {a.timestamp} • {a.location}
                          {smsLogs.some(log => log.message.includes(a.location)) && (
                            <span className="ml-2 text-blue-500 flex items-center">
                              <MessageSquare size={10} className="mr-1" /> SMS SENT
                            </span>
                          )}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <Routes>
              <Route path="/" element={<Dashboard kpis={kpis} sensors={sensors} pipelines={pipelines} lastUpdated={lastUpdated} aiInsights={aiInsights} />} />
              <Route path="/map" element={<MapView sensors={sensors} pipelines={pipelines} isAdmin={isAdmin} fetchData={fetchData} filterPipelineId={selectedPipelineId} onFilterChange={setSelectedPipelineId} />} />
              <Route path="/simulation-hub" element={isAdmin ? <SimulationHub sensors={sensors} fetchData={fetchData} /> : <Dashboard kpis={kpis} aiInsights={aiInsights} />} />
              <Route path="/analytics" element={<Analytics sensors={sensors} pipelines={pipelines} selectedPipelineId={selectedPipelineId} onPipelineChange={setSelectedPipelineId} />} />
              <Route path="/water-quality" element={<WaterQuality liveSensors={sensors} pipelines={pipelines} selectedPipelineId={selectedPipelineId} onPipelineChange={setSelectedPipelineId} />} />
              <Route path="/health" element={<HealthData />} />
              <Route path="/complaints" element={<Complaints pipelines={pipelines} isAdmin={isAdmin} user={user} />} />
              <Route path="/profile" element={<Profile user={user} onUpdate={handleLogin} />} />
              <Route path="/leaks" element={isAdmin ? <LeakDetection sensors={sensors} /> : <Dashboard kpis={kpis} aiInsights={aiInsights} />} />
              <Route path="/risks" element={isAdmin ? <OutbreakRisk /> : <Dashboard kpis={kpis} aiInsights={aiInsights} />} />
              <Route path="/pipeline/:id" element={<PipelineDetail sensors={sensors} pipelines={pipelines} />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
