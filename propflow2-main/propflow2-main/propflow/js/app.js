/**
 * PropFlow — Shared Utilities
 * Available on every page.
 */

// ── TOAST NOTIFICATIONS ────────────────────────────────────────────────
window.toast = function(message, type = 'success', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ'}</span><span>${message}</span>`;
  container.appendChild(t);
  setTimeout(() => {
    t.style.animation = 'toastOut .3s ease forwards';
    setTimeout(() => t.remove(), 300);
  }, duration);
};

// ── CLOCK ─────────────────────────────────────────────────────────────
window.startClock = function() {
  function tick() {
    const now = new Date();
    document.querySelectorAll('[data-live="date"]').forEach(el => {
      el.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    });
    document.querySelectorAll('[data-live="time"]').forEach(el => {
      el.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    });
  }
  tick();
  setInterval(tick, 1000);
};

// ── MODALS ─────────────────────────────────────────────────────────────
window.openModal = function(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('active');
};
window.closeModal = function(id) {
  if (id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('active');
  } else {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  }
};
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) closeModal(e.target.id);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── LOADING BUTTON ────────────────────────────────────────────────────
window.setLoading = function(btn, loading, text) {
  if (!btn) return;
  if (loading) {
    btn._originalText = btn.innerHTML;
    btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;margin:0;border-width:2px;"></div>';
    btn.disabled = true;
  } else {
    btn.innerHTML = text || btn._originalText || btn.innerHTML;
    btn.disabled = false;
  }
};

// ── FORMAT HELPERS ────────────────────────────────────────────────────
window.fmt = {
  currency: (n) => n >= 1000000
    ? '$' + (n / 1000000).toFixed(1) + 'M'
    : n >= 1000 ? '$' + Math.round(n / 1000) + 'k' : '$' + n,
  date: (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  relTime: (d) => {
    const s = Math.floor((Date.now() - new Date(d)) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  },
  phone: (p) => p ? p.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3') : '',
  sqft: (n) => n ? n.toLocaleString() + ' sqft' : '',
};

// ── AI SEARCH ─────────────────────────────────────────────────────────
window.runAISearch = async function(prompt, clientContext = null) {
  const sb = window.supabaseClient;
  const config = window.PROPFLOW_CONFIG;

  if (!sb || config?.supabase?.url === 'YOUR_SUPABASE_URL') {
    throw new Error('PropFlow is not configured. Please complete setup in config.js.');
  }

  const context = clientContext
    ? `Client: ${clientContext.name}, Budget: ${clientContext.budget}, Preferences: ${clientContext.notes}`
    : 'General search, no specific client';

  const { data, error } = await sb.functions.invoke('propflow-ai', {
    body: {
      action: 'property_search',
      prompt,
      context,
      location: window.userLocation || null,
    },
  });

  if (error) throw error;
  return data;
};

// ── LOCATION ──────────────────────────────────────────────────────────
window.requestLocation = function() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        window.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        resolve(window.userLocation);
      },
      () => resolve(null),
      { timeout: 8000 }
    );
  });
};

// ── SIDEBAR ACTIVE STATE ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  startClock();

  const path = window.location.pathname;
  document.querySelectorAll('.sidebar-item').forEach(item => {
    const href = item.getAttribute('href') || '';
    if (href && path.endsWith(href.replace('../', '/').replace('./', '/'))) {
      item.classList.add('active');
    }
  });
});
