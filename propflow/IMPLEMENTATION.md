# PropFlow — Implementation Guide

Everything you need to go from local demo to live production. Credentials are set by **you** — agents never touch API keys.

---

## Quick start (local)

```bash
cd /path/to/propflow
python3 -m http.server 3000
# → Open http://localhost:3000
```

Without any credentials, the site runs in **demo mode** — all features work with mock data.

---

## Step 1 — Supabase (database + auth)

### 1a. Create a project
1. Go to [app.supabase.com](https://app.supabase.com) → **New Project**
2. Name it `propflow`, pick a strong password, choose your nearest region
3. Wait ~2 min for provisioning

### 1b. Run the database schema
1. **SQL Editor → New Query** → paste the full contents of `supabase/schema.sql` → **Run**

### 1c. Configure Auth
- **Auth → Settings → Site URL**: your production domain (e.g. `https://propflow.ai`)
- **Auth → Settings → Redirect URLs**: add `https://propflow.ai/auth/verify.html` and `http://localhost:3000/auth/verify.html`
- Enable **Confirm email**

### 1d. Get your keys
**Settings → API**:
- Copy **Project URL** → `SUPABASE_URL`
- Copy **anon/public key** → `SUPABASE_ANON_KEY`
- Copy **service_role/secret key** → `SUPABASE_SERVICE_ROLE_KEY` (keep secret)

### 1e. Update config.js
```js
supabase: {
  url:     'https://YOUR_PROJECT_ID.supabase.co',
  anonKey: 'eyJh...',
},
```

---

## Step 2 — Stripe (payments)

### 2a. Create products
In Stripe Dashboard → **Products** → create three recurring products:

| Product             | Price    |
|---------------------|----------|
| PropFlow Starter    | $49/mo   |
| PropFlow Pro        | $99/mo   |
| PropFlow Team       | $249/mo  |

Copy each **Price ID** (starts with `price_...`).

### 2b. Get API keys
**Developers → API Keys**: copy Publishable key and Secret key.

### 2c. Update config.js
```js
stripe: {
  publishableKey: 'pk_live_...',
  prices: {
    starter: 'price_...',
    pro:     'price_...',
    team:    'price_...',
  },
},
```

### 2d. Set up webhook
1. **Developers → Webhooks → Add endpoint**
2. URL: `https://YOUR_PROJECT_ID.supabase.co/functions/v1/stripe-webhook`
3. Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
4. Copy the **Signing secret** (`whsec_...`)

---

## Step 3 — Deploy Edge Functions

### 3a. Install Supabase CLI
```bash
brew install supabase/tap/supabase
```

### 3b. Link your project
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_ID
```

### 3c. Set secrets
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set STRIPE_PRICE_STARTER=price_...
supabase secrets set STRIPE_PRICE_PRO=price_...
supabase secrets set STRIPE_PRICE_TEAM=price_...
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set RAPIDAPI_KEY=your_key_here
supabase secrets set APP_URL=https://propflow.ai
```

> `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected — do NOT set them manually.

### 3d. Deploy functions
```bash
supabase functions deploy propflow-ai
supabase functions deploy stripe-checkout
supabase functions deploy stripe-webhook
```

---

## Step 4 — Anthropic (Claude AI)

1. [console.anthropic.com](https://console.anthropic.com) → **API Keys → Create Key**
2. Copy the key (`sk-ant-...`)
3. Add via `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`

The AI edge function uses `claude-sonnet-4-6` by default. To change models, edit `supabase/functions/propflow-ai/index.ts`.

---

## Step 5 — RapidAPI / Zillow56 (property data)

1. Sign up at [rapidapi.com](https://rapidapi.com)
2. Search **"Zillow56"** → subscribe (has a free tier)
3. Copy your **API Key** from My Apps
4. `supabase secrets set RAPIDAPI_KEY=your_key`

Without this key, AI search falls back to demo property data. The AI scoring still works.

---

## Step 6 — Google Calendar OAuth

### 6a. Create a Google Cloud project
1. [console.cloud.google.com](https://console.cloud.google.com) → New Project → `PropFlow`
2. **APIs & Services → Enable APIs** → enable **Google Calendar API**

### 6b. Create OAuth credentials
1. **APIs & Services → Credentials → Create → OAuth 2.0 Client ID**
2. Type: **Web application**
3. Authorized JavaScript origins: `http://localhost:3000` and `https://propflow.ai`
4. Copy the **Client ID** (ends in `.apps.googleusercontent.com`)

### 6c. Update config.js
```js
google: {
  clientId: '123456789-abcdef.apps.googleusercontent.com',
  scopes:   'https://www.googleapis.com/auth/calendar',
},
```

### 6d. OAuth consent screen
- User type: **External**
- Add scope: `https://www.googleapis.com/auth/calendar`
- Add your email as a test user while in development
- Submit for Google verification before going to >100 users

---

## Step 7 — Deploy the frontend

PropFlow is static HTML/CSS/JS — deploy to any static host.

### Vercel (recommended, free)
```bash
npm i -g vercel
vercel --prod
```

### Netlify
Drag your `propflow/` folder onto [app.netlify.com/drop](https://app.netlify.com/drop).

### GitHub Pages
Push to GitHub → Settings → Pages → source: root `/`.

> After deploying, update Supabase Auth **Site URL** and **Redirect URLs** to your live domain.

---

## Step 8 — End-to-end test

1. Open your live site → Sign Up → verify email
2. Dashboard loads → check KPIs show (may be blank until real data added)
3. Billing → select plan → Stripe Checkout opens (test card: `4242 4242 4242 4242`)
4. Webhook fires → subscription status updates in Supabase
5. Integrations → Connect Google Calendar → authorize in popup
6. Schedule → Add event → check Google Calendar for sync
7. AI Search → type a natural language query → Claude returns scored results

---

## config.js — full template

```js
window.PROPFLOW_CONFIG = {
  supabase: {
    url:     'https://YOUR_PROJECT_ID.supabase.co',
    anonKey: 'eyJh...',
  },
  stripe: {
    publishableKey: 'pk_live_...',
    prices: {
      starter: 'price_...',
      pro:     'price_...',
      team:    'price_...',
    },
  },
  google: {
    clientId: '123456789-abcdef.apps.googleusercontent.com',
    scopes:   'https://www.googleapis.com/auth/calendar',
  },
};
```

---

## Credentials checklist

- [ ] `config.js` — Supabase URL + Anon Key
- [ ] `config.js` — Stripe Publishable Key + Price IDs
- [ ] `config.js` — Google OAuth Client ID
- [ ] Supabase secret — `STRIPE_SECRET_KEY`
- [ ] Supabase secret — `STRIPE_WEBHOOK_SECRET`
- [ ] Supabase secret — `STRIPE_PRICE_STARTER`, `_PRO`, `_TEAM`
- [ ] Supabase secret — `ANTHROPIC_API_KEY`
- [ ] Supabase secret — `RAPIDAPI_KEY`
- [ ] Supabase secret — `APP_URL`
- [ ] Schema deployed (`supabase/schema.sql`)
- [ ] Edge Functions deployed (3 functions)
- [ ] Stripe webhook endpoint created
- [ ] Supabase Auth redirect URLs set

---

## Troubleshooting

**Stripe webhook not firing** — endpoint URL must be your Supabase functions URL, not your app URL. Check Stripe → Webhooks → Recent deliveries for errors.

**Email verification not sending** — check Supabase → Auth → Logs. Confirm Site URL and Redirect URLs match exactly.

**Google Calendar button does nothing** — verify Client ID in config.js ends in `.apps.googleusercontent.com`. Check browser console for errors from Google Identity Services.

**AI search returns demo data** — verify `ANTHROPIC_API_KEY` and `RAPIDAPI_KEY` are set. Redeploy: `supabase functions deploy propflow-ai`.

**Dashboard shows demo names after login** — auth-guard needs a valid Supabase session. Check your Supabase URL and Anon Key in config.js are correct.
