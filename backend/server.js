require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB, Incident, ActionItem, Timeline, Remediation } = require('./db');
const ai = require('./ai');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'HelioOps Backend' });
});

// ─── GET all incidents ─────────────────────────────────────────────────────────
app.get('/api/incidents', async (req, res) => {
  try {
    const incidents = await Incident.find().sort({ createdAt: -1 });
    // Attach counts
    const result = await Promise.all(incidents.map(async (inc) => {
      const id = inc._id;
      const [action_count, timeline_count, remediation_count] = await Promise.all([
        ActionItem.countDocuments({ incident_id: id }),
        Timeline.countDocuments({ incident_id: id }),
        Remediation.countDocuments({ incident_id: id })
      ]);
      return { ...inc.toObject(), action_count, timeline_count, remediation_count };
    }));
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET single incident with full details ──────────────────────────────────────
app.get('/api/incidents/:id', async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ success: false, error: 'Incident not found' });

    const [action_items, timeline, remediation_history] = await Promise.all([
      ActionItem.find({ incident_id: req.params.id }).sort({ createdAt: 1 }),
      Timeline.find({ incident_id: req.params.id }).sort({ createdAt: 1 }),
      Remediation.find({ incident_id: req.params.id }).sort({ createdAt: -1 })
    ]);

    res.json({ success: true, data: { ...incident.toObject(), action_items, timeline, remediation_history } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST parse incident text (AI preview — no DB save) ────────────────────────
app.post('/api/incidents/parse', async (req, res) => {
  const { text } = req.body;
  if (!text || text.trim().length < 10) {
    return res.status(400).json({ success: false, error: 'Input text is too short. Please provide a meaningful incident description (min 10 characters).' });
  }
  if (text.length > 5000) {
    return res.status(400).json({ success: false, error: 'Input is too long. Maximum 5000 characters.' });
  }

  const result = await ai.parseIncident(text);
  if (!result.success) return res.status(500).json(result);

  // Block if critical fields missing
  const critical = ['title', 'severity'];
  const criticalMissing = critical.filter(f => result.data.missing_fields?.includes(f) || !result.data[f]);
  if (criticalMissing.length > 0) {
    return res.status(422).json({
      success: false,
      error: `Could not determine required fields: ${criticalMissing.join(', ')}. Please add more detail.`,
      partial_data: result.data
    });
  }

  res.json({ success: true, data: result.data, raw_text: text });
});

// ─── POST create incident (user confirmed) ─────────────────────────────────────
app.post('/api/incidents', async (req, res) => {
  try {
    const { title, description, severity, impact, status, service, error_type, raw_input, missing_fields } = req.body;
    if (!title || !severity) return res.status(400).json({ success: false, error: 'title and severity are required' });
    if (!['P1', 'P2', 'P3', 'P4'].includes(severity)) return res.status(400).json({ success: false, error: 'severity must be P1, P2, P3, or P4' });

    const incident = await Incident.create({ title, description, severity, impact, status: status || 'open', service, error_type, raw_input, missing_fields: missing_fields || [] });
    res.status(201).json({ success: true, data: incident });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST extract action items ─────────────────────────────────────────────────
app.post('/api/incidents/:id/actions', async (req, res) => {
  try {
    const { document } = req.body;
    if (!document || document.trim().length < 10) return res.status(400).json({ success: false, error: 'Review document text is required (min 10 chars).' });

    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ success: false, error: 'Incident not found' });

    const result = await ai.extractActionItems(document);
    if (!result.success) return res.status(500).json(result);

    const items = result.data.action_items || [];
    if (items.length === 0) return res.status(422).json({ success: false, error: 'No action items could be extracted from the document.' });

    const docs = items.map(item => ({ incident_id: req.params.id, task: item.task, owner: item.owner || null, deadline: item.deadline || null, priority: item.priority || 'medium' }));
    await ActionItem.insertMany(docs);

    const saved = await ActionItem.find({ incident_id: req.params.id }).sort({ createdAt: 1 });
    res.json({ success: true, data: { action_items: saved, summary: result.data.summary } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST summarize logs into timeline ──────────────────────────────────────────
app.post('/api/incidents/:id/summarize', async (req, res) => {
  try {
    const { logs } = req.body;
    if (!logs || logs.trim().length < 10) return res.status(400).json({ success: false, error: 'Log content is required (min 10 chars).' });

    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ success: false, error: 'Incident not found' });

    const result = await ai.summarizeLogs(logs);
    if (!result.success) return res.status(500).json(result);

    const events = result.data.timeline || [];
    const docs = events.map(ev => ({ incident_id: req.params.id, event: ev.event, actor: ev.actor || null, event_time: ev.event_time || null, event_type: ev.event_type || 'info' }));
    await Timeline.insertMany(docs);

    const saved = await Timeline.find({ incident_id: req.params.id }).sort({ createdAt: 1 });
    res.json({ success: true, data: { timeline: saved, root_cause: result.data.root_cause, resolution_summary: result.data.resolution_summary } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST route incident to team ───────────────────────────────────────────────
app.post('/api/incidents/:id/route', async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ success: false, error: 'Incident not found' });

    const result = await ai.routeIncident(incident);
    if (!result.success) return res.status(500).json(result);

    const updated = await Incident.findByIdAndUpdate(req.params.id, { assigned_team: result.data.assigned_team, assigned_team_reason: result.data.reason }, { new: true });
    res.json({ success: true, data: { ...result.data, incident: updated } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST remediation status update ───────────────────────────────────────────
app.post('/api/incidents/:id/remediation', async (req, res) => {
  try {
    const { update_text, changed_by } = req.body;
    if (!update_text || update_text.trim().length < 5) return res.status(400).json({ success: false, error: 'Update text is required (min 5 chars).' });

    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ success: false, error: 'Incident not found' });

    const result = await ai.processRemediation(update_text, incident.status);
    if (!result.success) return res.status(500).json(result);

    const previousStatus = incident.status;
    const newStatus = result.data.new_status || previousStatus;

    // Update incident status
    await Incident.findByIdAndUpdate(req.params.id, { status: newStatus });

    // Create remediation record with full history
    const entry = await Remediation.create({
      incident_id: req.params.id,
      update_text,
      previous_status: previousStatus,
      new_status: newStatus,
      changed_by: changed_by || 'Unknown',
      ai_summary: result.data.ai_summary,
      key_actions: result.data.key_actions || [],
      next_steps: result.data.next_steps
    });

    const allHistory = await Remediation.find({ incident_id: req.params.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: { entry, all_history: allHistory, next_steps: result.data.next_steps } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE incident ───────────────────────────────────────────────────────────
app.delete('/api/incidents/:id', async (req, res) => {
  try {
    const incident = await Incident.findByIdAndDelete(req.params.id);
    if (!incident) return res.status(404).json({ success: false, error: 'Incident not found' });
    await Promise.all([
      ActionItem.deleteMany({ incident_id: req.params.id }),
      Timeline.deleteMany({ incident_id: req.params.id }),
      Remediation.deleteMany({ incident_id: req.params.id })
    ]);
    res.json({ success: true, message: 'Incident deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Error Handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ success: false, error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 HelioOps backend running on http://localhost:${PORT}`);
});
