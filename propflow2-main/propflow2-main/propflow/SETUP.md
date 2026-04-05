# PropFlow — Setup Guide

Everything you need to go from local demo → production. All credentials are set by **you** (the admin/developer) — your agents never touch API keys.

---

## What you need to provide

| Service | What you get | Where |
|---|---|---|
| Supabase | URL + Anon Key + Service Role Key | app.supabase.com |
| Stripe | Publishable Key + Secret Key + Price IDs + Webhook Secret | dashboard.stripe.com |
| Anthropic | API Key (Claude AI) | console.anthropic.com |
| RapidAPI (Zillow56) | API Key | rapidapi.com |
| Google Cloud | OAuth 2.0 Client ID | console.cloud.google.com |

---

## Step 1 — Supabase

### 1a. Create a project
1. Go to [app.supabase.com](https://app.supabase.com) → **New Project**
2. Name it `propflow`, pick a strong database password, choose the region closest to your users
3. Wait ~2 minutes for provisioning

### 1b. Run the database schema
1. In your Supabase project → **SQL Editor** → **New Query**
2. Paste the entire contents of `supabase/schema.sql`
3. Click **Run** — all tables, RLS policies, triggers, and indexes are created

### 1c. Configure Auth
1. **Authentication → Settings → Site URL**: set to your production URL (e.g. `https://propflow.ai`)
2. **Authentication → Settings → Redirect URLs**: add `https://propflow.ai/auth/verify.html` and `http://localhost:3000/auth/verify.html`
3. **Authentication → Settings → Email**: enable **Confirm email** and set a nice "From" name like `PropFlow`

### 1d. Get your API keys
1. **Settings → API**
   - Copy **Project URL** → this is `SUPABASE_URL`
   - Copy **anon / public key** → this is `SUPABASE_ANON_KEY`
   - Copy **service_role / secret key** → this is `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)

### 1e. Update config.js
Open `config.js` in the project root and fill in:
```js
supabase: {
  url:     'https://YOUR_PROJECT_ID.supabase.co',
  anonKey: 'eyJh...',
},
```

---

## Step 2 — Stripe

### 2a. Create an account
Sign up at [stripe.com](https://stripe.com) and complete business verification.

### 2b. Create your subscription products
In Stripe Dashboard → **Products** → **Add product** — create three:

| Product | Price | Billing |
|---|---|---|
| PropFlow Starter | $49.00 | Monthly recurring |
| PropFlow Pro | $99.00 | Monthly recurring |
| PropFlow Team | $249.00 | Monthly recurring |

After creating each, copy the **Price ID** (starts with `price_...`).

### 2c. Get API keys
**Developers → API Keys**:
- Copy **Publishable key** (starts with `pk_live_` or `pk_test_`)
- Copy **Secret key** (starts with `sk_live_` or `sk_test_`)

### 2d. Update config.js
```js
stripe: {
  publishableKey: 'pk_live_...',
  prices: {
    starter: 'price_ABC123',
    pro:     'price_DEF456',
    team:    'price_GHI789',
  },
},
```

### 2e. Set up the webhook
1. **Developers → Webhooks → Add endpoint**
2. Endpoint URL: `https://YOUR_PROJECT_ID.supabase.co/functions/v1/stripe-webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. After creating, copy the **Signing secret** (starts with `whsec_...`)

---

## Step 3 — Deploy Supabase Edge Functions

All three Edge Functions (`propflow-ai`, `stripe-checkout`, `stripe-webhook`) need to be deployed and given secrets.

### 3a. Install Supabase CLI
```bash
brew install supabase/tap/supabase
```

### 3b. Log in and link your project
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_ID
```
Your project ID is in your Supabase project URL: `https://app.supabase.com/project/YOUR_PROJECT_ID`

### 3c. Set secrets
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set STRIPE_PRICE_STARTER=price_ABC123
supabase secrets set STRIPE_PRICE_PRO=price_DEF456
supabase secrets set STRIPE_PRICE_TEAM=price_GHI789
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set RAPIDAPI_KEY=your_rapidapi_key
supabase secrets set APP_URL=https://propflow.ai
```

> `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically available inside Edge Functions — you do NOT need to set them manually.

### 3d. Deploy the functions
```bash
supabase functions deploy propflow-ai
supabase functions deploy stripe-checkout
supabase functions deploy stripe-webhook
```

---

## Step 4 — Anthropic (Claude AI)

1. Go to [console.anthropic.com](https://console.anthropic.com) → **API Keys** → **Create Key**
2. Copy the key (starts with `sk-ant-...`)
3. Set it as a Supabase secret (step 3c above) — **never put this in config.js**

The AI edge function is pre-configured to use `claude-opus-4-6`.

---

## Step 5 — RapidAPI / Zillow56 (Real Property Data)

1. Sign up at [rapidapi.com](https://rapidapi.com)
2. Search for **"Zillow56"** and subscribe (has a free tier)
3. In your RapidAPI dashboard → **My Apps** → copy your **API Key**
4. Set it as a Supabase secret (step 3c above): `RAPIDAPI_KEY=...`

Without this key, PropFlow falls back to demo property data. AI search still works.

---

## Step 6 — Google Calendar OAuth

### 6a. Create a Google Cloud project
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. **New Project** → name it `PropFlow`
3. **APIs & Services → Enable APIs** → search and enable **Google Calendar API**

### 6b. Create OAuth credentials
1. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
2. Application type: **Web application**
3. Name: `PropFlow`
4. Authorized JavaScript origins:
   - `http://localhost:3000`
   - `https://propflow.ai` (your production URL)
5. You do NOT need redirect URIs — PropFlow uses the implicit flow via Google Identity Services
6. Copy the **Client ID** (ends in `.apps.googleusercontent.com`)

### 6c. Update config.js
```js
google: {
  clientId: '123456789-abcdef.apps.googleusercontent.com',
  scopes: 'https://www.googleapis.com/auth/calendar',
},
```

### 6d. Configure OAuth consent screen
1. **APIs & Services → OAuth consent screen**
2. User type: **External**
3. Fill in App name (`PropFlow`), support email, developer email
4. Scopes: add `https://www.googleapis.com/auth/calendar`
5. Test users: add your own email while in development
6. To go live: submit for Google verification (required for >100 users)

---

## Step 7 — Deploy your site

PropFlow is static HTML/CSS/JS — deploy anywhere that serves static files.

### Option A — Vercel (recommended, free)
```bash
npm i -g vercel
cd /path/to/propflow
vercel --prod
```

### Option B — Netlify
Drag and drop your `propflow` folder onto [app.netlify.com](https://app.netlify.com/drop).

### Option C — GitHub Pages
Push to GitHub and enable Pages in repository settings (set source to root `/`).

> **Important**: After deploying, update `Supabase → Authentication → Site URL` and `Redirect URLs` to your live domain.

---

## Step 8 — Test end-to-end

1. Open your live site → Sign Up → check email for verification link
2. Verify email → you're redirected to the dashboard
3. Go to **Billing** → select a plan → you're redirected to Stripe Checkout (use test card `4242 4242 4242 4242`)
4. After checkout, your subscription status updates automatically via webhook
5. Go to **Integrations** → Connect Google Calendar → authorize in the popup
6. Go to **Schedule** → Add an event → check Google Calendar for the synced event
7. Go to **AI Search** → type a property search → results are scored by Claude

---

## Credentials checklist

Copy this and tick off each item:

- [ ] `config.js` — Supabase URL
- [ ] `config.js` — Supabase Anon Key
- [ ] `config.js` — Stripe Publishable Key
- [ ] `config.js` — Stripe Price IDs (starter, pro, team)
- [ ] `config.js` — Google OAuth Client ID
- [ ] Supabase secret — `STRIPE_SECRET_KEY`
- [ ] Supabase secret — `STRIPE_WEBHOOK_SECRET`
- [ ] Supabase secret — `STRIPE_PRICE_STARTER`
- [ ] Supabase secret — `STRIPE_PRICE_PRO`
- [ ] Supabase secret — `STRIPE_PRICE_TEAM`
- [ ] Supabase secret — `ANTHROPIC_API_KEY`
- [ ] Supabase secret — `RAPIDAPI_KEY`
- [ ] Supabase secret — `APP_URL`
- [ ] Schema deployed (SQL Editor → schema.sql)
- [ ] Edge Functions deployed (3 functions)
- [ ] Stripe webhook endpoint created + signed secret set
- [ ] Supabase Auth redirect URLs updated

---

## Local development

```bash
cd /path/to/propflow
python3 -m http.server 3000
# Open http://localhost:3000
```

Without credentials filled in, PropFlow runs in **demo mode** — all features work with mock data. Click "Demo Login" on the login page to skip auth.

---

## Troubleshooting

**Stripe webhook not firing**
- Make sure the endpoint URL is your Supabase functions URL, not your app URL
- Check Stripe Dashboard → Webhooks → your endpoint → Recent deliveries for errors

**Email verification not sending**
- Check Supabase → Authentication → Logs
- Make sure your Site URL and Redirect URLs are set correctly

**Google Calendar button does nothing**
- Verify the Client ID in config.js ends in `.apps.googleusercontent.com`
- Check your Authorized JavaScript Origins include the exact URL you're running on

**AI search returns demo data**
- Make sure `ANTHROPIC_API_KEY` and `RAPIDAPI_KEY` are set as Supabase secrets
- Run `supabase functions deploy propflow-ai` to redeploy with the new secrets
