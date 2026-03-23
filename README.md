# Hike RV CRM — Cloud Setup Guide

## What's in this project

```
hikerv-crm/
├── src/
│   ├── server.js     ← Express REST API (all routes)
│   └── db.js         ← SQLite database + seed data
├── public/
│   └── index.html    ← Full CRM frontend
├── data/             ← Created automatically (SQLite database lives here)
├── package.json
├── railway.toml      ← Railway deployment config
└── render.yaml       ← Render deployment config
```

---

## Option A — Deploy to Railway (Recommended, ~5 mins)

Railway gives you a live URL, persistent disk, and free $5 credit/month.

### Step 1 — Create a GitHub repo

1. Go to https://github.com and create a **new repository** called `hikerv-crm`
2. Upload all files from this folder into the repo (drag and drop works)

### Step 2 — Deploy on Railway

1. Go to https://railway.app and sign up (free)
2. Click **New Project → Deploy from GitHub repo**
3. Select your `hikerv-crm` repo
4. Railway auto-detects Node.js and deploys it
5. Click **Settings → Networking → Generate Domain**
6. Your CRM is live at something like `hikerv-crm.up.railway.app` ✅

### Step 3 — Add a persistent disk (IMPORTANT — keeps your data)

1. In Railway, click your service → **Add Volume**
2. Mount path: `/app/data`
3. Size: 1GB (free)

Without this, data resets on redeploy. With it, your SQLite database persists forever.

---

## Option B — Deploy to Render (Also free)

1. Go to https://render.com and sign up
2. Click **New → Web Service → Connect GitHub repo**
3. Select your `hikerv-crm` repo
4. Settings:
   - Build command: `npm install`
   - Start command: `npm start`
5. Click **Advanced → Add Disk**:
   - Mount path: `/app/data`
   - Size: 1GB
6. Click **Create Web Service**
7. Your URL will be `hikerv-crm.onrender.com` ✅

> Note: Render free tier sleeps after 15 minutes of inactivity (cold start ~30 seconds).
> Railway free tier stays awake with $5/month credit.

---

## Run locally (test before deploying)

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open your browser
open http://localhost:3000
```

The database is created automatically at `data/hikerv.db` on first run,
and seeded with all 21 leads and 10 deals from your original Excel file.

---

## API Endpoints

All data is stored in SQLite. The API is fully RESTful:

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/leads | List all leads (supports ?q=&status=&model=&source=&state=) |
| GET | /api/leads/:id | Get single lead |
| POST | /api/leads | Create lead |
| PUT | /api/leads/:id | Update lead |
| PATCH | /api/leads/:id/status | Quick status update |
| DELETE | /api/leads/:id | Delete lead |
| GET | /api/deals | List all deals |
| GET | /api/deals/:id | Get single deal |
| POST | /api/deals | Create deal |
| PUT | /api/deals/:id | Update deal |
| DELETE | /api/deals/:id | Delete deal |
| GET | /api/stats | Dashboard stats (counts, pipeline, breakdowns) |

---

## Multiple users

Once deployed, anyone with the URL can use the CRM simultaneously.
Data is shared — all changes by any user are saved to the same database instantly.

For login/password protection, ask for the "add authentication" upgrade.

---

## Backup your data

```bash
# Download a backup of your database
scp your-server:/app/data/hikerv.db ./backup-$(date +%Y%m%d).db

# Or export via the API
curl https://your-app.railway.app/api/leads > leads-backup.json
curl https://your-app.railway.app/api/deals > deals-backup.json
```
