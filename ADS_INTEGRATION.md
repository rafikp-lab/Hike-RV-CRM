# Ads Integration Guide — Google Ads + Meta Lead Ads

Your CRM has three webhook endpoints ready to receive leads automatically:

| Platform | Method | URL |
|----------|--------|-----|
| Google Ads | Direct webhook | `POST /api/webhooks/google` |
| Meta / Facebook | Direct webhook | `GET+POST /api/webhooks/meta` |
| Zapier / Make | Universal | `POST /api/webhooks/zapier` |

---

## Prerequisites

1. Your CRM is deployed and live (e.g. `https://hikerv-crm.up.railway.app`)
2. You have set `WEBHOOK_SECRET` in your Railway/Render environment variables
3. You have a Google Ads account with Lead Form Extensions, OR a Meta Ads account with Lead Ads

---

## PATH A — Direct Webhook (no third-party tools)

### Google Ads Lead Form Webhook

Google Ads can POST to your webhook every time someone submits a lead form.

**Step 1 — Create a Lead Form Extension in Google Ads**
1. Go to Google Ads → Campaigns → select your campaign
2. Click **Extensions → Lead Form Extensions**
3. Create your form with these recommended fields:
   - Full name
   - Email
   - Phone number
   - Custom question: "Which model are you interested in?" → map to `model`
   - Custom question: "Which state are you in?" → map to `state`
   - Custom question: "Message" → map to `message`

**Step 2 — Add your webhook URL**
1. In the Lead Form, scroll to **Webhook**
2. Set webhook URL to: `https://your-app.up.railway.app/api/webhooks/google`
3. Set key to: your `WEBHOOK_SECRET` value
4. Click **Send test data** → you should see a new lead in your CRM

**Step 3 — Field mapping (already done in your code)**
Google sends fields like `FULL_NAME`, `EMAIL`, `PHONE_NUMBER`. The webhook automatically maps:

| Google field | CRM field |
|---|---|
| FULL_NAME | name |
| EMAIL | email |
| PHONE_NUMBER | phone |
| STATE | state |
| model / VEHICLE_TYPE | model |
| MESSAGE | notes |

If you used custom field names in your form, edit `mapGoogleLead()` in `src/webhooks.js`.

---

### Meta / Facebook Lead Ads Webhook

**Step 1 — Create a Lead Ad**
1. In Meta Ads Manager → create a new campaign → objective: **Lead Generation**
2. At ad level, create an **Instant Form** with:
   - Full name, Email, Phone number
   - Custom question: "Which model interests you?" (name it `model_interest`)
   - Custom question: "Your state?" (name it `state`)
   - Custom question: "Message" (name it `message`)

**Step 2 — Set up the webhook in Meta for Developers**
1. Go to developers.facebook.com → Your App → **Webhooks**
2. Click **Subscribe to a new topic → Page**
3. Set:
   - Callback URL: `https://your-app.up.railway.app/api/webhooks/meta`
   - Verify Token: your `META_VERIFY_TOKEN` value (same as `WEBHOOK_SECRET`)
4. Click **Verify and Save**
5. Subscribe to the `leadgen` event

**Step 3 — Link your Facebook Page**
1. In your App → **Lead Ads** → link the Facebook Page your ads run from
2. Test with Meta's Lead Ads Testing Tool:
   facebook.com/ads/leadgen/test-ads
   Select your page + form → Submit → lead appears in CRM ✅

**Field mapping:**
| Meta field name (in your form) | CRM field |
|---|---|
| full_name | name |
| email | email |
| phone_number | phone |
| state | state |
| model_interest | model |
| message | notes |

---

## PATH B — Zapier (no-code, 15 minutes)

Use Zapier if you don't want to touch Meta/Google developer settings.

### Google Ads → CRM via Zapier

1. Go to zapier.com → **Create Zap**
2. **Trigger:** Google Ads → New Lead Form Entry
   - Connect your Google Ads account
   - Select your campaign and lead form
3. **Action:** Webhooks by Zapier → POST
   - URL: `https://your-app.up.railway.app/api/webhooks/zapier`
   - Payload type: JSON
   - Headers: `x-webhook-secret` = your `WEBHOOK_SECRET`
   - Data (map from the trigger):
     ```
     name          → Full Name
     email         → Email
     phone         → Phone Number
     state         → State (or your custom question)
     model         → Model Interest (your custom question)
     notes         → Message
     source        → Google Ads
     ```
4. Click **Test & Publish** → check your CRM for a new lead ✅

### Meta Lead Ads → CRM via Zapier

1. **Create Zap**
2. **Trigger:** Facebook Lead Ads → New Lead
   - Connect your Facebook account
   - Select your Page and Form
3. **Action:** Webhooks by Zapier → POST
   - URL: `https://your-app.up.railway.app/api/webhooks/zapier`
   - Headers: `x-webhook-secret` = your `WEBHOOK_SECRET`
   - Data:
     ```
     name          → Full Name
     email         → Email
     phone         → Phone Number
     state         → State
     model         → Model Interest
     notes         → Message
     source        → Meta Ads
     ```
4. **Test & Publish** ✅

### Make (formerly Integromat) — Alternative to Zapier

1. Go to make.com → **Create Scenario**
2. Add module: **Google Ads** (or **Facebook Lead Ads**) → Watch New Leads
3. Add module: **HTTP → Make a request**
   - URL: `https://your-app.up.railway.app/api/webhooks/zapier`
   - Method: POST
   - Headers: `x-webhook-secret` → your secret
   - Body type: JSON
   - Map your fields same as above
4. Schedule: Every 15 minutes (free tier) or instantly (paid)

---

## Testing your webhooks

Test any endpoint without real ads:

```bash
# Test Google Ads webhook
curl -X POST https://your-app.up.railway.app/api/webhooks/test?platform=google

# Test Meta webhook
curl -X POST https://your-app.up.railway.app/api/webhooks/test?platform=meta

# Test Zapier webhook
curl -X POST https://your-app.up.railway.app/api/webhooks/test?platform=zapier
```

Each creates a test lead in your CRM instantly. Check the Leads page to verify.

---

## Email Alerts

Set these environment variables in Railway/Render and every new inbound lead triggers an email:

```
NOTIFY_EMAIL=sales@hikerv.com.au
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx    ← Gmail App Password
APP_URL=https://your-app.up.railway.app
```

The email includes all lead details and a direct link to the CRM.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Meta verification fails | Check `META_VERIFY_TOKEN` matches exactly what you typed in Meta |
| Google webhook not firing | Make sure webhook URL is saved and test data was sent |
| Lead created but fields empty | Edit `mapGoogleLead()` or `mapMetaLead()` in `src/webhooks.js` to match your form field names |
| Email not sending | Check Gmail App Password — must be App Password, not your real password |
| 401 Unauthorized | Check `x-webhook-secret` header matches your `WEBHOOK_SECRET` env var |
