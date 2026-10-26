import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const eventTypeIcon = { info: '🔵', alert: '🔴', action: '🟡', resolution: '🟢', escalation: '🟠' };
const eventTypeLabel = { info: 'Info', alert: 'Alert', action: 'Action', resolution: 'Resolved', escalation: 'Escalation' };

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function IncidentDetail({ addToast }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchIncident = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/incidents/${id}`);
      const data = await res.json();
      if (data.success) setIncident(data.data);
      else addToast(data.error, 'error');
    } catch {
      addToast('Failed to load incident', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIncident(); }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/incidents/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        addToast('Incident deleted');
        navigate('/');
      } else {
        addToast(data.error, 'error');
      }
    } catch {
      addToast('Delete failed', 'error');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) return (
    <div style={{ padding: 40 }}>
      <div className="ai-thinking"><div className="ai-spinner"></div>Loading incident from MongoDB...</div>
    </div>
  );

  if (!incident) return (
    <div className="empty-state">
      <div className="empty-state-icon">❌</div>
      <div className="empty-state-title">Incident not found</div>
      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/')}>← Back to Dashboard</button>
    </div>
  );

  const severityGradients = {
    P1: 'linear-gradient(135deg, rgba(255,59,92,0.12), transparent)',
    P2: 'linear-gradient(135deg, rgba(255,140,66,0.08), transparent)',
    P3: 'linear-gradient(135deg, rgba(255,209,102,0.08), transparent)',
    P4: 'linear-gradient(135deg, rgba(6,214,160,0.06), transparent)',
  };

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button className="back-btn" onClick={() => navigate('/')}>
          ← Back to Dashboard
        </button>
        <div className="page-header" style={{ marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
              <span className={`badge badge-${incident.severity?.toLowerCase()}`} style={{ fontSize: 13, padding: '4px 14px' }}>
                {incident.severity}
              </span>
              <span className={`badge badge-${incident.status}`} style={{ fontSize: 12, padding: '4px 12px' }}>
                {incident.status}
              </span>
              {incident.error_type && incident.error_type !== 'unknown' && (
                <span className="badge" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                  {incident.error_type}
                </span>
              )}
            </div>
            <h1 className="page-title" style={{ fontSize: 24 }}>{incident.title}</h1>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              Created {timeAgo(incident.createdAt)} · ID: <code>{incident._id}</code>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={fetchIncident}>🔄 Refresh</button>
            <button className="btn btn-danger" onClick={() => setShowDeleteConfirm(true)}>🗑️ Delete</button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="alert alert-error" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ <strong>Permanently delete this incident and all its data?</strong> This cannot be undone.</span>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button className="btn btn-sm btn-secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
            <button className="btn btn-sm btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Yes, Delete'}
            </button>
          </div>
        </div>
      )}

      {/* Hero Card */}
      <div className="card" style={{ background: severityGradients[incident.severity], marginBottom: 24, border: `1px solid var(--border)` }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: incident.description ? 20 : 0 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 4 }}>Service</div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{incident.service || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 4 }}>Impact</div>
            <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--text-secondary)' }}>{incident.impact || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 4 }}>Assigned Team</div>
            <div style={{ fontWeight: 600, fontSize: 15, color: incident.assigned_team ? 'var(--accent)' : 'var(--text-muted)' }}>
              {incident.assigned_team || 'Not routed yet'}
            </div>
          </div>
        </div>
        {incident.description && (
          <>
            <div className="divider" style={{ margin: '16px 0' }}></div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              {incident.description}
            </div>
          </>
        )}
        {incident.assigned_team_reason && (
          <div className="alert alert-info" style={{ marginTop: 12, fontSize: 12 }}>
            🔀 Routing reason: {incident.assigned_team_reason}
          </div>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="tabs">
        {[
          { id: 'overview', label: `📋 Actions (${incident.action_items?.length || 0})` },
          { id: 'timeline', label: `🕐 Timeline (${incident.timeline?.length || 0})` },
          { id: 'remediation', label: `🔧 Remediation (${incident.remediation_history?.length || 0})` },
        ].map(tab => (
          <div key={tab.id} className={`tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </div>
        ))}
      </div>

      {/* Action Items Tab */}
      {activeTab === 'overview' && (
        <div className="slide-in">
          {incident.action_items?.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">No action items yet</div>
              <div className="empty-state-desc">Go to AI Tools → Extract Actions to pull action items from a review doc</div>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate(`/new?tab=actions`)}>
                📋 Extract Actions
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div className="section-title" style={{ marginBottom: 0 }}>Action Items</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {incident.action_items.filter(a => a.status === 'completed').length}/{incident.action_items.length} completed
                </div>
              </div>
              {incident.action_items.map((item, i) => (
                <div key={item._id || i} className="action-item">
                  <div className="action-item-header">
                    <div className="action-task">{i + 1}. {item.task}</div>
                    <span className={`badge badge-${item.status === 'completed' ? 'resolved' : 'investigating'}`} style={{ fontSize: 10 }}>
                      {item.status}
                    </span>
                  </div>
                  <div className="action-meta">
                    {item.owner && <div className="action-meta-item">👤 <strong>{item.owner}</strong></div>}
                    {item.deadline && <div className="action-meta-item">📅 {item.deadline}</div>}
                    <div className="action-meta-item" style={{ color: item.priority === 'high' ? 'var(--p1)' : item.priority === 'medium' ? 'var(--p3)' : 'var(--p4)' }}>
                      ● {item.priority} priority
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Timeline Tab */}
      {activeTab === 'timeline' && (
        <div className="slide-in">
          {incident.timeline?.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🕐</div>
              <div className="empty-state-title">No timeline yet</div>
              <div className="empty-state-desc">Go to AI Tools → Log Summary to generate a timeline from raw logs</div>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate(`/new?tab=logs`)}>
                📊 Generate Timeline
              </button>
            </div>
          ) : (
            <>
              <div className="section-title">Incident Timeline</div>
              <div className="timeline">
                {incident.timeline.map((ev, i) => (
                  <div key={ev._id || i} className="timeline-item">
                    <div className={`timeline-dot type-${ev.event_type}`}></div>
                    <div className="timeline-content">
                      <div className="timeline-event-header">
                        <div className="timeline-event">
                          {eventTypeIcon[ev.event_type]} {ev.event}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                          <span className="badge" style={{ fontSize: 9, background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                            {eventTypeLabel[ev.event_type]}
                          </span>
                          {ev.event_time && <div className="timeline-time">{ev.event_time}</div>}
                        </div>
                      </div>
                      {ev.actor && <div className="timeline-actor">↳ {ev.actor}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Remediation Tab */}
      {activeTab === 'remediation' && (
        <div className="slide-in">
          {incident.remediation_history?.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔧</div>
              <div className="empty-state-title">No remediation history yet</div>
              <div className="empty-state-desc">Go to AI Tools → Remediation to submit a natural-language status update</div>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate(`/new?tab=remediation`)}>
                🔧 Add Update
              </button>
            </div>
          ) : (
            <>
              <div className="section-title">Remediation History (Change Log)</div>
              {incident.remediation_history.map((h, i) => (
                <div key={h._id || i} className="remediation-entry">
                  <div className="remediation-status-change">
                    <span className={`badge badge-${h.previous_status}`} style={{ fontSize: 10 }}>{h.previous_status}</span>
                    <span className="status-arrow">→</span>
                    <span className={`badge badge-${h.new_status}`} style={{ fontSize: 10 }}>{h.new_status}</span>
                    {i === 0 && <span className="badge" style={{ background: 'var(--primary-dim)', color: 'var(--primary)', fontSize: 9 }}>Latest</span>}
                  </div>
                  <div className="remediation-summary">{h.ai_summary}</div>
                  {h.key_actions?.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      {h.key_actions.map((ka, j) => (
                        <div key={j} style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>• {ka}</div>
                      ))}
                    </div>
                  )}
                  {h.next_steps && (
                    <div style={{ fontSize: 12, color: 'var(--primary)', marginTop: 8 }}>⏭ {h.next_steps}</div>
                  )}
                  <div className="remediation-meta">
                    <span>👤 {h.changed_by}</span>
                    <span>{new Date(h.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Quick Action Footer */}
      <div style={{ marginTop: 32, padding: '16px 0', borderTop: '1px solid var(--border)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center', marginRight: 8 }}>Quick actions:</div>
        <button className="btn btn-sm btn-secondary" onClick={() => { navigate('/new?tab=actions'); }}>📋 Extract Actions</button>
        <button className="btn btn-sm btn-secondary" onClick={() => { navigate('/new?tab=logs'); }}>📊 Log Summary</button>
        <button className="btn btn-sm btn-secondary" onClick={() => { navigate('/new?tab=route'); }}>🔀 Route Incident</button>
        <button className="btn btn-sm btn-secondary" onClick={() => { navigate('/new?tab=remediation'); }}>🔧 Add Update</button>
      </div>
    </div>
  );
}
