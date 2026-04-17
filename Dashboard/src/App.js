import React, { useEffect } from 'react';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { TooltipComponent } from '@syncfusion/ej2-react-popups';
import { FiSettings } from 'react-icons/fi';

import './App.css';
import './index.css';
import { Navbar, Sidebar, ThemeSettings } from './components';
import AlertBanner from './components/AlertBanner';
import AIInsightsPanel from './components/AIInsightsPanel';
import ErrorBoundary from './components/ErrorBoundary';

import { AuthProvider, useAuth } from './auth/AuthContext';
import { useStateContext } from './contexts/ContextProvider';

// Pages
import Login            from './pages/Login';
import {
  ColorPicker, ComplainsData, Dashboard, WaterQuality, Editor,
  SensorAllocation, HealthDataCollection, OutbreakRisk,
  WaterQualitySensors, ComplaintsAwareness,
} from './pages';

import IoTSimulator    from './pages/IoTSimulator';
import MapView         from './pages/MapView';
import AnalyticsPage   from './pages/AnalyticsPage';
import Operations      from './pages/Operations';
import LeakageDetection from './pages/LeakageDetection';

// Protected route wrapper
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0f1e' }}>
      <div style={{ textAlign: 'center', color: '#64748b' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>💧</div>
        <p>Loading JeevanRakshak…</p>
      </div>
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
};

const AppShell = () => {
  const { setCurrentColor, setCurrentMode, currentMode, activeMenu, currentColor, themeSettings, setThemeSettings, alerts, dismissAlert, sensors } = useStateContext();

  useEffect(() => {
    const currentThemeColor = localStorage.getItem('colorMode');
    const currentThemeMode  = localStorage.getItem('themeMode');
    if (currentThemeColor) setCurrentColor(currentThemeColor);
    if (currentThemeMode)  setCurrentMode(currentThemeMode);
  }, []);

  const isDark = currentMode === 'Dark';

  return (
    <div
      className={isDark ? 'dark' : ''}
      style={{
        background: isDark ? '#0a0f1e' : '#f0f4f8',
        minHeight: '100vh',
        color: isDark ? '#f1f5f9' : '#0f172a',
        fontFamily: 'Inter, sans-serif',
        transition: 'background 0.3s, color 0.3s',
      }}
    >
      {/* Global floating alert banners */}
      <AlertBanner alerts={alerts.filter((a) => !a.resolved)} onDismiss={dismissAlert} />

      {/* AI Insights Panel */}
      <AIInsightsPanel sensors={sensors} />

      <div className="flex relative" style={{ minHeight: '100vh' }}>
        {/* Sidebar */}
        <div style={{ width: activeMenu ? '288px' : '0', flexShrink: 0, transition: 'width 0.3s', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 500, overflow: 'hidden' }}>
          <Sidebar />
        </div>

        {/* Main content */}
        <div style={{ marginLeft: activeMenu ? '288px' : '0', flex: 1, transition: 'margin-left 0.3s', minWidth: 0 }}>
          <div style={{ position: 'sticky', top: 0, zIndex: 400, background: 'rgba(10,15,30,0.95)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Navbar />
          </div>

          {themeSettings && <ThemeSettings />}

          {/* Settings button */}
          <div style={{ position: 'fixed', right: '90px', bottom: '24px', zIndex: 600 }}>
            <TooltipComponent content="Settings" position="Top">
              <button
                type="button"
                aria-label="Open settings"
                onClick={() => setThemeSettings(true)}
                style={{ background: 'linear-gradient(135deg, #00d4ff, #3b82f6)', borderRadius: '50%', width: '48px', height: '48px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,212,255,0.4)', color: '#0a0f1e', fontSize: '18px' }}
              >
                <FiSettings />
              </button>
            </TooltipComponent>
          </div>

          <Routes>
            <Route path="/"                    element={<Dashboard />} />
            <Route path="/dashboard"           element={<Dashboard />} />
            <Route path="/map-view"            element={<MapView />} />
            <Route path="/iot-simulator"       element={<IoTSimulator />} />
            <Route path="/analytics"           element={<AnalyticsPage />} />
            <Route path="/operations"          element={<Operations />} />
            <Route path="/Water-Quality"       element={<WaterQuality />} />
            <Route path="/health-data"         element={<HealthDataCollection />} />
            <Route path="/outbreak-risk"       element={<OutbreakRisk />} />
            <Route path="/water-sensors"       element={<WaterQualitySensors />} />
            <Route path="/complaints-awareness" element={<ComplaintsAwareness />} />
            <Route path="/complains-data"      element={<ComplainsData />} />
            <Route path="/leakage-detection"   element={<LeakageDetection />} />
            <Route path="/editor"              element={<Editor />} />
            <Route path="/sensor-allocation"   element={<SensorAllocation />} />
            <Route path="/color-picker"        element={<ColorPicker />} />
            <Route path="*"                    element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/*" element={<ProtectedRoute><AppShell /></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
};

// If already logged in, redirect away from /login
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : children;
};

export default App;
