/**
 * PropFlow Configuration
 * ─────────────────────
 * Fill in your credentials below.
 * See SETUP.md for instructions on getting each key.
 *
 * IMPORTANT: Do not commit this file with real keys to a public repository.
 */
window.PROPFLOW_CONFIG = {

  // ── SUPABASE ─────────────────────────────────────────────────────────
  // Get from: https://app.supabase.com → Your Project → Settings → API
  supabase: {
    url:    'YOUR_SUPABASE_URL',        // e.g. https://xxxx.supabase.co
    anonKey: 'YOUR_SUPABASE_ANON_KEY', // starts with eyJh...
  },

  // ── STRIPE ───────────────────────────────────────────────────────────
  // Get from: https://dashboard.stripe.com → Developers → API Keys
  stripe: {
    publishableKey: 'YOUR_STRIPE_PUBLISHABLE_KEY', // starts with pk_live_ or pk_test_
    // Price IDs from your Stripe Products (create these in Stripe dashboard)
    prices: {
      starter:  'price_YOUR_STARTER_PRICE_ID',   // $49/mo
      pro:      'price_YOUR_PRO_PRICE_ID',        // $99/mo
      team:     'price_YOUR_TEAM_PRICE_ID',       // $249/mo (up to 10 agents)
    },
  },

  // ── ANTHROPIC / CLAUDE AI ────────────────────────────────────────────
  // The AI is called via a Supabase Edge Function — you set this key
  // in Supabase's dashboard as a secret, NOT here. See SETUP.md.
  // (Kept here only as a reference label.)
  ai: {
    model: 'claude-opus-4-6',
    // Supabase Edge Function endpoint (auto-configured once deployed)
    edgeFunctionUrl: '/functions/v1/propflow-ai',
  },

  // ── GOOGLE CALENDAR OAUTH ────────────────────────────────────────────
  // Get from: https://console.cloud.google.com → APIs → Credentials
  google: {
    clientId: 'YOUR_GOOGLE_CLIENT_ID', // ends in .apps.googleusercontent.com
    scopes: 'https://www.googleapis.com/auth/calendar',
  },

  // ── REAL ESTATE DATA (RapidAPI) ───────────────────────────────────────
  // Sign up at rapidapi.com and subscribe to "Zillow56" and "ATTOM Property API"
  // These are proxied through the Supabase Edge Function — NOT used client-side.
  // Set as Supabase Edge Function secrets. See SETUP.md.
  rapidApi: {
    host: 'zillow56.p.rapidapi.com', // reference only
  },

  // ── APP SETTINGS ──────────────────────────────────────────────────────
  app: {
    name: 'PropFlow',
    url:  window.location.origin,
    // Redirect URL after email verification (must match Supabase Auth settings)
    authRedirectUrl: window.location.origin + '/auth/verify.html',
  },
};
