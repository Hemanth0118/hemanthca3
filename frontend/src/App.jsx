import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import NewIncident from './pages/NewIncident';
import IncidentDetail from './pages/IncidentDetail';

const navItems = [
  { path: '/', icon: '⚡', label: 'Dashboard' },
  { path: '/new', icon: '🚨', label: 'New Incident' },
];

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">
          <div className="logo-icon">☀</div>
          <div>
            <div className="logo-text">HelioOps</div>
            <div className="logo-sub">Incident Command</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Navigation</div>
        {navItems.map(item => (
          <div
            key={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </div>
        ))}

        <div className="nav-section-label" style={{ marginTop: 16 }}>Features</div>
        <div className="nav-item" onClick={() => navigate('/new?tab=parse')} style={{ fontSize: 13, paddingLeft: 20 }}>
          <span className="nav-icon">🎤</span> Parse Note
        </div>
        <div className="nav-item" onClick={() => navigate('/new?tab=actions')} style={{ fontSize: 13, paddingLeft: 20 }}>
          <span className="nav-icon">📋</span> Extract Actions
        </div>
        <div className="nav-item" onClick={() => navigate('/new?tab=logs')} style={{ fontSize: 13, paddingLeft: 20 }}>
          <span className="nav-icon">📊</span> Log Summary
        </div>
        <div className="nav-item" onClick={() => navigate('/new?tab=route')} style={{ fontSize: 13, paddingLeft: 20 }}>
          <span className="nav-icon">🔀</span> Route Incident
        </div>
        <div className="nav-item" onClick={() => navigate('/new?tab=remediation')} style={{ fontSize: 13, paddingLeft: 20 }}>
          <span className="nav-icon">🔧</span> Remediation
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="status-indicator">
          <div className="status-dot"></div>
          <span>AI Engine Active</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
          Powered by Gemini 2.0
        </div>
      </div>
    </aside>
  );
}

function Toast({ toasts, removeToast }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`} onClick={() => removeToast(t.id)}>
          <span>{t.type === 'success' ? '✅' : '❌'}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <div className="page-container">
            <Routes>
              <Route path="/" element={<Dashboard addToast={addToast} />} />
              <Route path="/new" element={<NewIncident addToast={addToast} />} />
              <Route path="/incident/:id" element={<IncidentDetail addToast={addToast} />} />
            </Routes>
          </div>
        </main>
      </div>
      <Toast toasts={toasts} removeToast={removeToast} />
    </BrowserRouter>
  );
}
