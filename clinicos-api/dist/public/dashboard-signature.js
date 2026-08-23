/**
 * Signature Dashboard UI — Daily Brief, Conversion, Lead Scores, Hot Leads
 * Loaded on /dashboard/ and /dashboard/analytics/ via dashboard-bootstrap.js
 */
(function () {
  var path = location.pathname.replace(/\/$/, '') || '/';
  var isHome = path === '/dashboard';
  var isAnalytics = path === '/dashboard/analytics';
  if (!isHome && !isAnalytics) return;

  function authHeaders() {
    var h = { 'Content-Type': 'application/json' };
    var token = localStorage.getItem('token');
    if (token) h.Authorization = 'Bearer ' + token;
    return h;
  }

  function apiGet(url) {
    return fetch(url, { headers: authHeaders(), credentials: 'include' }).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok) throw new Error(d.error || 'Request failed');
        return d;
      });
    });
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function fmtMoney(n) {
    var v = Number(n) || 0;
    return '$' + v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  function fmtDate(d) {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (_) {
      return '—';
    }
  }

  function scoreBadge(score) {
    var s = (score || 'COLD').toUpperCase();
    var cls = s === 'HOT' ? 'dma-sig-hot' : s === 'WARM' ? 'dma-sig-warm' : 'dma-sig-cold';
    return '<span class="dma-sig-badge ' + cls + '">' + esc(s) + '</span>';
  }

  function statusBadge(st) {
    return '<span class="dma-sig-status">' + esc(st || 'NEW') + '</span>';
  }

  function findMain() {
    return document.querySelector('main') || document.querySelector('[class*="flex-1"]') || document.body;
  }

  /** React dashboard wraps page content in main > div — inject there, not bare main */
  function findContentHost(main) {
    if (!main) return null;
    if (main.tagName === 'MAIN') {
      var host =
        main.querySelector(':scope > div[class*="p-"]') ||
        main.querySelector(':scope > div[class*="space-y"]') ||
        main.querySelector(':scope > div');
      if (host) return host;
    }
    return main;
  }

  function mountSignatureRoot(root) {
    var main = findMain();
    if (!main || !root) return;
    var host = findContentHost(main);
    var existing = document.getElementById('dma-signature-root');
    if (existing) {
      existing.replaceWith(root);
      return;
    }
    host.insertBefore(root, host.firstChild);
  }

  function loadData() {
    return Promise.all([
      apiGet('/api/leads/analytics/daily-brief').catch(function () { return null; }),
      apiGet('/api/leads/analytics/booking-conversion?days=30').catch(function () { return null; }),
      apiGet('/api/leads/analytics/lead-scores').catch(function () { return null; }),
      apiGet('/api/leads?limit=15').catch(function () { return { leads: [], pipeline: {} }; }),
    ]).then(function (arr) {
      return { brief: arr[0], conversion: arr[1], scores: arr[2], leads: arr[3] };
    });
  }

  function renderBriefCard(brief, compact) {
    if (!brief) {
      return '<div class="dma-sig-card dma-sig-brief"><p class="dma-sig-muted">Daily brief will appear once your clinic has activity.</p></div>';
    }
    var actions = [];
    try {
      if (brief.actionItems) actions = typeof brief.actionItems === 'string' ? JSON.parse(brief.actionItems) : brief.actionItems;
    } catch (_) {}
    if (!Array.isArray(actions)) actions = [];
    var actionHtml = actions.length
      ? '<ul class="dma-sig-actions">' + actions.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>'
      : '';
    var stats = compact
      ? '<div class="dma-sig-mini-stats">' +
        '<span><strong>' + (brief.appointmentsToday || 0) + '</strong> appts today</span>' +
        '<span><strong>' + (brief.hotLeads || 0) + '</strong> hot leads</span>' +
        '<span><strong>' + (brief.newLeads || 0) + '</strong> new yesterday</span>' +
        '</div>'
      : '<div class="dma-sig-stat-row">' +
        statBox('Appts today', brief.appointmentsToday) +
        statBox('AI bookings', brief.appointmentsBooked) +
        statBox('Chats handled', brief.chatsHandled) +
        statBox('Hot leads', brief.hotLeads) +
        statBox('Rescued leads', brief.lostLeadsRescued) +
        statBox('Est. revenue', fmtMoney(brief.recoveredRevenue)) +
        '</div>';
    return (
      '<div class="dma-sig-card dma-sig-brief">' +
      '<div class="dma-sig-card-head"><h2>AI Daily Clinic Brief</h2><span class="dma-sig-tag">Signature</span></div>' +
      '<p class="dma-sig-summary">' + esc(brief.summary || 'Your daily summary is being generated.') + '</p>' +
      stats + actionHtml +
      '</div>'
    );
  }

  function statBox(label, val) {
    return '<div class="dma-sig-stat"><span class="dma-sig-stat-val">' + esc(val == null ? '0' : val) + '</span><span class="dma-sig-stat-lbl">' + esc(label) + '</span></div>';
  }

  function renderConversion(conv) {
    if (!conv) {
      return '<div class="dma-sig-card"><p class="dma-sig-muted">Conversion data unavailable.</p></div>';
    }
    return (
      '<div class="dma-sig-card">' +
      '<div class="dma-sig-card-head"><h2>Booking Conversion Insights</h2><span class="dma-sig-tag">Last ' + (conv.periodDays || 30) + ' days</span></div>' +
      '<div class="dma-sig-stat-row dma-sig-stat-row-4">' +
      statBox('Enquiries', conv.totalEnquiries) +
      statBox('Converted', conv.convertedBookings) +
      statBox('Conversion', (conv.conversionRate || 0) + '%') +
      statBox('Est. revenue', fmtMoney(conv.estimatedRevenue)) +
      '</div>' +
      renderRecentTable(conv.recent || [], true) +
      '</div>'
    );
  }

  function renderScores(scores) {
    if (!scores) {
      return '<div class="dma-sig-card"><p class="dma-sig-muted">Lead scores unavailable.</p></div>';
    }
    var hotList = (scores.hotLeads || []).map(function (l) {
      return (
        '<tr><td><strong>' + esc(l.fullName || 'Unknown') + '</strong><br><span class="dma-sig-muted">' + esc(l.phone || '') + '</span></td>' +
        '<td>' + esc(l.treatmentInterest || l.intent || '—') + '</td>' +
        '<td>' + statusBadge(l.status) + '</td>' +
        '<td>' + fmtDate(l.updatedAt) + '</td></tr>'
      );
    }).join('');
    return (
      '<div class="dma-sig-card">' +
      '<div class="dma-sig-card-head"><h2>AI Lead Score</h2><span class="dma-sig-tag">Hot / Warm / Cold</span></div>' +
      '<div class="dma-sig-score-row">' +
      '<div class="dma-sig-score dma-sig-hot-box"><span class="dma-sig-score-num">' + (scores.hot || 0) + '</span><span>Hot</span></div>' +
      '<div class="dma-sig-score dma-sig-warm-box"><span class="dma-sig-score-num">' + (scores.warm || 0) + '</span><span>Warm</span></div>' +
      '<div class="dma-sig-score dma-sig-cold-box"><span class="dma-sig-score-num">' + (scores.cold || 0) + '</span><span>Cold</span></div>' +
      '</div>' +
      (hotList ? '<h3 class="dma-sig-subhead">Hot leads — follow up first</h3><div class="dma-sig-table-wrap"><table class="dma-sig-table"><thead><tr><th>Patient</th><th>Interest</th><th>Status</th><th>Updated</th></tr></thead><tbody>' + hotList + '</tbody></table></div>' : '<p class="dma-sig-muted">No hot leads right now.</p>') +
      '</div>'
    );
  }

  function renderRescue(brief) {
    var rescued = brief && brief.lostLeadsRescued != null ? brief.lostLeadsRescued : 0;
    return (
      '<div class="dma-sig-card dma-sig-rescue">' +
      '<div class="dma-sig-card-head"><h2>Lost Lead Rescue</h2><span class="dma-sig-tag">Auto follow-up</span></div>' +
      '<p class="dma-sig-summary">Automatic WhatsApp follow-ups run every 2 hours for enquiries that have not booked yet (24–48h cadence).</p>' +
      '<div class="dma-sig-rescue-stat"><strong>' + rescued + '</strong> leads rescued recently</div>' +
      '<p class="dma-sig-muted dma-sig-note">Requires Twilio/WhatsApp configured for outbound messages. Scoring and briefs work without it.</p>' +
      '</div>'
    );
  }

  function renderPipeline(leadsData) {
    var p = leadsData && leadsData.pipeline;
    var stages = p && p.pipeline;
    if (!stages || !stages.length) return '';
    return (
      '<div class="dma-sig-card">' +
      '<div class="dma-sig-card-head"><h2>Lead Pipeline</h2></div>' +
      '<div class="dma-sig-pipeline">' +
      stages.map(function (s) {
        return '<div class="dma-sig-pipe-stage"><span class="dma-sig-pipe-count">' + (s.count || 0) + '</span><span class="dma-sig-pipe-label">' + esc(s.status || '') + '</span></div>';
      }).join('') +
      '</div></div>'
    );
  }

  function renderRecentTable(rows, compact) {
    if (!rows || !rows.length) return '<p class="dma-sig-muted">No recent enquiries in this period.</p>';
    var body = rows.slice(0, compact ? 8 : 15).map(function (l) {
      return (
        '<tr><td><strong>' + esc(l.fullName || 'Unknown') + '</strong></td>' +
        '<td>' + scoreBadge(l.leadScore) + '</td>' +
        '<td>' + statusBadge(l.status) + '</td>' +
        '<td>' + esc(l.treatmentInterest || '—') + '</td>' +
        '<td>' + fmtDate(l.createdAt) + '</td></tr>'
      );
    }).join('');
    return (
      '<div class="dma-sig-table-wrap"><table class="dma-sig-table"><thead><tr><th>Patient</th><th>Score</th><th>Status</th><th>Interest</th><th>Date</th></tr></thead><tbody>' +
      body + '</tbody></table></div>'
    );
  }

  function renderAll(data) {
    return (
      '<div id="dma-signature-root" class="dma-signature">' +
      '<div class="dma-sig-header"><div><h1 class="dma-sig-title">Clinic Insights</h1><p class="dma-sig-subtitle">Signature AI analytics — conversion, lead scores, daily brief &amp; rescue</p></div></div>' +
      renderBriefCard(data.brief, false) +
      '<div class="dma-sig-grid-2">' + renderConversion(data.conversion) + renderScores(data.scores) + '</div>' +
      renderPipeline(data.leads) +
      renderRescue(data.brief) +
      '<div class="dma-sig-card"><div class="dma-sig-card-head"><h2>All Recent Leads</h2></div>' +
      renderRecentTable((data.leads && data.leads.leads) || [], false) + '</div>' +
      '</div>'
    );
  }

  function renderHome(data) {
    return (
      '<div id="dma-signature-root" class="dma-signature dma-signature-compact">' +
      renderBriefCard(data.brief, true) +
      '<div class="dma-sig-home-row">' +
      '<a href="/dashboard/analytics/" class="dma-sig-cta">View full insights →</a>' +
      '<span class="dma-sig-home-meta">' + (data.scores ? (data.scores.hot || 0) + ' hot · ' + (data.conversion ? data.conversion.conversionRate : 0) + '% conversion' : '') + '</span>' +
      '</div></div>'
    );
  }

  function showLoading(main) {
    if (document.getElementById('dma-signature-root')) return;
    var el = document.createElement('div');
    el.id = 'dma-signature-root';
    el.className = 'dma-signature dma-signature-loading';
    el.innerHTML = '<p>Loading clinic insights…</p>';
    mountSignatureRoot(el);
  }

  function showError(msg) {
    var root = document.getElementById('dma-signature-root');
    if (root) {
      root.innerHTML = '<div class="dma-sig-card dma-sig-error"><p>' + esc(msg) + '</p><p class="dma-sig-muted">Log in as a doctor to view signature analytics.</p></div>';
    }
  }

  function inject(html) {
    if (!findMain()) return;
    var existing = document.getElementById('dma-signature-root');
    if (existing) {
      var tmp = document.createElement('div');
      tmp.innerHTML = html;
      var next = tmp.firstElementChild;
      if (next) existing.replaceWith(next);
      return;
    }
    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    var root = wrap.firstElementChild;
    if (root) mountSignatureRoot(root);
    if (isAnalytics) {
      document.querySelectorAll('main .space-y-6, main > div > .space-y-6').forEach(function (el, i) {
        if (i === 0 && el.parentElement && el.querySelector('h1')) {
          el.style.display = 'none';
        }
      });
    }
  }

  function init() {
    var main = findMain();
    if (!main) return;
    showLoading(main);
    loadData()
      .then(function (data) {
        inject(isAnalytics ? renderAll(data) : renderHome(data));
      })
      .catch(function (err) {
        showError(err.message || 'Could not load insights');
      });
  }

  function start() {
    init();
    setTimeout(function () {
      if (!document.getElementById('dma-signature-root')) init();
    }, 1500);
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
