import React, { useEffect, useState } from 'react';
import { get, ref } from 'firebase/database';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  FaFilter, FaFilePdf, FaFileExcel, FaTint, FaExclamationCircle,
  FaBiohazard, FaCommentDots, FaBroadcastTower,
} from 'react-icons/fa';

import { SparkLine } from '../components';
import { useStateContext } from '../contexts/ContextProvider';
import { useLanguage } from '../contexts/LanguageContext';
import { SparklineAreaData } from '../data/dummy';
import { database } from '../firebaseConfig';
import './Dashboard.css';

/* ─────────────────────────────────────────────────────────────────
   Metric Card Component
───────────────────────────────────────────────────────────────── */
const MetricCard = ({ icon, label, value, accentColor, dark }) => (
  <div className={`db-metric-card ${dark ? 'dark' : 'light'}`} style={{ '--accent': accentColor }}>
    <div className="db-metric-icon" style={{ background: `${accentColor}22`, color: accentColor }}>
      {icon}
    </div>
    <div className="db-metric-body">
      <p className="db-metric-label">{label}</p>
      <p className="db-metric-value">{value}</p>
    </div>
    <div className="db-metric-accent-bar" style={{ background: accentColor }} />
  </div>
);

/* ─────────────────────────────────────────────────────────────────
   Dashboard
───────────────────────────────────────────────────────────────── */
const Dashboard = () => {
  const { currentColor, currentMode } = useStateContext();
  const { t } = useLanguage();
  const dark = currentMode === 'Dark';

  /* --- state --- */
  const [waterSavedValue, setWaterSavedValue] = useState('Loading…');
  const [activeSensors, setActiveSensors]     = useState('38');
  const [fraudsDetected, setFraudsDetected]   = useState('1');
  const [leaksDetected, setLeaksDetected]     = useState('7');
  const [reportedComplaints, setReportedComplaints] = useState('4');
  const [showFilters, setShowFilters]         = useState(false);
  const [exportOpen, setExportOpen]           = useState(false);
  const [filters, setFilters] = useState({ village: 'all', district: 'all', timePeriod: '30days' });

  /* --- mock chart data --- */
  const waterQualityTrend = [
    { month: 'Jan', safe: 65, unsafe: 35 },
    { month: 'Feb', safe: 68, unsafe: 32 },
    { month: 'Mar', safe: 72, unsafe: 28 },
    { month: 'Apr', safe: 70, unsafe: 30 },
    { month: 'May', safe: 75, unsafe: 25 },
    { month: 'Jun', safe: 78, unsafe: 22 },
  ];

  const complaintStatusData = [
    { name: 'Resolved',    value: 15, color: '#10b981' },
    { name: 'In Progress', value: 8,  color: '#f59e0b' },
    { name: 'Pending',     value: 4,  color: '#ef4444' },
  ];

  const villageData = [
    { name: 'Village A', cases: 12, waterQuality: 'Poor', risk: 'High'   },
    { name: 'Village B', cases: 6,  waterQuality: 'Fair', risk: 'Medium' },
    { name: 'Village C', cases: 2,  waterQuality: 'Good', risk: 'Low'    },
    { name: 'Village D', cases: 15, waterQuality: 'Poor', risk: 'High'   },
    { name: 'Village E', cases: 4,  waterQuality: 'Fair', risk: 'Medium' },
  ];

  /* --- firebase fetch --- */
  useEffect(() => {
    const fetchValues = async () => {
      try {
        const snap1 = await get(ref(database, 'WaterSaved'));
        const snap2 = await get(ref(database, 'activeSensors'));
        const snap3 = await get(ref(database, 'fraudsDetected'));
        const snap4 = await get(ref(database, 'leaksDetected'));
        const snap5 = await get(ref(database, 'reportedComplaints'));
        if (snap1.exists()) setWaterSavedValue(snap1.val());
        if (snap2.exists()) setActiveSensors(snap2.val());
        if (snap3.exists()) setFraudsDetected(snap3.val());
        if (snap4.exists()) setLeaksDetected(snap4.val());
        if (snap5.exists()) setReportedComplaints(snap5.val());
      } catch (err) {
        console.error('Firebase fetch error:', err);
      }
    };
    fetchValues();
  }, []);

  /* --- handlers --- */
  const handleExport = (format) => {
    setExportOpen(false);
    alert(`Export as ${format.toUpperCase()} — Coming soon!`);
  };

  const riskBadge = (risk) => {
    const map = { High: 'badge-high', Medium: 'badge-medium', Low: 'badge-low' };
    const icons = { High: '🚨', Medium: '⚠️', Low: '✓' };
    return <span className={`db-badge ${map[risk]}`}>{icons[risk]} {risk}</span>;
  };

  const qualityBadge = (q) => {
    const map = { Poor: 'badge-poor', Fair: 'badge-fair', Good: 'badge-good' };
    return <span className={`db-badge ${map[q]}`}>{q}</span>;
  };

  const chartStroke = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const chartText   = dark ? '#94a3b8' : '#64748b';

  /* ─── JSX ─────────────────────────────────────────────────── */
  return (
    <div className={`db-root ${dark ? 'dark' : 'light'}`}>

      {/* ── HEADER ── */}
      <div className="db-header">
        <div className="db-header-title">
          <h1>Community Health Monitoring</h1>
          <p>Real-time water quality &amp; health data across villages</p>
        </div>

        {/* Button Row */}
        <div className="db-header-actions">
          {/* Filter button */}
          <button
            className="db-btn db-btn-outline"
            onClick={() => setShowFilters(!showFilters)}
            style={{ borderColor: currentColor, color: currentColor }}
          >
            <FaFilter /> Filters
          </button>

          {/* Export PDF */}
          <button
            className="db-btn"
            onClick={() => handleExport('pdf')}
            style={{ background: currentColor }}
          >
            <FaFilePdf /> Export PDF
          </button>

          {/* Export Excel */}
          <button
            className="db-btn db-btn-green"
            onClick={() => handleExport('excel')}
          >
            <FaFileExcel /> Export Excel
          </button>
        </div>
      </div>

      {/* ── FILTER PANEL ── */}
      {showFilters && (
        <div className="db-card db-filter-panel">
          <h3>Filters</h3>
          <div className="db-filter-grid">
            {[
              { label: 'Village', key: 'village', options: ['all','village-a','village-b','village-c','village-d','village-e'], labels: ['All Villages','Village A','Village B','Village C','Village D','Village E'] },
              { label: 'District', key: 'district', options: ['all','district-1','district-2','district-3'], labels: ['All Districts','District 1','District 2','District 3'] },
              { label: 'Time Period', key: 'timePeriod', options: ['7days','30days','90days','1year'], labels: ['Last 7 days','Last 30 days','Last 90 days','Last year'] },
            ].map(({ label, key, options, labels }) => (
              <div key={key} className="db-filter-field">
                <label>{label}</label>
                <select
                  value={filters[key]}
                  onChange={(e) => setFilters(prev => ({ ...prev, [key]: e.target.value }))}
                >
                  {options.map((o, i) => <option key={o} value={o}>{labels[i]}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── METRIC CARDS ── */}
      <div className="db-metrics-grid">
        <MetricCard
          dark={dark}
          icon={<FaTint />}
          label={t('waterSaved') || 'Water Saved'}
          value={waterSavedValue !== 'Loading…' ? `${waterSavedValue} L` : '—'}
          accentColor="#00d4ff"
        />
        <MetricCard
          dark={dark}
          icon={<FaExclamationCircle />}
          label={t('unsafeWaterSources') || 'Unsafe Sources'}
          value={leaksDetected}
          accentColor="#ef4444"
        />
        <MetricCard
          dark={dark}
          icon={<FaBiohazard />}
          label={t('detectedOutbreakRisks') || 'Outbreak Risks'}
          value={fraudsDetected}
          accentColor="#f59e0b"
        />
        <MetricCard
          dark={dark}
          icon={<FaCommentDots />}
          label={t('reportedComplaints') || 'Complaints'}
          value={reportedComplaints}
          accentColor="#8b5cf6"
        />
        <MetricCard
          dark={dark}
          icon={<FaBroadcastTower />}
          label={t('activeSensors') || 'Active Sensors'}
          value={activeSensors}
          accentColor="#10b981"
        />
      </div>

      {/* ── SPARKLINE BANNER ── */}
      <div className="db-sparkline-banner" style={{ background: currentColor }}>
        <div className="db-sparkline-info">
          <p className="db-sparkline-title">{t('outbreaksDetections') || 'Outbreak Detections'}</p>
          <p className="db-sparkline-sub">{t('monthlyStatistics') || 'Monthly statistics'}</p>
        </div>
        <div className="db-sparkline-value">
          <p className="db-sparkline-num">930 liters</p>
          <p className="db-sparkline-sub">{t('monthlyDetects') || 'Monthly detects'}</p>
        </div>
        <div className="db-sparkline-chart">
          <SparkLine
            currentColor={currentColor}
            id="column-sparkLine"
            height="80px"
            type="Column"
            data={SparklineAreaData}
            width="100%"
            color="rgba(255,255,255,0.8)"
          />
        </div>
      </div>

      {/* ── LIVE DETECTION NOTICE ── */}
      <div className={`db-notice ${dark ? 'dark' : 'light'}`}>
        <span className="db-notice-dot" />
        Live Detections Active — For technical support contact: <strong>8265096155</strong>
      </div>

      {/* ── POWER BI EMBED ── */}
      <div className="db-card db-powerbi-card">
        <h3 className="db-section-title">Live Analytics Report</h3>
        <div className="db-powerbi-frame">
          <iframe
            title="Power BI Report"
            src="https://app.powerbi.com/view?r=eyJrIjoiNjI0NDViMTgtM2QzMS00YzYzLTk4MDYtZWQyZmQzY2Y3ODg2IiwidCI6IjNmMzFkNjNkLWVkYzMtNDEzZS04N2U0LTQyMGU1M2ZkZDYyZiJ9"
            frameBorder="0"
            allowFullScreen
          />
        </div>
      </div>

      {/* ── CHARTS SECTION ── */}
      <div className="db-charts-grid">
        {/* Line Chart */}
        <div className="db-card">
          <h3 className="db-section-title">Water Quality Trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={waterQualityTrend} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartStroke} />
              <XAxis dataKey="month" tick={{ fill: chartText, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: chartText, fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: dark ? '#1e293b' : '#fff', border: 'none', borderRadius: 10, color: dark ? '#f1f5f9' : '#1e293b', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}
              />
              <Legend wrapperStyle={{ color: chartText, fontSize: 12 }} />
              <Line type="monotone" dataKey="safe"   stroke="#10b981" strokeWidth={3} dot={false} name="Safe Sources %" />
              <Line type="monotone" dataKey="unsafe" stroke="#ef4444" strokeWidth={3} dot={false} name="Unsafe Sources %" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="db-card">
          <h3 className="db-section-title">Complaint Status</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={complaintStatusData}
                cx="50%" cy="50%"
                outerRadius={90}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={true}
              >
                {complaintStatusData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: dark ? '#1e293b' : '#fff', border: 'none', borderRadius: 10, color: dark ? '#f1f5f9' : '#1e293b' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── VILLAGE TABLE ── */}
      <div className="db-card">
        <h3 className="db-section-title">Village Performance Overview</h3>
        <div className="db-table-wrapper">
          <table className="db-table">
            <thead>
              <tr>
                <th>Village</th>
                <th>Health Cases</th>
                <th>Water Quality</th>
                <th>Risk Level</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {villageData.map((v, i) => (
                <tr key={i}>
                  <td className="db-table-name">{v.name}</td>
                  <td>{v.cases}</td>
                  <td>{qualityBadge(v.waterQuality)}</td>
                  <td>{riskBadge(v.risk)}</td>
                  <td>{riskBadge(v.risk)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div className="db-footer">
        <p>JeevanRakshak — Community Water &amp; Health Monitoring Platform</p>
        <p>Built by Team Jeevan-Rakshak · Hackathon 2024</p>
      </div>
    </div>
  );
};

export default Dashboard;
