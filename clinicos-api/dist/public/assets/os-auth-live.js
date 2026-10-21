/**
 * Real auth/register API wiring for prototype auth pages (site.js layout).
 */
(function () {
  try {
    document.documentElement.classList.add('os-live-auth');
    document.documentElement.dataset.theme = 'light';
    document.documentElement.style.colorScheme = 'light';
    if (window.OS && OS.S) OS.S.set('theme', 'light');
  } catch (_) {}

  function $(s, r) {
    return (r || document).querySelector(s);
  }

  function syncStore(user, token) {
    if (typeof syncClinicosStore === 'function') syncClinicosStore(user, token);
    else if (user && token) {
      localStorage.setItem('token', token);
      localStorage.setItem('clinicos-store', JSON.stringify({ state: { user: user, token: token }, version: 0 }));
    }
  }

  function apiErrorMessage(d) {
    if (d && d.details && d.details.length) {
      return d.details.map(function (x) {
        return x.message;
      }).join(' ');
    }
    return (d && (d.error || d.message)) || 'Request failed';
  }

  function inviteTokenFromUrl() {
    try {
      return new URLSearchParams(location.search).get('token') || '';
    } catch (_) {
      return '';
    }
  }

  var STAFF_ROLE_LABEL = {
    RECEPTIONIST: 'receptionist',
    NURSE: 'nurse',
    ASSISTANT: 'assistant',
    MANAGER: 'manager',
  };

  function loadInvitePreview() {
    if (!document.body || document.body.dataset.route !== 'accept-invite') return;
    var token = inviteTokenFromUrl();
    var sub = $('#accept-invite-sub');
    if (!token) {
      if (sub) sub.textContent = 'This invite link is missing a token. Open the link from your email.';
      if (window.OS && OS.toast) OS.toast('Invite link is invalid.', 'alert');
      return;
    }
    fetch('/api/auth/invite-preview?token=' + encodeURIComponent(token), { credentials: 'same-origin' })
      .then(function (r) {
        return r.json().then(function (d) {
          return { ok: r.ok, d: d };
        });
      })
      .then(function (res) {
        if (!res.ok) throw new Error(apiErrorMessage(res.d));
        var roleLabel = STAFF_ROLE_LABEL[res.d.role] || String(res.d.role || 'staff member').toLowerCase();
        if (sub) {
          sub.textContent =
            (res.d.clinicName || 'Your clinic') + ' invited you as ' + (roleLabel === 'assistant' ? 'an' : 'a') + ' ' + roleLabel + '.';
        }
        var nameInp = $('#invite-name');
        if (nameInp && res.d.name && !nameInp.value) nameInp.value = res.d.name;
      })
      .catch(function (err) {
        if (sub) sub.textContent = err.message || 'Could not load this invitation.';
        if (window.OS && OS.toast) OS.toast(err.message || 'Could not load invitation', 'alert');
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadInvitePreview);
  } else {
    loadInvitePreview();
  }

  document.addEventListener(
    'submit',
    function (e) {
      var f = e.target;
      if (!f || !f.dataset) return;
      if (f.dataset.act === 'accept-invite') {
        e.preventDefault();
        e.stopImmediatePropagation();
        var token = inviteTokenFromUrl();
        if (!token) {
          if (window.OS && OS.toast) OS.toast('Invite link is missing or invalid.', 'alert');
          return;
        }
        var btn = f.querySelector('[type="submit"]');
        if (typeof setBtnLoading === 'function') setBtnLoading(btn, true, 'Joining…');
        var nameInp = f.querySelector('#invite-name') || f.querySelector('input[type="text"]');
        var passInp = f.querySelector('input[type="password"]');
        var name = nameInp ? String(nameInp.value || '').trim() : '';
        var password = passInp ? passInp.value : '';
        fetch('/api/auth/accept-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token: token, password: password, name: name || undefined }),
        })
          .then(function (r) {
            return r.json().then(function (d) {
              return { ok: r.ok, d: d };
            });
          })
          .then(function (res) {
            if (!res.ok) throw new Error(apiErrorMessage(res.d));
            if (window.OS && OS.toast) OS.toast(res.d.message || 'Account activated.', 'ok');
            location.href = '/staff-login/?accepted=1';
          })
          .catch(function (err) {
            if (window.OS && OS.toast) OS.toast(err.message || 'Could not accept invite', 'alert');
            else alert(err.message || 'Could not accept invite');
          })
          .finally(function () {
            if (typeof setBtnLoading === 'function') setBtnLoading(btn, false);
          });
        return;
      }
      if (f.dataset.act === 'login') {
        e.preventDefault();
        e.stopImmediatePropagation();
        var role = f.dataset.role;
        var btnLogin = f.querySelector('[type="submit"]');
        if (typeof setBtnLoading === 'function') setBtnLoading(btnLogin, true, 'Signing in…');
        var emailInp = f.querySelector('input[type="email"]');
        var passInpLogin = f.querySelector('input[type="password"]');
        var email = emailInp ? emailInp.value : '';
        var passwordLogin = passInpLogin ? passInpLogin.value : '';
        var path =
          role === 'admin'
            ? '/api/auth/superadmin/login'
            : role === 'staff'
              ? '/api/auth/staff/login'
              : '/api/auth/login';
        fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: email, password: passwordLogin }),
        })
          .then(function (r) {
            return r.json().then(function (d) {
              return { ok: r.ok, d: d };
            });
          })
          .then(function (res) {
            if (!res.ok) throw new Error(apiErrorMessage(res.d));
            syncStore(res.d.user, res.d.token);
            if (role === 'admin') location.href = '/superadmin/';
            else if (role === 'staff') location.href = '/dashboard/';
            else location.href = '/dashboard/';
          })
          .catch(function (err) {
            if (window.OS && OS.toast) OS.toast(err.message || 'Sign in failed', 'alert');
            else alert(err.message || 'Sign in failed');
          })
          .finally(function () {
            if (typeof setBtnLoading === 'function') setBtnLoading(btnLogin, false);
          });
        return;
      }
      if (f.dataset.act === 'forgot') {
        e.preventDefault();
        e.stopImmediatePropagation();
        var em = f.querySelector('input[type="email"]');
        fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: em ? em.value : '' }),
        })
          .then(function () {
            f.innerHTML =
              '<div class="band"><span class="bi"></span><div><b>Check your inbox</b><div class="sm mut">If the email has an account, a reset link is on its way.</div></div></div>';
          })
          .catch(function () {
            if (window.OS && OS.toast) OS.toast('Could not send reset email', 'alert');
          });
      }
    },
    true
  );

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href*="register"]');
    if (a && a.classList.contains('btn') && a.href.indexOf('register/plan') > -1) return;
  });
})();
