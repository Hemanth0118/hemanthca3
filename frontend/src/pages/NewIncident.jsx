import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const EXAMPLE_INCIDENT = `At 14:32 UTC the payment service started returning 503 errors. 
Approximately 40% of checkout requests are failing. Error rate spiked from <1% to 67% on the /api/checkout endpoint.
Database connection pool appears exhausted — max connections hit. Revenue impact estimated at $12,000/minute.
On-call engineer paged at 14:38 UTC.`;

const EXAMPLE_REVIEW = `Post-Incident Review — Payment Service Outage

Root Cause: Database connection pool exhaustion due to a missing connection timeout in the new deployment.

Action Items:
1. Add connection timeout config to all database clients — John (DevOps) — due by Oct 25
2. Set up connection pool monitoring alerts — Sarah (SRE) — by end of this week
3. Update runbook to include connection pool checks — Mike (Eng) — due next sprint
4. Schedule chaos engineering exercise for payment service — Team — Q4 2024
5. Review PR approval process to catch config issues — Engineering Manager — ongoing`;

const EXAMPLE_LOGS = `[14:32:01] WARN  payment-service: DB connection timeout after 5000ms
[14:32:03] ERROR payment-service: connection pool exhausted (100/100 connections active)
[14:32:05] ERROR payment-service: /api/checkout - failed with ECONNREFUSED
[14:33:00] ALERT monitoring: payment_error_rate > 60% (current: 67%)
[14:33:10] INFO  on-call: engineer paged via PagerDuty
[14:35:00] INFO  ops: rolling restart initiated on payment-service-pod-2
[14:37:30] INFO  ops: connection pool partially freed (45/100 active)
[14:40:00] INFO  ops: deployed hotfix v2.1.4 with connection timeout=2000ms
[14:42:00] INFO  payment-service: error rate normalizing (12% → 3%)
[14:45:00] INFO  monitoring: payment_error_rate < 1% — incident mitigated`;

export default function NewIncident({ addToast }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'parse');

  // Parse state
  const [incidentText, setIncidentText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [parseError, setParseError] = useState('');
  const [saving, setSaving] = useState(false);

  // After save — for action/log/route/remediation tabs
  const [savedIncidentId, setSavedIncidentId] = useState('');
  const [incidentIdInput, setIncidentIdInput] = useState('');
  const [incidentsList, setIncidentsList] = useState([]);

  // Fetch incidents list so user can easily pick an incident
  const loadIncidents = async () => {
    try {
      const res = await fetch('/api/incidents');
      const data = await res.json();
      if (data.success && data.data && data.data.length > 0) {
        setIncidentsList(data.data);
        setIncidentIdInput(prev => prev || data.data[0]._id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, []);

  // Actions
  const [reviewDoc, setReviewDoc] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [actionResult, setActionResult] = useState(null);

  // Logs
  const [logsText, setLogsText] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const [timelineResult, setTimelineResult] = useState(null);

  // Route
  const [routing, setRouting] = useState(false);
  const [routeResult, setRouteResult] = useState(null);

  // Remediation
  const [updateText, setUpdateText] = useState('');
  const [changedBy, setChangedBy] = useState('');
  const [remediating, setRemediating] = useState(false);
  const [remediationResult, setRemediationResult] = useState(null);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const activeId = savedIncidentId || incidentIdInput;

  // ── Parse Incident ──────────────────────────────────────────────────────────
  const handleParse = async () => {
    if (!incidentText.trim()) return;
    setParsing(true);
    setParseError('');
    setParsed(null);
    try {
      const res = await fetch('/api/incidents/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: incidentText })
      });
      const data = await res.json();
      if (data.success) {
        setParsed(data.data);
      } else {
        setParseError(data.error || 'Parsing failed');
        if (data.partial_data) setParsed(data.partial_data);
      }
    } catch {
      setParseError('Network error — is the backend running?');
    } finally {
      setParsing(false);
    }
  };

  const handleConfirmSave = async () => {
    if (!parsed) return;
    setSaving(true);
    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...parsed, raw_input: incidentText })
      });
      const data = await res.json();
      if (data.success) {
        setSavedIncidentId(data.data._id);
        addToast(`Incident "${data.data.title}" saved to MongoDB ✅`);
        navigate(`/incident/${data.data._id}`);
      } else {
        addToast(data.error, 'error');
      }
    } catch {
      addToast('Save failed — network error', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Extract Actions ─────────────────────────────────────────────────────────
  const handleExtractActions = async () => {
    if (!reviewDoc.trim() || !activeId) return;
    setExtracting(true);
    setActionResult(null);
    try {
      const res = await fetch(`/api/incidents/${activeId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document: reviewDoc })
      });
      const data = await res.json();
      if (data.success) {
        setActionResult(data.data);
        addToast(`Extracted ${data.data.action_items.length} action items ✅`);
      } else {
        addToast(data.error, 'error');
      }
    } catch {
      addToast('Network error', 'error');
    } finally {
      setExtracting(false);
    }
  };

  // ── Summarize Logs ──────────────────────────────────────────────────────────
  const handleSummarizeLogs = async () => {
    if (!logsText.trim() || !activeId) return;
    setSummarizing(true);
    setTimelineResult(null);
    try {
      const res = await fetch(`/api/incidents/${activeId}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: logsText })
      });
      const data = await res.json();
      if (data.success) {
        setTimelineResult(data.data);
        addToast(`Generated ${data.data.timeline.length}-event timeline ✅`);
      } else {
        addToast(data.error, 'error');
      }
    } catch {
      addToast('Network error', 'error');
    } finally {
      setSummarizing(false);
    }
  };

  // ── Route Incident ──────────────────────────────────────────────────────────
  const handleRoute = async () => {
    if (!activeId) return;
    setRouting(true);
    setRouteResult(null);
    try {
      const res = await fetch(`/api/incidents/${activeId}/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        setRouteResult(data.data);
        addToast(`Routed to ${data.data.assigned_team} ✅`);
      } else {
        addToast(data.error, 'error');
      }
    } catch {
      addToast('Network error', 'error');
    } finally {
      setRouting(false);
    }
  };

  // ── Remediation ─────────────────────────────────────────────────────────────
  const handleRemediation = async () => {
    if (!updateText.trim() || !activeId) return;
    setRemediating(true);
    setRemediationResult(null);
    try {
      const res = await fetch(`/api/incidents/${activeId}/remediation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ update_text: updateText, changed_by: changedBy })
      });
      const data = await res.json();
      if (data.success) {
        setRemediationResult(data.data);
        addToast('Remediation record saved to MongoDB ✅');
      } else {
        addToast(data.error, 'error');
      }
    } catch {
      addToast('Network error', 'error');
    } finally {
      setRemediating(false);
    }
  };

  const eventTypeIcon = { info: '🔵', alert: '🔴', action: '🟡', resolution: '🟢', escalation: '🟠' };
  const priorityColor = { high: 'var(--p1)', medium: 'var(--p3)', low: 'var(--p4)' };

  const renderIncidentSelector = () => (
    <div className="form-group">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <label className="form-label" style={{ marginBottom: 0 }}>Target Incident (MongoDB)</label>
        {incidentsList.length > 0 && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {incidentsList.length} incident{incidentsList.length > 1 ? 's' : ''} in database
          </span>
        )}
      </div>
      {incidentsList.length > 0 ? (
        <select
          className="form-input"
          value={activeId}
          onChange={e => setIncidentIdInput(e.target.value)}
          style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', cursor: 'pointer' }}
        >
          <option value="" style={{ background: '#0f172a' }}>-- Select an incident --</option>
          {incidentsList.map(inc => (
            <option key={inc._id} value={inc._id} style={{ background: '#0f172a' }}>
              [{inc.severity}] {inc.title} ({inc._id.slice(-6)})
            </option>
          ))}
        </select>
      ) : (
        <input
          className="form-input"
          placeholder="Paste incident _id from MongoDB (or save one from Parse tab first)"
          value={savedIncidentId || incidentIdInput}
          onChange={e => setIncidentIdInput(e.target.value)}
          readOnly={!!savedIncidentId}
        />
      )}
      {activeId && (
        <div style={{ fontSize: 11, color: '#38bdf8', marginTop: 4 }}>
          Target ID: <code style={{ color: '#4ade80' }}>{activeId}</code>
        </div>
      )}
    </div>
  );

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Incident Tools</h1>
          <p className="page-subtitle">Schema-guided AI extraction, routing, and tracking</p>
        </div>
        {(savedIncidentId) && (
          <button className="btn btn-secondary" onClick={() => navigate(`/incident/${savedIncidentId}`)}>
            📂 View Incident
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[
          { id: 'parse', label: '🎤 Parse Incident' },
          { id: 'actions', label: '📋 Extract Actions' },
          { id: 'logs', label: '📊 Log Summary' },
          { id: 'route', label: '🔀 Route Incident' },
          { id: 'remediation', label: '🔧 Remediation' },
        ].map(tab => (
          <div key={tab.id} className={`tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </div>
        ))}
      </div>

      {/* ── PARSE TAB ── */}
      {activeTab === 'parse' && (
        <div className="slide-in">
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="section-title" style={{ marginBottom: 0 }}>🎤 Incident Voice / Text Note</div>
              <button className="btn btn-sm btn-secondary" onClick={() => setIncidentText(EXAMPLE_INCIDENT)}>Load Example</button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
              Paste or dictate an incident note. AI will extract severity, impact, service, status, and error type.
            </p>
            <div className="form-group">
              <textarea
                className="form-textarea"
                style={{ minHeight: 160 }}
                placeholder="e.g. Payment service is down, 503 errors on checkout, affecting 40% of users..."
                value={incidentText}
                onChange={e => setIncidentText(e.target.value)}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
                {incidentText.length}/5000 characters
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" onClick={handleParse} disabled={parsing || !incidentText.trim()}>
                {parsing ? '🤖 Parsing...' : '🤖 Parse with AI'}
              </button>
              {incidentText && <button className="btn btn-secondary" onClick={() => { setIncidentText(''); setParsed(null); setParseError(''); }}>Clear</button>}
            </div>
          </div>

          {parsing && (
            <div className="ai-thinking">
              <div className="ai-spinner"></div>
              Gemini AI is analyzing your incident note...
            </div>
          )}

          {parseError && (
            <div className="alert alert-error">
              <span>⚠️</span>
              <div>
                <strong>Parsing Error</strong><br />
                <span style={{ fontSize: 13 }}>{parseError}</span>
              </div>
            </div>
          )}

          {parsed && (
            <div className="preview-card fade-in">
              <div className="preview-header">
                <div className="preview-label">
                  <span>✨</span> AI Extracted — Preview Before Saving
                </div>
                {parsed.missing_fields?.length > 0 && (
                  <span className="badge" style={{ background: 'var(--p2-dim)', color: 'var(--p2)' }}>
                    ⚠ {parsed.missing_fields.length} missing
                  </span>
                )}
              </div>

              {parsed.missing_fields?.length > 0 && (
                <div className="missing-warning">
                  ⚠️ Could not determine: <strong>{parsed.missing_fields.join(', ')}</strong>. Please review before saving.
                </div>
              )}

              <div className="preview-fields">
                <div className="preview-field">
                  <div className="preview-field-label">Title</div>
                  <div className="preview-field-value">{parsed.title || <em style={{ color: 'var(--p1)' }}>Missing</em>}</div>
                </div>
                <div className="preview-field">
                  <div className="preview-field-label">Severity</div>
                  <div className="preview-field-value">
                    {parsed.severity
                      ? <span className={`badge badge-${parsed.severity.toLowerCase()}`}>{parsed.severity}</span>
                      : <em style={{ color: 'var(--p1)' }}>Missing</em>}
                  </div>
                </div>
                <div className="preview-field">
                  <div className="preview-field-label">Status</div>
                  <div className="preview-field-value">
                    <span className={`badge badge-${parsed.status}`}>{parsed.status}</span>
                  </div>
                </div>
                <div className="preview-field">
                  <div className="preview-field-label">Service</div>
                  <div className="preview-field-value">{parsed.service || '—'}</div>
                </div>
                <div className="preview-field">
                  <div className="preview-field-label">Error Type</div>
                  <div className="preview-field-value">{parsed.error_type || '—'}</div>
                </div>
                <div className="preview-field full-width">
                  <div className="preview-field-label">Impact</div>
                  <div className="preview-field-value">{parsed.impact || '—'}</div>
                </div>
                <div className="preview-field full-width">
                  <div className="preview-field-label">Description</div>
                  <div className="preview-field-value" style={{ fontSize: 13, lineHeight: 1.6 }}>{parsed.description || '—'}</div>
                </div>
              </div>

              <div className="preview-actions">
                <button className="btn btn-secondary" onClick={() => setParsed(null)}>✏️ Re-parse</button>
                <button className="btn btn-success" onClick={handleConfirmSave} disabled={saving || !parsed.severity || !parsed.title}>
                  {saving ? '💾 Saving...' : '✅ Confirm & Save to MongoDB'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ACTIONS TAB ── */}
      {activeTab === 'actions' && (
        <div className="slide-in">
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="section-title" style={{ marginBottom: 0 }}>📋 Extract Action Items from Review Doc</div>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  setReviewDoc(EXAMPLE_REVIEW);
                  if (!activeId && incidentsList.length > 0) setIncidentIdInput(incidentsList[0]._id);
                }}
              >
                Load Example
              </button>
            </div>
            {renderIncidentSelector()}
            <div className="form-group">
              <label className="form-label">Post-Incident Review Document</label>
              <textarea
                className="form-textarea"
                style={{ minHeight: 200 }}
                placeholder="Paste your post-incident review document, meeting notes, or review summary..."
                value={reviewDoc}
                onChange={e => setReviewDoc(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" onClick={handleExtractActions} disabled={extracting || !reviewDoc.trim() || !activeId}>
              {extracting ? '🤖 Extracting...' : '🤖 Extract Action Items'}
            </button>
          </div>

          {extracting && <div className="ai-thinking"><div className="ai-spinner"></div>AI is identifying action items, owners, and deadlines...</div>}

          {actionResult && (
            <div className="card fade-in">
              <div className="section-title">✅ Extracted {actionResult.action_items.length} Action Items</div>
              {actionResult.summary && <div className="alert alert-info" style={{ marginBottom: 16 }}>💡 {actionResult.summary}</div>}
              {actionResult.action_items.map((item, i) => (
                <div key={item._id || i} className="action-item">
                  <div className="action-item-header">
                    <div className="action-task">{i + 1}. {item.task}</div>
                    <span className="badge" style={{ background: 'transparent', color: priorityColor[item.priority], border: `1px solid ${priorityColor[item.priority]}`, opacity: 0.8 }}>
                      {item.priority}
                    </span>
                  </div>
                  <div className="action-meta">
                    {item.owner && <div className="action-meta-item">👤 <strong>{item.owner}</strong></div>}
                    {item.deadline && <div className="action-meta-item">📅 {item.deadline}</div>}
                    <div className="action-meta-item">
                      <span className={`badge badge-${item.status === 'pending' ? 'investigating' : 'resolved'}`} style={{ fontSize: 10 }}>{item.status}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── LOGS TAB ── */}
      {activeTab === 'logs' && (
        <div className="slide-in">
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="section-title" style={{ marginBottom: 0 }}>📊 Log Summarizer → Timeline</div>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  setLogsText(EXAMPLE_LOGS);
                  if (!activeId && incidentsList.length > 0) setIncidentIdInput(incidentsList[0]._id);
                }}
              >
                Load Example
              </button>
            </div>
            {renderIncidentSelector()}
            <div className="form-group">
              <label className="form-label">Raw Operational Logs / Incident Notes</label>
              <textarea className="form-textarea" style={{ minHeight: 220, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }} placeholder="Paste raw server logs, monitoring alerts, or incident notes..." value={logsText} onChange={e => setLogsText(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={handleSummarizeLogs} disabled={summarizing || !logsText.trim() || !activeId}>
              {summarizing ? '🤖 Building Timeline...' : '🤖 Generate Timeline'}
            </button>
          </div>

          {summarizing && <div className="ai-thinking"><div className="ai-spinner"></div>AI is building a structured incident timeline...</div>}

          {timelineResult && (
            <div className="card fade-in">
              <div className="section-title">📅 Incident Timeline ({timelineResult.timeline.length} events)</div>
              {timelineResult.root_cause && (
                <div className="alert alert-error" style={{ marginBottom: 16 }}>🔍 <strong>Root Cause:</strong> {timelineResult.root_cause}</div>
              )}
              {timelineResult.resolution_summary && (
                <div className="alert alert-success" style={{ marginBottom: 16 }}>✅ <strong>Resolution:</strong> {timelineResult.resolution_summary}</div>
              )}
              <div className="timeline">
                {timelineResult.timeline.map((ev, i) => (
                  <div key={ev._id || i} className="timeline-item">
                    <div className={`timeline-dot type-${ev.event_type}`}></div>
                    <div className="timeline-content">
                      <div className="timeline-event-header">
                        <div className="timeline-event">{eventTypeIcon[ev.event_type]} {ev.event}</div>
                        {ev.event_time && <div className="timeline-time">{ev.event_time}</div>}
                      </div>
                      {ev.actor && <div className="timeline-actor">by {ev.actor}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ROUTE TAB ── */}
      {activeTab === 'route' && (
        <div className="slide-in">
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title">🔀 Route Incident to Team</div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              AI analyzes the incident's service, severity, and error type to assign it to the best team. The DB record will be updated.
            </p>
            {renderIncidentSelector()}
            <button className="btn btn-primary" onClick={handleRoute} disabled={routing || !activeId}>
              {routing ? '🤖 Routing...' : '🤖 Auto-Route Incident'}
            </button>
          </div>

          {routing && <div className="ai-thinking"><div className="ai-spinner"></div>AI is analyzing incident attributes to select the right team...</div>}

          {routeResult && (
            <div className="fade-in">
              <div className="route-result">
                <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Assigned Team</div>
                <div className="route-team">👥 {routeResult.assigned_team}</div>
                <div className="route-reason">{routeResult.reason}</div>
                {routeResult.escalate_to && (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                    📣 Also loop in: <strong style={{ color: 'var(--p2)' }}>{routeResult.escalate_to}</strong>
                  </div>
                )}
                {routeResult.priority_action && (
                  <div className="alert alert-info">
                    ⚡ <strong>First action:</strong> {routeResult.priority_action}
                  </div>
                )}
              </div>
              <div className="alert alert-success" style={{ marginTop: 12 }}>
                ✅ MongoDB updated — incident.assigned_team saved
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── REMEDIATION TAB ── */}
      {activeTab === 'remediation' && (
        <div className="slide-in">
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title">🔧 Remediation Status Update</div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Write a natural-language status update. AI extracts the new status, creates a history entry, and updates MongoDB.
            </p>
            {renderIncidentSelector()}
            <div className="form-group">
              <label className="form-label">Status Update (natural language)</label>
              <textarea className="form-textarea" style={{ minHeight: 120 }} placeholder="e.g. We deployed the hotfix v2.1.4 and rolled back the bad config. Error rates are back to normal. Marking as mitigated." value={updateText} onChange={e => setUpdateText(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Your Name</label>
              <input className="form-input" placeholder="e.g. John Smith (SRE)" value={changedBy} onChange={e => setChangedBy(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={handleRemediation} disabled={remediating || !updateText.trim() || !activeId}>
              {remediating ? '🤖 Processing...' : '🤖 Submit Update'}
            </button>
          </div>

          {remediating && <div className="ai-thinking"><div className="ai-spinner"></div>AI is analyzing your status update and extracting key information...</div>}

          {remediationResult && (
            <div className="card fade-in">
              <div className="section-title">✅ Remediation Recorded</div>
              <div className="remediation-entry" style={{ border: '1px solid var(--border-active)', marginBottom: 16 }}>
                <div className="remediation-status-change">
                  <span className={`badge badge-${remediationResult.entry.previous_status}`}>{remediationResult.entry.previous_status}</span>
                  <span className="status-arrow">→</span>
                  <span className={`badge badge-${remediationResult.entry.new_status}`}>{remediationResult.entry.new_status}</span>
                </div>
                <div className="remediation-summary">💡 {remediationResult.entry.ai_summary}</div>
                {remediationResult.next_steps && (
                  <div className="alert alert-info" style={{ marginTop: 10 }}>
                    ⏭️ <strong>Next steps:</strong> {remediationResult.next_steps}
                  </div>
                )}
                <div className="remediation-meta">
                  <span>By: {remediationResult.entry.changed_by}</span>
                  <span>Saved to MongoDB ✅</span>
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>📜 Full History ({remediationResult.all_history.length} entries)</div>
              {remediationResult.all_history.map((h, i) => (
                <div key={h._id || i} className="remediation-entry">
                  <div className="remediation-status-change">
                    <span className={`badge badge-${h.previous_status}`} style={{ fontSize: 10 }}>{h.previous_status}</span>
                    <span className="status-arrow">→</span>
                    <span className={`badge badge-${h.new_status}`} style={{ fontSize: 10 }}>{h.new_status}</span>
                  </div>
                  <div className="remediation-summary">{h.ai_summary}</div>
                  <div className="remediation-meta">
                    <span>{h.changed_by}</span>
                    <span>{new Date(h.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
