/**
 * PropFlow — Auth Guard
 * Include this on every dashboard page. Redirects unauthenticated users to login.
 * Also populates sidebar with current user data.
 * Supports demo mode (localStorage propflow_demo_user) when Supabase is not configured.
 */
(async function() {
  const sb = window.supabaseClient;

  // ── DEMO MODE (no Supabase configured) ─────────────────────────────────────
  if (!sb) {
    const demoUser = JSON.parse(localStorage.getItem('propflow_demo_user') || 'null');
    if (!demoUser) {
      // Not even a demo session — redirect to login
      const current = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = '/auth/login.html?redirect=' + current;
      return;
    }

    // Synthesize a profile from demo user
    const profile = {
      id:                  'demo-user',
      full_name:           demoUser.full_name || 'Jordan Mitchell',
      email:               demoUser.email     || 'jordan@demo.propflow.ai',
      role:                demoUser.role      || 'agent',
      brokerage:           demoUser.brokerage || 'Demo Brokerage',
      subscription_plan:   'pro',
      subscription_status: 'trial',
      trial_ends_at:       new Date(Date.now() + 14 * 86400000).toISOString(),
      notif_new_lead:      true,
      notif_price_drop:    true,
      notif_offer:         true,
      notif_message:       true,
      notif_weekly_report: true,
    };

    window.currentUser    = { id: 'demo-user', email: profile.email };
    window.currentProfile = profile;
    populateSidebar(profile, null);
    return;
  }

  // ── LIVE SUPABASE MODE ──────────────────────────────────────────────────────
  const { data: { session } } = await sb.auth.getSession();

  if (!session) {
    // Also check demo fallback before hard-redirecting
    const demoUser = JSON.parse(localStorage.getItem('propflow_demo_user') || 'null');
    if (demoUser) {
      window.currentUser    = { id: 'demo-user', email: demoUser.email || '' };
      window.currentProfile = { ...demoUser, id: 'demo-user', subscription_plan: 'pro', subscription_status: 'trial' };
      populateSidebar(window.currentProfile, null);
      return;
    }
    const current = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = '/auth/login.html?redirect=' + current;
    return;
  }

  // Store user globally
  window.currentUser = session.user;

  // Load profile from DB
  const { data: profile } = await sb
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  window.currentProfile = profile || {};
  populateSidebar(profile, session.user);

  // Listen for sign-out
  document.querySelectorAll('[data-action="signout"]').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.preventDefault();
      await sb.auth.signOut();
      localStorage.removeItem('propflow_demo_user');
      window.location.href = '/auth/login.html';
    });
  });
})();

function populateSidebar(profile, authUser) {
  const fullName = profile?.full_name || authUser?.email?.split('@')[0] || 'You';
  const email    = profile?.email     || authUser?.email || '';
  const initials = getInitials(fullName || email);

  document.querySelectorAll('.s-avatar, .nav-avatar').forEach(el => {
    el.textContent = initials;
  });
  document.querySelectorAll('.s-name').forEach(el => {
    el.textContent = fullName;
  });
  document.querySelectorAll('.s-role').forEach(el => {
    el.textContent = profile?.role === 'team_leader' ? 'Team Leader' : 'Agent';
  });
  document.querySelectorAll('.dash-greeting').forEach(el => {
    el.textContent = getGreeting() + ',';
  });
  document.querySelectorAll('.dash-agent-name').forEach(el => {
    el.textContent = fullName;
  });

  // Show/hide team-leader-only elements
  if (profile?.role === 'team_leader') {
    document.querySelectorAll('.leader-only').forEach(el => el.style.display = '');
  } else {
    document.querySelectorAll('.leader-only').forEach(el => el.style.display = 'none');
  }

  // Wire sign-out for demo mode too
  document.querySelectorAll('[data-action="signout"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('propflow_demo_user');
      window.location.href = '/auth/login.html';
    });
  });
}

function getInitials(str) {
  if (!str) return '?';
  const parts = str.trim().split(/[\s@]+/);
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
