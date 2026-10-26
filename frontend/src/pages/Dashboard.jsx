import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const severityColors = { P1: 'p1', P2: 'p2', P3: 'p3', P4: 'p4' };
const statusColors = { open: 'open', investigating: 'investigating', mitigated: 'mitigated', resolved: 'resolved' };

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Dashboard({ addToast }) {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/incidents');
      const data = await res.json();
      if (data.success) setIncidents(data.data);
    } catch {
      addToast('Failed to load incidents', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIncidents(); }, []);

  const stats = {
    total: incidents.length,
    critical: incidents.filter(i => i.severity === 'P1').length,
    open: incidents.filter(i => ['open', 'investigating'].includes(i.status)).length,
    resolved: incidents.filter(i => i.status === 'resolved').length,
  };

  const filtered = incidents.filter(inc => {
    const matchFilter = filter === 'all' || inc.severity === filter || inc.status === filter;
    const matchSearch = !search || inc.title?.toLowerCase().includes(search.toLowerCase()) || inc.service?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Incident Command</h1>
          <p className="page-subtitle">Real-time AI-powered operations dashboard</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/new')}>
          🚨 New Incident
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card stat-total">
          <div className="stat-label">Total Incidents</div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{stats.total}</div>
          <div className="stat-sub">All time</div>
        </div>
        <div className="stat-card stat-critical">
          <div className="stat-label">P1 Critical</div>
          <div className="stat-value" style={{ color: 'var(--p1)' }}>{stats.critical}</div>
          <div className="stat-sub">Immediate action</div>
        </div>
        <div className="stat-card stat-open">
          <div className="stat-label">Active</div>
          <div className="stat-value" style={{ color: 'var(--p3)' }}>{stats.open}</div>
          <div className="stat-sub">Open + Investigating</div>
        </div>
        <div className="stat-card stat-resolved">
          <div className="stat-label">Resolved</div>
          <div className="stat-value" style={{ color: 'var(--p4)' }}>{stats.resolved}</div>
          <div className="stat-sub">Closed</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="form-input"
          style={{ width: 260, height: 38 }}
          placeholder="🔍  Search incidents..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {['all', 'P1', 'P2', 'P3', 'P4', 'open', 'investigating', 'mitigated', 'resolved'].map(f => (
          <button
            key={f}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
        <button className="btn btn-sm btn-secondary" onClick={fetchIncidents} style={{ marginLeft: 'auto' }}>
          🔄 Refresh
        </button>
      </div>

      {/* Incidents Grid */}
      {loading ? (
        <div className="ai-thinking">
          <div className="ai-spinner"></div>
          Loading incidents from MongoDB...
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🛸</div>
          <div className="empty-state-title">{incidents.length === 0 ? 'No incidents yet' : 'No matches found'}</div>
          <div className="empty-state-desc">
            {incidents.length === 0
              ? 'Click "New Incident" to parse your first incident note with AI'
              : 'Try adjusting your search or filter'}
          </div>
          {incidents.length === 0 && (
            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/new')}>
              🚨 Create First Incident
            </button>
          )}
        </div>
      ) : (
        <div className="incidents-grid">
          {filtered.map(inc => (
            <div
              key={inc._id}
              className={`incident-card severity-${inc.severity}`}
              onClick={() => navigate(`/incident/${inc._id}`)}
            >
              <div className="incident-card-header">
                <div className="incident-card-title">{inc.title}</div>
                <span className={`badge badge-${severityColors[inc.severity]}`}>{inc.severity}</span>
              </div>
              <div className="incident-card-meta">
                <span className={`badge badge-${statusColors[inc.status]}`}>{inc.status}</span>
                {inc.service && <span className="badge" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>{inc.service}</span>}
                {inc.error_type && inc.error_type !== 'unknown' && (
                  <span className="badge" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                    {inc.error_type}
                  </span>
                )}
              </div>
              {inc.impact && <div className="incident-card-info">💥 {inc.impact}</div>}
              {inc.assigned_team && (
                <div className="incident-card-info" style={{ color: 'var(--primary)', marginTop: 4 }}>
                  👥 {inc.assigned_team}
                </div>
              )}
              <div className="incident-card-footer">
                <div className="incident-stats">
                  <div className="incident-stat"><span>📋</span><span>{inc.action_count || 0} actions</span></div>
                  <div className="incident-stat"><span>🕐</span><span>{inc.timeline_count || 0} events</span></div>
                  <div className="incident-stat"><span>🔧</span><span>{inc.remediation_count || 0} updates</span></div>
                </div>
                <div className="incident-time">{timeAgo(inc.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
