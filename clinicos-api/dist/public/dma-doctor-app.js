/**
 * Doctors My Agency — shared clinic app runtime.
 * Auth, API, toasts, modals, formatters, deep-links.
 */
(function (global) {
  function token() {
    return localStorage.getItem('token') || '';
  }

  function user() {
    try {
      var raw = localStorage.getItem('clinicos-store');
      var parsed = raw ? JSON.parse(raw) : {};
      return (parsed.state && parsed.state.user) || {};
    } catch (_) {
      return {};
    }
  }

  function headers() {
    var h = { 'Content-Type': 'application/json' };
    var t = token();
    if (t) h.Authorization = 'Bearer ' + t;
    return h;
  }

  function parse(r) {
    return r.text().then(function (txt) {
      var d = {};
      try { d = txt ? JSON.parse(txt) : {}; } catch (_) { d = { error: txt || r.statusText }; }
      return { ok: r.ok, status: r.status, d: d };
    });
  }

  function req(method, path, body) {
    var opts = { method: method, headers: headers(), credentials: 'include' };
    if (body !== undefined) opts.body = JSON.stringify(body);
    return fetch(path, opts).then(parse).then(function (res) {
      if (res.status === 401) {
        logout('/doctor-login/?next=' + encodeURIComponent(location.pathname + location.search));
        return Promise.reject(res);
      }
      return res;
    });
  }

  function get(path) { return req('GET', path).then(function (r) { return r.d; }); }
  function post(path, body) { return req('POST', path, body); }
  function patch(path, body) { return req('PATCH', path, body); }
  function del(path) { return req('DELETE', path); }

  function logout(next) {
    try { localStorage.removeItem('token'); localStorage.removeItem('clinicos-store'); } catch (_) {}
    location.replace(next || '/doctor-login/');
  }

  function requireAuth() {
    if (!token()) {
      location.replace('/doctor-login/?next=' + encodeURIComponent(location.pathname + location.search));
      return false;
    }
    return true;
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function initials(name) {
    var p = String(name || 'DR').trim().split(/\s+/);
    return ((p[0] || 'D').charAt(0) + (p[1] || p[0] || 'R').charAt(0)).toUpperCase();
  }

  function ago(d) {
    if (!d) return '—';
    var t = new Date(d).getTime();
    if (isNaN(t)) return '—';
    var diff = (Date.now() - t) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 172800) return 'Yesterday';
    return new Date(d).toLocaleDateString();
  }

  function money(n, currency) {
    var v = Number(n || 0);
    return (currency || 'PKR') + ' ' + v.toLocaleString();
  }

  function fmtTime(d) {
    if (!d) return '—';
    var dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function fmtDate(d) {
    if (!d) return '—';
    var dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function parseJson(v, fallback) {
    if (v == null || v === '') return fallback;
    if (typeof v === 'object') return v;
    try { return JSON.parse(v); } catch (_) { return fallback; }
  }

  function qs(key, fallback) {
    var v = new URLSearchParams(location.search).get(key);
    return v == null ? (fallback || '') : v;
  }

  function setQs(obj, replace) {
    var p = new URLSearchParams(location.search);
    Object.keys(obj).forEach(function (k) {
      if (obj[k] == null || obj[k] === '') p.delete(k);
      else p.set(k, obj[k]);
    });
    var url = location.pathname + (p.toString() ? '?' + p.toString() : '');
    if (replace) history.replaceState(null, '', url);
    else history.pushState(null, '', url);
  }

  function toast(msg, kind) {
    var root = document.getElementById('dma-toast-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'dma-toast-root';
      document.body.appendChild(root);
    }
    var el = document.createElement('div');
    el.className = 'dma-toast ' + (kind || '');
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(function () { el.remove(); }, 3800);
  }

  function empty(title, body, href, cta) {
    return '<div class="dma-empty">' +
      '<strong>' + esc(title) + '</strong>' +
      (body ? '<p>' + esc(body) + '</p>' : '') +
      (href ? '<a class="dma-btn dma-btn-primary" href="' + esc(href) + '">' + esc(cta || 'Continue') + '</a>' : '') +
      '</div>';
  }

  function spinner() {
    return '<div class="dma-empty"><div class="dma-skel" style="width:180px;height:16px;margin:0 auto 10px"></div><div class="dma-skel" style="width:120px;height:12px;margin:0 auto"></div></div>';
  }

  function chip(status) {
    var s = String(status || '').toUpperCase();
    var map = {
      CONFIRMED: 'green', COMPLETED: 'green', BOOKED: 'green', ACTIVE: 'green', CONNECTED: 'green',
      PENDING: 'amber', WARM: 'amber', ARRIVED: 'amber', IN_PROGRESS: 'amber', TRIAL: 'amber',
      HOT: 'red', NO_SHOW: 'red', CANCELLED: 'red', LOST: 'red', INACTIVE: 'red',
      NEW: 'blue', CONTACTED: 'blue', WHATSAPP: 'wa',
      COLD: 'slate',
    };
    var cls = map[s] || 'slate';
    return '<span class="dma-chip dma-chip-' + cls + '">' + esc(s.replace(/_/g, ' ')) + '</span>';
  }

  function closeModal() {
    var bg = document.getElementById('dma-modal-bg');
    if (bg) bg.remove();
  }

  function modal(title, bodyHtml, footerHtml) {
    closeModal();
    var bg = document.createElement('div');
    bg.className = 'dma-modal-bg';
    bg.id = 'dma-modal-bg';
    bg.innerHTML =
      '<div class="dma-modal" role="dialog" aria-modal="true">' +
        '<div class="dma-modal-h"><h3>' + esc(title) + '</h3>' +
          '<button type="button" class="dma-btn dma-btn-ghost dma-btn-sm" data-close>×</button></div>' +
        '<div class="dma-modal-b">' + bodyHtml + '</div>' +
        (footerHtml ? '<div class="dma-modal-f">' + footerHtml + '</div>' : '') +
      '</div>';
    bg.addEventListener('click', function (e) {
      if (e.target === bg || e.target.getAttribute('data-close') !== null) closeModal();
    });
    document.body.appendChild(bg);
    return bg;
  }

  var _waCache = null;
  function waStatus(force) {
    if (_waCache && !force) return Promise.resolve(_waCache);
    return get('/api/whatsapp/connections/status').then(function (d) {
      _waCache = d || {};
      document.dispatchEvent(new CustomEvent('dma:wa', { detail: _waCache }));
      return _waCache;
    }).catch(function () { return _waCache || {}; });
  }

  function goto(path) { location.href = path; }

  global.DmaApp = {
    token: token,
    user: user,
    headers: headers,
    get: get,
    post: post,
    patch: patch,
    del: del,
    logout: logout,
    requireAuth: requireAuth,
    esc: esc,
    initials: initials,
    ago: ago,
    money: money,
    fmtTime: fmtTime,
    fmtDate: fmtDate,
    parseJson: parseJson,
    qs: qs,
    setQs: setQs,
    toast: toast,
    empty: empty,
    spinner: spinner,
    chip: chip,
    modal: modal,
    closeModal: closeModal,
    waStatus: waStatus,
    goto: goto,
    patient: function (id) { goto('/dashboard/patients/detail/?id=' + encodeURIComponent(id)); },
    messages: function (id) { goto('/dashboard/messages/?patient=' + encodeURIComponent(id || '')); },
    book: function (id) { goto('/dashboard/appointments/?action=book' + (id ? '&patient=' + encodeURIComponent(id) : '')); },
    leads: function (id) { goto('/dashboard/leads/' + (id ? '?id=' + encodeURIComponent(id) : '')); },
    whatsapp: function () { goto('/dashboard/whatsapp/'); },
  };
})(window);
