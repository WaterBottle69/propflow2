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
  t.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ'}</span><span>${message}</span>`;
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
  if (m) { m.classList.add('active'); }
};
window.closeModal = function(id) {
  if (id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('active');
  } else {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  }
};
// Close on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) closeModal(e.target.id);
});
// Close on Escape
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
    ? '$' + (n/1000000).toFixed(1) + 'M'
    : n >= 1000 ? '$' + Math.round(n/1000) + 'k' : '$' + n,
  date: (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  relTime: (d) => {
    const s = Math.floor((Date.now() - new Date(d)) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s/60) + 'm ago';
    if (s < 86400) return Math.floor(s/3600) + 'h ago';
    return Math.floor(s/86400) + 'd ago';
  },
  phone: (p) => p ? p.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3') : '',
  sqft: (n) => n ? n.toLocaleString() + ' sqft' : '',
};

// ── AI SEARCH ─────────────────────────────────────────────────────────
window.runAISearch = async function(prompt, clientContext = null) {
  const sb = window.supabaseClient;
  const config = window.PROPFLOW_CONFIG;

  // Build context string
  const context = clientContext
    ? `Client: ${clientContext.name}, Budget: ${clientContext.budget}, Preferences: ${clientContext.notes}`
    : 'General search, no specific client';

  // Try Edge Function if configured
  if (sb && config?.supabase?.url !== 'YOUR_SUPABASE_URL') {
    try {
      const { data, error } = await sb.functions.invoke('propflow-ai', {
        body: {
          action: 'property_search',
          prompt,
          context,
          location: window.userLocation || null,
        },
      });
      if (!error && data) return data;
    } catch (e) {
      console.warn('[PropFlow AI] Edge function error, using fallback:', e);
    }
  }

  // Demo fallback
  return getDemoResults(prompt, clientContext);
};

function getDemoResults(prompt, client) {
  const p = prompt.toLowerCase();
  const isRental = p.includes('rent') || p.includes('lease') || client?.type === 'renter';
  const isBig = p.includes('3 bed') || p.includes('three') || p.includes('4 bed');
  const hasGarage = p.includes('garage');
  const nearSchool = p.includes('school') || p.includes('district');
  const petFriendly = p.includes('pet') || p.includes('dog') || p.includes('cat');

  const allListings = [
    { id: '1', icon: '🏠', type: 'sale', addr: '88 Oak Avenue, Suite 2', city: 'Madison, WI', price: 329000, beds: 2, baths: 2, sqft: 1240, school_score: 9, score: 96, tags: ['Best value','School A+','Zillow'], source: 'Zillow', lat: 43.073, lng: -89.401 },
    { id: '2', icon: '🏡', type: 'sale', addr: '210 Birchwood Lane', city: 'Madison, WI', price: 344500, beds: 2, baths: 2, sqft: 1310, school_score: 8, score: 91, tags: ['Price drop','Realtor.com','MLS'], source: 'Realtor.com', lat: 43.068, lng: -89.412 },
    { id: '3', icon: '🏢', type: 'rent', addr: '412 Maple St, Unit 3B', city: 'Madison, WI', price: 1850, beds: 2, baths: 2, sqft: 980, school_score: 8, score: 88, tags: ['Pet friendly','Rental','Available now'], source: 'MLS', lat: 43.077, lng: -89.395 },
    { id: '4', icon: '🏘', type: 'rent', addr: '99 Cedar Court, Unit 1A', city: 'Madison, WI', price: 1975, beds: 2, baths: 2, sqft: 1050, school_score: 7, score: 82, tags: ['Rental','Parking'], source: 'Zillow', lat: 43.071, lng: -89.408 },
    { id: '5', icon: '🏠', type: 'sale', addr: '34 Willow Creek Drive', city: 'Madison, WI', price: 415000, beds: 3, baths: 2, sqft: 1780, school_score: 7, score: 87, tags: ['Price drop','Large lot','2-car garage'], source: 'MLS', lat: 43.063, lng: -89.419 },
    { id: '6', icon: '🏡', type: 'sale', addr: '712 Lakeview Blvd', city: 'Madison, WI', price: 448000, beds: 3, baths: 2, sqft: 2100, school_score: 8, score: 85, tags: ['New listing','Zillow','2-car garage'], source: 'Zillow', lat: 43.059, lng: -89.425 },
    { id: '7', icon: '🏠', type: 'rent', addr: '220 Park Street, Unit 4', city: 'Madison, WI', price: 1750, beds: 2, baths: 1, sqft: 880, school_score: 6, score: 79, tags: ['Cheapest','Available now','Cats & dogs OK'], source: 'Realtor.com', lat: 43.074, lng: -89.390 },
  ];

  let filtered = allListings.filter(l => {
    if (isRental && !petFriendly) return l.type === 'rent';
    if (petFriendly) return l.type === 'rent' && l.tags.some(t => t.toLowerCase().includes('pet') || t.toLowerCase().includes('dog'));
    if (isBig || hasGarage) return l.beds >= 3 || l.tags.some(t => t.toLowerCase().includes('garage'));
    return true;
  });

  // Sort by score
  filtered = filtered.sort((a,b) => b.score - a.score).slice(0, 4);

  const priceKey = isRental ? '/mo' : '';
  const marketMedian = isRental ? 1890 : 412000;
  const rangeLabel = isRental ? 'rental' : 'sale';

  return {
    intro: `Found ${filtered.length} properties matching your request. Ranked by PropFlow match score — top pick offers the best combination of ${nearSchool ? 'school district, ' : ''}value, and location.`,
    market_context: {
      median_price: marketMedian,
      price_range: isRental ? '$1,700 – $2,100/mo' : '$310k – $450k',
      avg_dom: 18,
      label: `Median ${rangeLabel} price for this search: ${isRental ? '$' + marketMedian + '/mo' : '$' + (marketMedian/1000).toFixed(0) + 'k'}`,
    },
    listings: filtered.map(l => ({
      ...l,
      price_display: isRental
        ? '$' + l.price.toLocaleString() + '/mo'
        : '$' + l.price.toLocaleString(),
      detail: `${l.beds} bed · ${l.baths} bath · ${l.sqft.toLocaleString()} sqft${nearSchool ? ' · School score ' + l.score/10 + '/10' : ''}`,
    })),
  };
}

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

  // Highlight current sidebar item
  const path = window.location.pathname;
  document.querySelectorAll('.sidebar-item').forEach(item => {
    const href = item.getAttribute('href') || '';
    if (href && path.endsWith(href.replace('../', '/').replace('./', '/'))) {
      item.classList.add('active');
    }
  });
});
