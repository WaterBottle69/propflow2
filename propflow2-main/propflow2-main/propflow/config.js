/**
 * PropFlow Configuration
 * ──────────────────────
 * Fill in your credentials below before deploying.
 * See SETUP.md for step-by-step instructions on each key.
 *
 * SECURITY: Never commit real keys to a public repository.
 * For production, consider injecting secrets via your CI/CD pipeline
 * or using environment-specific build files.
 */
window.PROPFLOW_CONFIG = {

  // ── SUPABASE ──────────────────────────────────────────────────────────────
  // Get from: https://app.supabase.com → Your Project → Settings → API
  supabase: {
    url:     'YOUR_SUPABASE_URL',        // e.g. https://abcdefgh.supabase.co
    anonKey: 'YOUR_SUPABASE_ANON_KEY',   // starts with eyJh...
  },

  // ── STRIPE ────────────────────────────────────────────────────────────────
  // Get from: https://dashboard.stripe.com → Developers → API Keys
  stripe: {
    publishableKey: 'YOUR_STRIPE_PUBLISHABLE_KEY', // pk_live_... or pk_test_...
    prices: {
      starter: 'price_YOUR_STARTER_PRICE_ID',  // $49/mo
      pro:     'price_YOUR_PRO_PRICE_ID',       // $99/mo
      team:    'price_YOUR_TEAM_PRICE_ID',      // $249/mo
    },
  },

  // ── ANTHROPIC / CLAUDE AI ─────────────────────────────────────────────────
  // The AI runs inside a Supabase Edge Function — set the Anthropic API key
  // as a Supabase secret (ANTHROPIC_API_KEY), not here. See SETUP.md.
  ai: {
    model: 'claude-opus-4-6',
    edgeFunctionUrl: '/functions/v1/propflow-ai',
  },

  // ── GOOGLE (OAuth 2.0 + Calendar API) ────────────────────────────────────
  // Get from: https://console.cloud.google.com → APIs & Services → Credentials
  // Create an OAuth 2.0 Client ID (Web application type).
  // Add your domain to Authorized JavaScript origins.
  google: {
    clientId: 'YOUR_GOOGLE_CLIENT_ID', // ends with .apps.googleusercontent.com
    scopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
  },

  // ── ZILLOW (Premier Agent / RapidAPI) ─────────────────────────────────────
  // Option A — RapidAPI Zillow proxy (recommended for most users):
  //   Sign up at https://rapidapi.com and subscribe to "Zillow56" or "zillow-com1".
  //   Set the key as a Supabase secret: RAPIDAPI_KEY
  //
  // Option B — Zillow Premier Agent OAuth (requires Zillow partnership):
  //   Register at https://www.zillow.com/howto/api/APIOverview.htm
  //   Set the clientId below and add your OAuth callback URL to Zillow's allowlist.
  zillow: {
    rapidApiHost: 'zillow-com1.p.rapidapi.com', // reference for Edge Function
    oauth: {
      clientId:    'YOUR_ZILLOW_CLIENT_ID',
      redirectUri: typeof window !== 'undefined'
        ? window.location.origin + '/auth/oauth-callback.html'
        : '',
      // Zillow Premier Agent authorization endpoint
      authUrl:     'https://api.zillow.com/connect/v2/authorize',
      scope:       'zillow_profile leads',
    },
  },

  // ── REALTOR.COM ───────────────────────────────────────────────────────────
  // Register at https://developer.realtor.com to get OAuth credentials.
  // Add your OAuth callback URL to the allowed redirect URIs in the portal.
  realtorCom: {
    oauth: {
      clientId:    'YOUR_REALTOR_COM_CLIENT_ID',
      redirectUri: typeof window !== 'undefined'
        ? window.location.origin + '/auth/oauth-callback.html'
        : '',
      authUrl:     'https://sso.realtor.com/api/v2/oauth2/authorize',
      scope:       'profile_read lead_read',
    },
  },

  // ── DOCUSIGN ──────────────────────────────────────────────────────────────
  // Register at https://developers.docusign.com → Apps & Keys
  // Create an OAuth app, add your callback URL to the allowed redirect list.
  // Use production URL (account.docusign.com) for live; account-d.docusign.com for dev.
  docusign: {
    oauth: {
      clientId:    'YOUR_DOCUSIGN_INTEGRATION_KEY',
      redirectUri: typeof window !== 'undefined'
        ? window.location.origin + '/auth/oauth-callback.html'
        : '',
      authUrl:     'https://account.docusign.com/oauth/auth',
      scope:       'signature extended',
    },
  },

  // ── APP SETTINGS ──────────────────────────────────────────────────────────
  app: {
    name: 'PropFlow',
    url:  typeof window !== 'undefined' ? window.location.origin : '',
    // Supabase email-verification redirect
    authRedirectUrl: typeof window !== 'undefined'
      ? window.location.origin + '/auth/verify.html'
      : '',
    // OAuth callback — must match all OAuth provider allowlists
    oauthCallbackUrl: typeof window !== 'undefined'
      ? window.location.origin + '/auth/oauth-callback.html'
      : '',
  },
};
