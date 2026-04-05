/**
 * PropFlow — Supabase Client
 * Initializes the Supabase client using config.js credentials.
 * Include AFTER config.js and BEFORE any page scripts.
 */

// Wait for config to be available
(function() {
  const cfg = window.PROPFLOW_CONFIG?.supabase;
  if (!cfg || cfg.url === 'YOUR_SUPABASE_URL') {
    console.warn('[PropFlow] Supabase not configured. Open config.js and add your credentials.');
    window.supabaseClient = null;
    return;
  }

  // Supabase JS v2 loaded via CDN in each HTML page
  const { createClient } = supabase;
  window.supabaseClient = createClient(cfg.url, cfg.anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });

  console.log('[PropFlow] Supabase client ready.');
})();
