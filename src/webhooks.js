/**
 * webhooks.js
 * Handles inbound leads from:
 *   - Google Ads Lead Form Extensions  (POST /api/webhooks/google)
 *   - Meta / Facebook Lead Ads         (GET+POST /api/webhooks/meta)
 *   - Zapier / Make no-code connector  (POST /api/webhooks/zapier)
 *
 * Set these env vars (in Railway / Render dashboard, or .env locally):
 *   WEBHOOK_SECRET      – a secret token you choose (e.g. "hikerv2024xyz")
 *   META_VERIFY_TOKEN   – same string you type into Meta's webhook setup page
 *   NOTIFY_EMAIL        – where to send new-lead alerts  (e.g. sales@hikerv.com.au)
 *   SMTP_HOST           – e.g. smtp.gmail.com
 *   SMTP_PORT           – 587
 *   SMTP_USER           – your Gmail address
 *   SMTP_PASS           – Gmail App Password (not your real password)
 */

const crypto   = require('crypto');
const nodemailer = require('nodemailer');
const db       = require('./db');

// ── EMAIL SETUP ────────────────────────────────────────────
const mailer = nodemailer.createTransport({
  host:   process.env.SMTP_HOST  || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

async function sendNewLeadEmail(lead, source) {
  if (!process.env.SMTP_USER || !process.env.NOTIFY_EMAIL) return; // skip if not configured
  try {
    await mailer.sendMail({
      from: `"Hike RV CRM" <${process.env.SMTP_USER}>`,
      to:   process.env.NOTIFY_EMAIL,
      subject: `🚐 New lead from ${source}: ${lead.name}`,
      html: `
        <div style="font-family:sans-serif;max-width:500px">
          <h2 style="color:#c8501a">New Lead — ${source}</h2>
          <table style="width:100%;border-collapse:collapse">
            ${Object.entries({
              Name: lead.name, Email: lead.email, Phone: lead.phone,
              State: lead.state, Model: lead.model, Source: lead.source,
              Notes: lead.notes,
            }).filter(([,v]) => v).map(([k,v]) => `
              <tr>
                <td style="padding:8px 12px;background:#f5f4f0;font-weight:600;width:110px">${k}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e2e0d8">${v}</td>
              </tr>`).join('')}
          </table>
          <p style="margin-top:16px">
            <a href="${process.env.APP_URL || '#'}/leads" style="background:#c8501a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">
              View in CRM →
            </a>
          </p>
        </div>`,
    });
  } catch (e) {
    console.warn('Email send failed:', e.message);
  }
}

// ── DB INSERT ──────────────────────────────────────────────
function insertLead(data) {
  return db.prepare(`
    INSERT INTO leads
      (name,email,phone,state,model,size,source,status,action,next_action,
       date,next_date,last_contact,notes,internal)
    VALUES
      (@name,@email,@phone,@state,@model,@size,@source,@status,@action,@next_action,
       @date,@next_date,@last_contact,@notes,@internal)
  `).run({
    name:         data.name         || 'Unknown',
    email:        data.email        || '',
    phone:        data.phone        || '',
    state:        data.state        || '',
    model:        data.model        || '',
    size:         data.size         || '',
    source:       data.source       || 'Ads',
    status:       'New',
    action:       data.action       || 'Email',
    next_action:  'Follow Up',
    date:         new Date().toISOString().slice(0,10),
    next_date:    '',
    last_contact: new Date().toISOString().slice(0,10),
    notes:        data.notes        || '',
    internal:     `Auto-imported from ${data.source || 'Ads'} on ${new Date().toLocaleDateString('en-AU')}`,
  });
}

// ── FIELD MAPPERS ──────────────────────────────────────────
// Google Ads sends an array of column_id+string_value pairs
function mapGoogleLead(payload) {
  // payload.lead.column_data = [{ column_id, string_value }, ...]
  const cols = {};
  (payload?.lead?.column_data || []).forEach(c => {
    cols[c.column_id] = c.string_value;
  });
  // Google uses camelCase field names defined in your Lead Form
  return {
    name:   cols.FULL_NAME   || cols.full_name   || [cols.FIRST_NAME, cols.LAST_NAME].filter(Boolean).join(' ') || '',
    email:  cols.EMAIL       || cols.email        || '',
    phone:  cols.PHONE_NUMBER|| cols.phone_number || '',
    state:  cols.STATE       || cols.state        || cols.CITY || '',
    model:  cols.VEHICLE_TYPE|| cols.model        || cols.product_interest || '',
    size:   cols.SIZE        || cols.size         || '',
    notes:  cols.MESSAGE     || cols.message      || cols.ADDITIONAL_INFO || '',
    source: 'Google Ads',
    action: 'Email',
  };
}

// Meta sends lead_field_data array with name+values
function mapMetaLead(payload) {
  // payload = one entry from the 'changes' array value
  const fields = {};
  (payload?.field_data || []).forEach(f => {
    fields[f.name.toLowerCase()] = (f.values || [])[0] || '';
  });
  const fullName = fields['full_name'] || [fields['first_name'], fields['last_name']].filter(Boolean).join(' ');
  return {
    name:   fullName,
    email:  fields['email']         || '',
    phone:  fields['phone_number']  || fields['phone'] || '',
    state:  fields['state']         || fields['city']  || '',
    model:  fields['model_interest']|| fields['vehicle_type'] || fields['product'] || '',
    size:   fields['size']          || '',
    notes:  fields['message']       || fields['comments'] || '',
    source: 'Meta Ads',
    action: 'Email',
  };
}

// Zapier / Make sends a clean JSON body you define in the workflow
function mapZapierLead(body) {
  return {
    name:   body.name   || body.full_name   || '',
    email:  body.email  || '',
    phone:  body.phone  || body.phone_number || '',
    state:  body.state  || '',
    model:  body.model  || body.model_interest || '',
    size:   body.size   || '',
    notes:  body.notes  || body.message     || '',
    source: body.source || 'Zapier',
    action: body.action || 'Email',
  };
}

// ── SECURITY HELPERS ──────────────────────────────────────
function verifyGoogleSignature(req) {
  // Google signs with HMAC-SHA256 using your webhook secret
  const secret    = process.env.WEBHOOK_SECRET || '';
  if (!secret) return true; // skip check if not configured
  const signature = req.headers['google-ads-api-signature'] || '';
  const expected  = crypto.createHmac('sha256', secret).update(JSON.stringify(req.body)).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function verifyMetaSignature(req) {
  const secret    = process.env.WEBHOOK_SECRET || '';
  if (!secret) return true;
  const signature = (req.headers['x-hub-signature-256'] || '').replace('sha256=', '');
  const expected  = crypto.createHmac('sha256', secret).update(JSON.stringify(req.body)).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(signature,'hex'), Buffer.from(expected,'hex')); }
  catch { return false; }
}

function verifyZapierToken(req) {
  const token = process.env.WEBHOOK_SECRET || '';
  if (!token) return true;
  return req.headers['x-webhook-secret'] === token;
}

// ── REGISTER ROUTES ────────────────────────────────────────
module.exports = function registerWebhooks(app) {

  // ── GOOGLE ADS ─────────────────────────────────────────
  app.post('/api/webhooks/google', (req, res) => {
    if (!verifyGoogleSignature(req)) return res.status(401).json({ error: 'Invalid signature' });

    try {
      const mapped = mapGoogleLead(req.body);
      if (!mapped.name && !mapped.email && !mapped.phone) {
        return res.status(400).json({ error: 'No lead data found in payload' });
      }
      const result = insertLead(mapped);
      const lead   = db.prepare('SELECT * FROM leads WHERE id = ?').get(result.lastInsertRowid);
      sendNewLeadEmail(lead, 'Google Ads');
      console.log(`[Google Ads] New lead: ${lead.name} (${lead.email})`);
      res.json({ ok: true, lead_id: lead.id, message: 'Lead created' });
    } catch (e) {
      console.error('[Google Ads webhook error]', e);
      res.status(500).json({ error: e.message });
    }
  });

  // ── META / FACEBOOK ───────────────────────────────────
  // Step 1: Meta sends a GET to verify your webhook URL
  app.get('/api/webhooks/meta', (req, res) => {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === (process.env.META_VERIFY_TOKEN || process.env.WEBHOOK_SECRET || '')) {
      console.log('[Meta webhook] Verified successfully');
      return res.status(200).send(challenge);
    }
    res.status(403).json({ error: 'Verification failed' });
  });

  // Step 2: Meta sends a POST for every new lead
  app.post('/api/webhooks/meta', (req, res) => {
    if (!verifyMetaSignature(req)) return res.status(401).json({ error: 'Invalid signature' });

    // Meta batches changes — loop through all of them
    const changes = req.body?.entry?.[0]?.changes || [];
    const created = [];

    for (const change of changes) {
      if (change.field !== 'leadgen') continue;
      try {
        const mapped = mapMetaLead(change.value);
        if (!mapped.name && !mapped.email && !mapped.phone) continue;
        const result = insertLead(mapped);
        const lead   = db.prepare('SELECT * FROM leads WHERE id = ?').get(result.lastInsertRowid);
        sendNewLeadEmail(lead, 'Meta Ads');
        console.log(`[Meta Ads] New lead: ${lead.name} (${lead.email})`);
        created.push(lead.id);
      } catch (e) {
        console.error('[Meta webhook error]', e);
      }
    }

    res.json({ ok: true, leads_created: created.length, lead_ids: created });
  });

  // ── ZAPIER / MAKE ─────────────────────────────────────
  app.post('/api/webhooks/zapier', (req, res) => {
    if (!verifyZapierToken(req)) return res.status(401).json({ error: 'Invalid secret' });

    try {
      // Support single lead OR array of leads (Make can send batches)
      const items = Array.isArray(req.body) ? req.body : [req.body];
      const created = [];

      for (const item of items) {
        const mapped = mapZapierLead(item);
        if (!mapped.name && !mapped.email && !mapped.phone) continue;
        const result = insertLead(mapped);
        const lead   = db.prepare('SELECT * FROM leads WHERE id = ?').get(result.lastInsertRowid);
        sendNewLeadEmail(lead, mapped.source || 'Zapier');
        console.log(`[Zapier] New lead: ${lead.name} (${lead.email})`);
        created.push(lead);
      }

      res.json({ ok: true, leads_created: created.length, leads: created });
    } catch (e) {
      console.error('[Zapier webhook error]', e);
      res.status(500).json({ error: e.message });
    }
  });

  // ── WEBHOOK TEST (dev only) ───────────────────────────
  app.post('/api/webhooks/test', (req, res) => {
    if (process.env.NODE_ENV === 'production') return res.status(404).end();
    const { platform = 'zapier' } = req.query;

    const testPayloads = {
      google: {
        lead: {
          column_data: [
            { column_id: 'FULL_NAME',    string_value: 'Test Google Lead' },
            { column_id: 'EMAIL',        string_value: 'test.google@example.com' },
            { column_id: 'PHONE_NUMBER', string_value: '0400000001' },
            { column_id: 'STATE',        string_value: 'NSW' },
            { column_id: 'model',        string_value: 'Rover Series' },
            { column_id: 'MESSAGE',      string_value: 'Interested in 21ft off-road van.' },
          ]
        }
      },
      meta: {
        entry: [{
          changes: [{
            field: 'leadgen',
            value: {
              field_data: [
                { name: 'full_name',     values: ['Test Meta Lead'] },
                { name: 'email',         values: ['test.meta@example.com'] },
                { name: 'phone_number',  values: ['0400000002'] },
                { name: 'state',         values: ['VIC'] },
                { name: 'model_interest',values: ['Elite Series'] },
                { name: 'message',       values: ['Saw your ad, interested in pricing.'] },
              ]
            }
          }]
        }]
      },
      zapier: {
        name: 'Test Zapier Lead', email: 'test.zapier@example.com',
        phone: '0400000003', state: 'QLD', model: 'Drifter Series',
        source: 'Google Ads', notes: 'Via Zapier test trigger',
      },
    };

    const payload = testPayloads[platform] || testPayloads.zapier;
    req.body = payload;

    let mapped;
    if (platform === 'google') mapped = mapGoogleLead(payload);
    else if (platform === 'meta') mapped = mapMetaLead(payload.entry[0].changes[0].value);
    else mapped = mapZapierLead(payload);

    const result = insertLead(mapped);
    const lead   = db.prepare('SELECT * FROM leads WHERE id = ?').get(result.lastInsertRowid);
    res.json({ ok: true, message: `Test lead created for ${platform}`, lead });
  });

  console.log('✓ Webhook routes registered: /api/webhooks/google | /api/webhooks/meta | /api/webhooks/zapier');
};
