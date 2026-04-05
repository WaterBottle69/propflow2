/**
 * PropFlow — Auth Guard
 * Include on every dashboard page.
 * Redirects unauthenticated users to login and populates the sidebar.
 */
(async function () {
  const sb = window.supabaseClient;

  if (!sb) {
    // Supabase not configured — redirect to login with a helpful message
    const current = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = '/auth/login.html?error=not-configured&redirect=' + current;
    return;
  }

  const { data: { session } } = await sb.auth.getSession();

  if (!session) {
    const current = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = '/auth/login.html?redirect=' + current;
    return;
  }

  window.currentUser = session.user;

  const { data: profile } = await sb
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  window.currentProfile = profile || {};
  populateSidebar(profile, session.user);

  document.querySelectorAll('[data-action="signout"]').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.preventDefault();
      await sb.auth.signOut();
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

  if (profile?.role === 'team_leader') {
    document.querySelectorAll('.leader-only').forEach(el => el.style.display = '');
  } else {
    document.querySelectorAll('.leader-only').forEach(el => el.style.display = 'none');
  }
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
