/**
 * PropFlow — Auth Guard
 * Include this on every dashboard page. Redirects unauthenticated users to login.
 * Also populates sidebar with current user data.
 */
(async function() {
  const sb = window.supabaseClient;
  if (!sb) return; // Not configured yet — allow access for demo

  const { data: { session } } = await sb.auth.getSession();

  if (!session) {
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

  // Populate sidebar avatar
  const initials = getInitials(profile?.full_name || session.user.email);
  document.querySelectorAll('.s-avatar, .nav-avatar').forEach(el => {
    el.textContent = initials;
  });
  document.querySelectorAll('.s-name').forEach(el => {
    el.textContent = profile?.full_name || session.user.email.split('@')[0];
  });
  document.querySelectorAll('.s-role').forEach(el => {
    el.textContent = profile?.role === 'team_leader' ? 'Team Leader' : 'Agent';
  });
  document.querySelectorAll('.dash-greeting').forEach(el => {
    el.textContent = getGreeting() + ',';
  });
  document.querySelectorAll('.dash-agent-name').forEach(el => {
    el.textContent = profile?.full_name || session.user.email.split('@')[0];
  });

  // Show/hide team-leader-only elements
  if (profile?.role === 'team_leader') {
    document.querySelectorAll('.leader-only').forEach(el => el.style.display = '');
  } else {
    document.querySelectorAll('.leader-only').forEach(el => el.style.display = 'none');
  }

  // Listen for sign-out
  document.querySelectorAll('[data-action="signout"]').forEach(el => {
    el.addEventListener('click', async () => {
      await sb.auth.signOut();
      window.location.href = '/auth/login.html';
    });
  });
})();

function getInitials(str) {
  if (!str) return '?';
  const parts = str.split(/[\s@]/);
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
