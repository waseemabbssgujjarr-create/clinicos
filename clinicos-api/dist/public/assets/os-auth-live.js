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

  document.addEventListener(
    'submit',
    function (e) {
      var f = e.target;
      if (!f || !f.dataset) return;
      if (f.dataset.act === 'login') {
        e.preventDefault();
        e.stopImmediatePropagation();
        var role = f.dataset.role;
        var btn = f.querySelector('[type="submit"]');
        if (typeof setBtnLoading === 'function') setBtnLoading(btn, true, 'Signing in…');
        var emailInp = f.querySelector('input[type="email"]');
        var passInp = f.querySelector('input[type="password"]');
        var email = emailInp ? emailInp.value : '';
        var password = passInp ? passInp.value : '';
        var path = role === 'admin' ? '/api/auth/superadmin/login' : '/api/auth/login';
        if (role === 'staff') {
          /* staff uses same login endpoint with staff credentials */
        }
        fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: email, password: password }),
        })
          .then(function (r) {
            return r.json().then(function (d) {
              return { ok: r.ok, d: d };
            });
          })
          .then(function (res) {
            if (!res.ok) throw new Error(res.d.error || res.d.message || 'Sign in failed');
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
            if (typeof setBtnLoading === 'function') setBtnLoading(btn, false);
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
