const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-3.5-flash"
});
/**
 * Parse raw incident text/voice note into structured incident record
 */
async function parseIncident(text) {
  const prompt = `You are an expert incident management AI for HelioOps.

Parse the following incident note and extract structured data.
Return ONLY valid JSON — no markdown, no explanation, no code fences.

SCHEMA (return this exact structure):
{
  "title": string (required, concise 5-10 word title, max 100 chars),
  "severity": "P1" | "P2" | "P3" | "P4" (required — P1=critical/outage, P2=major degradation, P3=minor issue, P4=low impact),
  "impact": string (required, describe affected users/systems/revenue),
  "status": "open" | "investigating" | "mitigated" | "resolved" (required),
  "service": string (required, name of the affected service or system),
  "error_type": "infrastructure" | "application" | "security" | "performance" | "data" | "unknown" (required),
  "description": string (required, full structured description of the incident),
  "missing_fields": [] (array of field names that could not be determined from the input)
}

RULES:
- Do NOT invent information not present in the input
- If a required field cannot be determined, set its value to null and add the field name to missing_fields
- severity P1 = total outage or data loss; P2 = major feature broken; P3 = minor degradation; P4 = cosmetic/low impact
- Be concise and precise

Incident note:
"""
${text}
"""`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    // Strip any accidental markdown code fences
    const jsonStr = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(jsonStr);

    // Validate required fields
    const requiredFields = ['title', 'severity', 'impact', 'status', 'service', 'error_type', 'description'];
    const missing = parsed.missing_fields || [];
    requiredFields.forEach(f => {
      if (!parsed[f] && !missing.includes(f)) missing.push(f);
    });
    parsed.missing_fields = missing;

    // Validate severity enum
    if (!['P1', 'P2', 'P3', 'P4'].includes(parsed.severity)) {
      parsed.severity = null;
      if (!missing.includes('severity')) missing.push('severity');
    }
    // Validate status enum
    if (!['open', 'investigating', 'mitigated', 'resolved'].includes(parsed.status)) {
      parsed.status = 'open';
    }

    return { success: true, data: parsed };
  } catch (err) {
    return { success: false, error: 'AI parsing failed: ' + err.message, raw: null };
  }
}

/**
 * Extract action items from incident review document
 */
async function extractActionItems(document) {
  const prompt = `You are an expert incident response coordinator for HelioOps.

Extract ALL action items from the following incident review document.
Return ONLY valid JSON — no markdown, no explanation, no code fences.

SCHEMA (return this exact structure):
{
  "action_items": [
    {
      "task": string (required, clear description of what needs to be done),
      "owner": string | null (person or team responsible),
      "deadline": string | null (due date or relative time like "24 hours", "EOD Friday"),
      "priority": "high" | "medium" | "low"
    }
  ],
  "summary": string (brief 1-2 sentence summary of the review findings),
  "missing_fields": [] (list any action items where owner or deadline could not be determined)
}

RULES:
- Extract EVERY actionable item mentioned
- Do NOT invent owners or deadlines not mentioned
- If no action items are found, return empty array with explanation in summary

Review document:
"""
${document}
"""`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    const jsonStr = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(jsonStr);
    return { success: true, data: parsed };
  } catch (err) {
    return { success: false, error: 'AI action extraction failed: ' + err.message };
  }
}

/**
 * Summarize operational logs into a human-readable timeline
 */
async function summarizeLogs(logs) {
  const prompt = `You are an expert site reliability engineer for HelioOps.

Analyze the following operational logs or incident notes and create a structured timeline.
Return ONLY valid JSON — no markdown, no explanation, no code fences.

SCHEMA (return this exact structure):
{
  "timeline": [
    {
      "event_time": string (timestamp or relative time extracted from logs, e.g. "14:32 UTC" or "T+5min"),
      "event": string (clear, concise description of what happened),
      "actor": string | null (system, service, or person that triggered the event),
      "event_type": "info" | "alert" | "action" | "resolution" | "escalation"
    }
  ],
  "root_cause": string | null (likely root cause if determinable),
  "resolution_summary": string | null (how it was resolved, if applicable)
}

RULES:
- Order timeline chronologically
- Be precise and technical
- event_type: alert=anomaly detected, action=human/system action taken, resolution=problem fixed, escalation=severity increased, info=neutral event
- Extract actual timestamps from logs if present

Logs:
"""
${logs}
"""`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    const jsonStr = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(jsonStr);
    return { success: true, data: parsed };
  } catch (err) {
    return { success: false, error: 'AI log summarization failed: ' + err.message };
  }
}

/**
 * Route incident to appropriate team
 */
async function routeIncident(incident) {
  const prompt = `You are an expert incident routing system for HelioOps.

Based on the incident details below, determine the best team to handle this incident.
Return ONLY valid JSON — no markdown, no explanation, no code fences.

SCHEMA:
{
  "assigned_team": string (specific team name, e.g. "Platform SRE", "Security Response", "Database Engineering", "Frontend Engineering", "API Gateway Team", "Network Operations", "Data Engineering"),
  "reason": string (1-2 sentence explanation of why this team was selected),
  "escalate_to": string | null (secondary team to loop in if needed),
  "priority_action": string (the first thing the team should do)
}

Incident Details:
- Title: ${incident.title}
- Service: ${incident.service}
- Severity: ${incident.severity}
- Error Type: ${incident.error_type}
- Impact: ${incident.impact}
- Description: ${incident.description}

Route to the most specific, relevant team. Consider the service name, error type, and severity.`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    const jsonStr = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(jsonStr);
    return { success: true, data: parsed };
  } catch (err) {
    return { success: false, error: 'AI routing failed: ' + err.message };
  }
}

/**
 * Process a natural-language remediation status update
 */
async function processRemediation(updateText, currentStatus) {
  const prompt = `You are an expert incident remediation coordinator for HelioOps.

Analyze the following natural-language status update and extract structured remediation information.
Return ONLY valid JSON — no markdown, no explanation, no code fences.

SCHEMA:
{
  "new_status": "open" | "investigating" | "mitigated" | "resolved" (required, based on update content),
  "ai_summary": string (concise 1-2 sentence summary of the update),
  "key_actions": [] (array of specific actions mentioned in the update),
  "next_steps": string | null (what should happen next based on the update)
}

RULES:
- Current status is: ${currentStatus}
- Determine if status has changed based on the update
- Be precise about the new status
- If the update mentions "fixed", "resolved", "closed" → resolved
- If "mitigated", "workaround", "stable" → mitigated  
- If "investigating", "looking into", "debugging" → investigating
- If unclear, keep as current status: ${currentStatus}

Status update:
"""
${updateText}
"""`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    const jsonStr = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(jsonStr);
    return { success: true, data: parsed };
  } catch (err) {
    return { success: false, error: 'AI remediation processing failed: ' + err.message };
  }
}

module.exports = { parseIncident, extractActionItems, summarizeLogs, routeIncident, processRemediation };
