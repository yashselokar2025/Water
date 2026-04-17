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
import PrioritySystem from './components/PrioritySystem';
import Auth from './components/Auth';
import PipelineDetail from './components/PipelineDetail';
import useOffline from './hooks/useOffline';

const API_BASE = 'http://localhost:5000/api';

function App() {
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

      const smsRes = await axios.get(`${API_BASE}/sms-logs`);
      setSmsLogs(smsRes.data);
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
      fetchData();
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // --- Real-time Alert Engine ---
  useEffect(() => {
    const newAlerts = [];
    sensors.forEach(sensor => {
      // Leak Detection (🚨)
      if (sensor.leakScore > 75) {
        newAlerts.push({
          id: `leak-${sensor.id}-${Date.now()}`,
          type: 'leak',
          severity: sensor.leakScore > 90 ? 'High' : 'Medium',
          message: `🚨 Leak Detected at ${sensor.name}`,
          location: sensor.location,
          pipelineId: sensor.pipeline_id,
          timestamp: new Date().toLocaleTimeString()
        });
      }
      // Contamination Detection (⚠️)
      if (sensor.turbidity > 5.0 || sensor.tds > 500) {
        newAlerts.push({
          id: `contam-${sensor.id}-${Date.now()}`,
          type: 'contamination',
          severity: 'High',
          message: `⚠️ Water Contamination at ${sensor.name}`,
          location: sensor.location,
          pipelineId: sensor.pipeline_id,
          timestamp: new Date().toLocaleTimeString()
        });
      }
    });

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
    menuItems.splice(7, 0, { id: 'priority', path: '/priority', label: 'Priority List', icon: AlertCircle });
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
              <div className="flex items-center space-x-2">
                <Activity className="text-primary-500" />
                <span className="font-semibold text-gray-700 dark:text-gray-200">System Live</span>
                <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
              </div>
              <button
                onClick={() => setIsAlertHistoryOpen(!isAlertHistoryOpen)}
                className="relative p-2 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 transition-all group"
              >
                <Bell size={18} className="text-gray-500 dark:text-gray-400 group-hover:scale-110 transition-transform" />
                {alerts.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full animate-bounce">{alerts.length}</span>}
              </button>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium dark:text-gray-200">{user.username}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{isAdmin ? 'Authority Account' : 'Citizen Platform'}</p>
              </div>
              <UserCircle className="text-gray-400" size={32} />
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
              <Route path="/" element={<Dashboard kpis={kpis} lastUpdated={lastUpdated} />} />
              <Route path="/map" element={<MapView sensors={sensors} pipelines={pipelines} isAdmin={isAdmin} fetchData={fetchData} filterPipelineId={selectedPipelineId} onFilterChange={setSelectedPipelineId} />} />
              <Route path="/simulation-hub" element={isAdmin ? <SimulationHub sensors={sensors} fetchData={fetchData} /> : <Dashboard kpis={kpis} />} />
              <Route path="/analytics" element={<Analytics sensors={sensors} />} />
              <Route path="/water-quality" element={<WaterQuality />} />
              <Route path="/health" element={<HealthData />} />
              <Route path="/complaints" element={<Complaints />} />
              <Route path="/leaks" element={isAdmin ? <LeakDetection /> : <Dashboard kpis={kpis} />} />
              <Route path="/risks" element={isAdmin ? <OutbreakRisk /> : <Dashboard kpis={kpis} />} />
              <Route path="/priority" element={isAdmin ? <PrioritySystem /> : <Dashboard kpis={kpis} />} />
              <Route path="/pipeline/:id" element={<PipelineDetail sensors={sensors} pipelines={pipelines} />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
