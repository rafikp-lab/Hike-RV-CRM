const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(path.join(DB_DIR, 'hikerv.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── CREATE TABLES ──────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    email       TEXT,
    phone       TEXT,
    state       TEXT,
    model       TEXT,
    size        TEXT,
    source      TEXT,
    status      TEXT DEFAULT 'New',
    action      TEXT,
    next_action TEXT,
    date        TEXT,
    next_date   TEXT,
    last_contact TEXT,
    notes       TEXT,
    internal    TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS deals (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    company     TEXT,
    contact     TEXT,
    size        REAL DEFAULT 0,
    prob        REAL DEFAULT 0,
    stage       TEXT DEFAULT 'Qualification',
    status      TEXT DEFAULT 'OPEN',
    initiated   TEXT,
    closing     TEXT,
    next_action TEXT,
    notes       TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );
`);

// ── SEED DATA (only if tables are empty) ──────────────────
function seedIfEmpty() {
  const leadCount = db.prepare('SELECT COUNT(*) as c FROM leads').get().c;
  if (leadCount > 0) return;

  console.log('Seeding database with initial data...');

  const insertLead = db.prepare(`
    INSERT INTO leads (name,email,phone,state,model,size,source,status,action,next_action,date,next_date,last_contact,notes,internal)
    VALUES (@name,@email,@phone,@state,@model,@size,@source,@status,@action,@next_action,@date,@next_date,@last_contact,@notes,@internal)
  `);

  const leads = [
    {name:'Joshua Willshire',email:'glcboii2010@hotmail.com',phone:'439690118',state:'NSW',model:'Elite Series',size:'21ft',source:'Website Leads',status:'Open',action:'Email',next_action:'Email',date:'2026-02-05',next_date:'2026-02-19',last_contact:'2026-02-09',notes:'Looking to buy the Amore, need a price and when it would be available.',internal:'Sent Details, followup, Hike Amore (hiker)'},
    {name:'Jess Botfield',email:'jessbotfield@hotmail.com',phone:'422798061',state:'NSW',model:'Others',size:'21ft',source:'Website Leads',status:'Won',action:'Email',next_action:'',date:'2026-02-01',next_date:'',last_contact:'2026-02-07',notes:'Looking for a triple or double bunk semi off road van.',internal:''},
    {name:'Shane Delaney',email:'shane@hailfixaus.com.au',phone:'0461131154',state:'',model:'',size:'',source:'Website Leads',status:'Open',action:'Email',next_action:'',date:'2026-01-27',next_date:'',last_contact:'2026-02-07',notes:'',internal:''},
    {name:'Suzanne',email:'mack4304@bigpond.com',phone:'431672503',state:'QLD',model:'Rover Series',size:"19'6ft",source:'Website Leads',status:'New',action:'Email',next_action:'',date:'2026-01-10',next_date:'',last_contact:'2026-02-07',notes:'',internal:''},
    {name:'Letitia Beal',email:'projectbeal@hotmail.com',phone:'421162762',state:'NSW',model:'Rover Series',size:'21ft',source:'Website Leads',status:'New',action:'WhatsApp',next_action:'',date:'2025-12-28',next_date:'',last_contact:'2026-02-07',notes:'Family of 6, open to triple or quad bunk. Would like a quote on both please.',internal:''},
    {name:'Breanna Carroll',email:'Breaz2@hotmail.com',phone:'400253025',state:'TAS',model:'Rover Series',size:'21ft',source:'Website Leads',status:'New',action:'WhatsApp',next_action:'',date:'2025-12-27',next_date:'',last_contact:'2026-02-07',notes:'',internal:''},
    {name:'Scott Paterson',email:'scott.paterson@startrack.com.au',phone:'407694358',state:'VIC',model:'Drifter Series',size:"19'6ft",source:'Website Leads',status:'New',action:'WhatsApp',next_action:'',date:'2025-12-05',next_date:'',last_contact:'2026-02-07',notes:'',internal:''},
    {name:'Richard',email:'richyparker8@gmail.com',phone:'430168807',state:'VIC',model:'Drifter Series',size:"19'6ft",source:'Website Leads',status:'Contacted',action:'WhatsApp',next_action:'',date:'2025-11-26',next_date:'',last_contact:'2026-02-07',notes:"Full off road version and option on the 21' also please.",internal:''},
    {name:'Nathan Wardle',email:'nathantaz@gmail.com',phone:'400373091',state:'TAS',model:'Rover Series',size:'Others',source:'Website Leads',status:'Open',action:'WhatsApp',next_action:'',date:'2025-11-25',next_date:'',last_contact:'2026-02-07',notes:'Saw vans at caravan show. Interested in Quad Delete layout, East West bed, semi off road.',internal:''},
    {name:'Wayne Vernon Cox',email:'waynecox71@bigpond.com',phone:'439437255',state:'TAS',model:'Others',size:'Others',source:'Website Leads',status:'Contacted',action:'WhatsApp',next_action:'',date:'2025-11-19',next_date:'',last_contact:'2026-02-07',notes:'Tandem axle off road suspension l shaped lounge 600ah lithium 3000w inverter.',internal:''},
    {name:'Lydia',email:'lulul_lala@hotmail.com',phone:'413048235',state:'NSW',model:'Rover Series',size:'18ft',source:'Website Leads',status:'Contacted',action:'WhatsApp',next_action:'',date:'2025-11-18',next_date:'',last_contact:'2026-02-07',notes:'Would like to know if you make an 18ft off road caravan with triple bunks and the price range.',internal:''},
    {name:'Jamie Howell',email:'dtpoint@live.com.au',phone:'407233391',state:'NSW',model:'Rover Series',size:"19'6ft",source:'Website Leads',status:'Contacted',action:'WhatsApp',next_action:'',date:'2025-10-30',next_date:'',last_contact:'2026-02-07',notes:'After a quote and lead time for availability.',internal:''},
    {name:'Jenny',email:'mushimushi_jd@hotmail.com',phone:'431190713',state:'VIC',model:'Drifter Series',size:'21ft',source:'Website Leads',status:'Qualified',action:'WhatsApp',next_action:'Send Quote',date:'2025-09-23',next_date:'',last_contact:'2026-02-07',notes:'Would like to be quoted for a 21ft Wild Drifter Ultra and Tuff Rider air bags added.',internal:''},
    {name:'Susan Oakley',email:'susan.bruce2@bigpond.com',phone:'488707056',state:'TAS',model:'Others',size:"19'6ft",source:'Website Leads',status:'Contacted',action:'WhatsApp',next_action:'',date:'2025-09-22',next_date:'',last_contact:'2026-02-07',notes:'',internal:''},
    {name:'Michelle Nuttman',email:'michellenuttman66@gmail.com',phone:'466696248',state:'VIC',model:'Elite Series',size:'21ft',source:'Website Leads',status:'Qualified',action:'Email',next_action:'Send Quote',date:'2025-09-14',next_date:'',last_contact:'2026-02-07',notes:'',internal:''},
    {name:'Bec Yeomans',email:'becsshaw@hotmail.com',phone:'414418959',state:'NSW',model:'Others',size:'21ft',source:'Website Leads',status:'Contacted',action:'WhatsApp',next_action:'',date:'2025-08-20',next_date:'',last_contact:'2026-02-07',notes:'Wanting some further information.',internal:''},
    {name:'Steve Hunter',email:'hunter.sd@gmail.com',phone:'432870111',state:'',model:'',size:'',source:'Website Leads',status:'New',action:'Email',next_action:'',date:'2025-08-11',next_date:'',last_contact:'2026-02-07',notes:'',internal:''},
    {name:'Peter',email:'gjcsandgate@gmail.com',phone:'425890580',state:'',model:'',size:'',source:'Website Leads',status:'New',action:'Email',next_action:'',date:'2025-08-01',next_date:'',last_contact:'2026-02-07',notes:'',internal:''},
    {name:'William Craig',email:'angehay35@gmail.com',phone:'409563154',state:'',model:'',size:'',source:'Website Leads',status:'New',action:'Email',next_action:'',date:'2025-08-01',next_date:'',last_contact:'2026-02-07',notes:'',internal:''},
    {name:'Tamara Koopal',email:'tamara.koopal@yahoo.com',phone:'412345678',state:'QLD',model:'Rover Series',size:'21ft',source:'Referral',status:'Open',action:'Phone Call',next_action:'Follow Up',date:'2025-07-15',next_date:'2025-08-01',last_contact:'2025-07-20',notes:'Referred by existing customer. Very interested.',internal:''},
    {name:'Mark Thompson',email:'mark.t@gmail.com',phone:'421111222',state:'NSW',model:'Elite Series',size:"19'6ft",source:'Email Marketing',status:'Won',action:'Meeting',next_action:'',date:'2025-06-10',next_date:'',last_contact:'2025-07-01',notes:'',internal:'Sent Details, followup, Hike Amore (hiker)'},
  ];

  const insertMany = db.transaction(rows => rows.forEach(r => insertLead.run(r)));
  insertMany(leads);

  const insertDeal = db.prepare(`
    INSERT INTO deals (title,company,contact,size,prob,stage,status,initiated,closing,next_action,notes)
    VALUES (@title,@company,@contact,@size,@prob,@stage,@status,@initiated,@closing,@next_action,@notes)
  `);

  const deals = [
    {title:'Collab',company:'The Troopy Travellers',contact:'',size:2500000,prob:75,stage:'Qualification',status:'OPEN',initiated:'',closing:'',next_action:'Initial call',notes:''},
    {title:'Deal 2',company:'',contact:'',size:3500000,prob:50,stage:'Proposal',status:'LOST',initiated:'',closing:'',next_action:'',notes:''},
    {title:'Deal 3',company:'',contact:'',size:900000,prob:10,stage:'Negotiating',status:'WON',initiated:'',closing:'',next_action:'',notes:''},
    {title:'Deal 4',company:'',contact:'',size:2600000,prob:75,stage:'Closed - Won',status:'OPEN',initiated:'',closing:'',next_action:'',notes:''},
    {title:'Deal 5',company:'',contact:'',size:2000000,prob:50,stage:'Closed - Lost',status:'OPEN',initiated:'',closing:'',next_action:'',notes:''},
    {title:'Deal 6',company:'',contact:'',size:1600000,prob:25,stage:'Proposal',status:'OPEN',initiated:'',closing:'',next_action:'',notes:''},
    {title:'Deal 7',company:'',contact:'',size:2750000,prob:35,stage:'Qualification',status:'OPEN',initiated:'',closing:'',next_action:'',notes:''},
    {title:'Deal 8',company:'',contact:'',size:850000,prob:90,stage:'Negotiating',status:'OPEN',initiated:'',closing:'',next_action:'',notes:''},
    {title:'Deal 9',company:'',contact:'',size:6750000,prob:60,stage:'Proposal',status:'OPEN',initiated:'',closing:'',next_action:'',notes:''},
    {title:'Deal 10',company:'',contact:'',size:2750000,prob:33,stage:'Qualification',status:'OPEN',initiated:'',closing:'',next_action:'',notes:''},
  ];

  const insertDeals = db.transaction(rows => rows.forEach(r => insertDeal.run(r)));
  insertDeals(deals);

  console.log(`Seeded ${leads.length} leads and ${deals.length} deals.`);
}

seedIfEmpty();

module.exports = db;
