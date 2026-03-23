const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── HELPERS ────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);
const ok = (res, data) => res.json({ ok: true, data });
const err = (res, msg, status = 400) => res.status(status).json({ ok: false, error: msg });

// ══════════════════════════════════════════════════════════
// LEADS API
// ══════════════════════════════════════════════════════════

// GET all leads (with optional filters)
app.get('/api/leads', (req, res) => {
  const { q, status, source, model, state } = req.query;
  let sql = 'SELECT * FROM leads WHERE 1=1';
  const params = [];

  if (q) {
    sql += ' AND (name LIKE ? OR email LIKE ? OR model LIKE ? OR phone LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (source) { sql += ' AND source = ?'; params.push(source); }
  if (model)  { sql += ' AND model = ?';  params.push(model); }
  if (state)  { sql += ' AND state = ?';  params.push(state); }

  sql += ' ORDER BY created_at DESC';
  ok(res, db.prepare(sql).all(...params));
});

// GET single lead
app.get('/api/leads/:id', (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return err(res, 'Lead not found', 404);
  ok(res, lead);
});

// POST create lead
app.post('/api/leads', (req, res) => {
  const { name, email, phone, state, model, size, source, status, action,
          next_action, date, next_date, notes, internal } = req.body;
  if (!name?.trim()) return err(res, 'Name is required');

  const result = db.prepare(`
    INSERT INTO leads (name,email,phone,state,model,size,source,status,action,next_action,date,next_date,last_contact,notes,internal)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    name.trim(), email||'', phone||'', state||'', model||'', size||'',
    source||'', status||'New', action||'', next_action||'',
    date||today(), next_date||'', today(), notes||'', internal||''
  );

  ok(res, db.prepare('SELECT * FROM leads WHERE id = ?').get(result.lastInsertRowid));
});

// PUT update lead
app.put('/api/leads/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!existing) return err(res, 'Lead not found', 404);

  const fields = ['name','email','phone','state','model','size','source','status',
                  'action','next_action','date','next_date','last_contact','notes','internal'];
  const updates = {};
  fields.forEach(f => { updates[f] = req.body[f] !== undefined ? req.body[f] : existing[f]; });
  updates.updated_at = new Date().toISOString();

  db.prepare(`
    UPDATE leads SET
      name=@name, email=@email, phone=@phone, state=@state, model=@model, size=@size,
      source=@source, status=@status, action=@action, next_action=@next_action,
      date=@date, next_date=@next_date, last_contact=@last_contact,
      notes=@notes, internal=@internal, updated_at=@updated_at
    WHERE id = ${req.params.id}
  `).run(updates);

  ok(res, db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id));
});

// PATCH quick status update
app.patch('/api/leads/:id/status', (req, res) => {
  const { status } = req.body;
  if (!status) return err(res, 'Status is required');
  const result = db.prepare(
    'UPDATE leads SET status=?, last_contact=?, updated_at=? WHERE id=?'
  ).run(status, today(), new Date().toISOString(), req.params.id);
  if (!result.changes) return err(res, 'Lead not found', 404);
  ok(res, db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id));
});

// DELETE lead
app.delete('/api/leads/:id', (req, res) => {
  const result = db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
  if (!result.changes) return err(res, 'Lead not found', 404);
  ok(res, { id: Number(req.params.id) });
});

// ══════════════════════════════════════════════════════════
// DEALS API
// ══════════════════════════════════════════════════════════

// GET all deals
app.get('/api/deals', (req, res) => {
  const { q, status, stage } = req.query;
  let sql = 'SELECT * FROM deals WHERE 1=1';
  const params = [];

  if (q) {
    sql += ' AND (title LIKE ? OR company LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like);
  }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (stage)  { sql += ' AND stage = ?';  params.push(stage); }

  sql += ' ORDER BY created_at DESC';
  ok(res, db.prepare(sql).all(...params));
});

// GET single deal
app.get('/api/deals/:id', (req, res) => {
  const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
  if (!deal) return err(res, 'Deal not found', 404);
  ok(res, deal);
});

// POST create deal
app.post('/api/deals', (req, res) => {
  const { title, company, contact, size, prob, stage, status, initiated, closing, next_action, notes } = req.body;
  if (!title?.trim()) return err(res, 'Title is required');

  const result = db.prepare(`
    INSERT INTO deals (title,company,contact,size,prob,stage,status,initiated,closing,next_action,notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    title.trim(), company||'', contact||'',
    parseFloat(size)||0, parseFloat(prob)||0,
    stage||'Qualification', status||'OPEN',
    initiated||today(), closing||'', next_action||'', notes||''
  );

  ok(res, db.prepare('SELECT * FROM deals WHERE id = ?').get(result.lastInsertRowid));
});

// PUT update deal
app.put('/api/deals/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
  if (!existing) return err(res, 'Deal not found', 404);

  const fields = ['title','company','contact','size','prob','stage','status','initiated','closing','next_action','notes'];
  const updates = {};
  fields.forEach(f => { updates[f] = req.body[f] !== undefined ? req.body[f] : existing[f]; });
  updates.updated_at = new Date().toISOString();

  db.prepare(`
    UPDATE deals SET
      title=@title, company=@company, contact=@contact, size=@size, prob=@prob,
      stage=@stage, status=@status, initiated=@initiated, closing=@closing,
      next_action=@next_action, notes=@notes, updated_at=@updated_at
    WHERE id = ${req.params.id}
  `).run(updates);

  ok(res, db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id));
});

// DELETE deal
app.delete('/api/deals/:id', (req, res) => {
  const result = db.prepare('DELETE FROM deals WHERE id = ?').run(req.params.id);
  if (!result.changes) return err(res, 'Deal not found', 404);
  ok(res, { id: Number(req.params.id) });
});

// ══════════════════════════════════════════════════════════
// STATS API (for dashboard)
// ══════════════════════════════════════════════════════════
app.get('/api/stats', (req, res) => {
  const leadTotal   = db.prepare('SELECT COUNT(*) as c FROM leads').get().c;
  const leadWon     = db.prepare("SELECT COUNT(*) as c FROM leads WHERE status='Won'").get().c;
  const leadLost    = db.prepare("SELECT COUNT(*) as c FROM leads WHERE status='Lost'").get().c;
  const leadOpen    = db.prepare("SELECT COUNT(*) as c FROM leads WHERE status IN ('New','Open','Contacted','Qualified')").get().c;
  const dealTotal   = db.prepare('SELECT COUNT(*) as c FROM deals').get().c;
  const pipeline    = db.prepare('SELECT COALESCE(SUM(size),0) as s FROM deals').get().s;
  const weighted    = db.prepare('SELECT COALESCE(SUM(size*prob/100),0) as s FROM deals').get().s;
  const byStatus    = db.prepare("SELECT status, COUNT(*) as cnt FROM leads GROUP BY status").all();
  const bySource    = db.prepare("SELECT source, COUNT(*) as cnt FROM leads WHERE source!='' GROUP BY source ORDER BY cnt DESC").all();
  const byModel     = db.prepare("SELECT model, COUNT(*) as cnt FROM leads WHERE model!='' GROUP BY model ORDER BY cnt DESC").all();
  const byState     = db.prepare("SELECT state, COUNT(*) as cnt FROM leads WHERE state!='' GROUP BY state ORDER BY cnt DESC").all();
  const byStage     = db.prepare("SELECT stage, COUNT(*) as cnt, SUM(size) as val FROM deals GROUP BY stage").all();

  ok(res, { leadTotal, leadWon, leadLost, leadOpen, dealTotal, pipeline, weighted,
            byStatus, bySource, byModel, byState, byStage });
});

// Catch-all → serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚐 Hike RV CRM running at http://localhost:${PORT}\n`);
});
