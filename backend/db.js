const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connected to Atlas');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }
};

// ─── Incident Schema ──────────────────────────────────────────────────────────
const incidentSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 200 },
  description: { type: String },
  severity: { type: String, required: true, enum: ['P1', 'P2', 'P3', 'P4'] },
  impact: { type: String },
  status: {
    type: String,
    enum: ['open', 'investigating', 'mitigated', 'resolved'],
    default: 'open'
  },
  service: { type: String },
  error_type: {
    type: String,
    enum: ['infrastructure', 'application', 'security', 'performance', 'data', 'unknown'],
    default: 'unknown'
  },
  assigned_team: { type: String },
  assigned_team_reason: { type: String },
  raw_input: { type: String },
  missing_fields: [{ type: String }]
}, { timestamps: true });

// ─── Action Item Schema ───────────────────────────────────────────────────────
const actionItemSchema = new mongoose.Schema({
  incident_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', required: true },
  task: { type: String, required: true },
  owner: { type: String },
  deadline: { type: String },
  priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'blocked'],
    default: 'pending'
  }
}, { timestamps: true });

// ─── Timeline Event Schema ────────────────────────────────────────────────────
const timelineSchema = new mongoose.Schema({
  incident_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', required: true },
  event: { type: String, required: true },
  actor: { type: String },
  event_time: { type: String },
  event_type: {
    type: String,
    enum: ['info', 'alert', 'action', 'resolution', 'escalation'],
    default: 'info'
  }
}, { timestamps: true });

// ─── Remediation Tracker Schema ───────────────────────────────────────────────
const remediationSchema = new mongoose.Schema({
  incident_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', required: true },
  update_text: { type: String, required: true },
  previous_status: { type: String },
  new_status: { type: String },
  changed_by: { type: String, default: 'Unknown' },
  ai_summary: { type: String },
  key_actions: [{ type: String }],
  next_steps: { type: String }
}, { timestamps: true });

const Incident = mongoose.model('Incident', incidentSchema);
const ActionItem = mongoose.model('ActionItem', actionItemSchema);
const Timeline = mongoose.model('Timeline', timelineSchema);
const Remediation = mongoose.model('Remediation', remediationSchema);

module.exports = { connectDB, Incident, ActionItem, Timeline, Remediation };
