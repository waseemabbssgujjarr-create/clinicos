/** Shared register wizard helpers (prototype auth shell). */
(function () {
  function stepper(n) {
    return (
      '<div class="steps">' +
      [1, 2, 3, 4].map(function (i) {
        return '<i class="' + (i <= n ? 'on' : '') + '"></i>';
      }).join('') +
      '</div><div class="xs mut b" style="margin-bottom:6px">Step ' +
      n +
      ' of 4</div>'
    );
  }

  function leftPanel(title, sub) {
    return (
      '<div class="lp">' +
      '<i class="blob" style="width:380px;height:380px;background:#BDEBDD;left:-80px;top:-60px"></i>' +
      '<i class="blob" style="width:320px;height:320px;background:#CFE2FA;right:-60px;bottom:40px;animation-delay:-4s"></i>' +
      '<a class="brand" href="/"><span class="logo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4l2.2-6 4 12 2.2-6H21"/></svg></span><span><b>Doctors My Agency</b><small>Clinicos</small></span></a>' +
      '<div><h2>' +
      title +
      '</h2><p class="lede" style="margin-bottom:24px">' +
      sub +
      '</p>' +
      '<svg viewBox="0 0 400 80" width="100%" height="70" aria-hidden="true"><path class="ecg" d="M0 44h120l16-34 24 66 18-42 14 10h208" fill="none" stroke="#14967F" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
      '<div class="xs mut">© Clinicos · Doctors My Agency · 2026</div></div>'
    );
  }

  function mountShell(step, title, sub, formHtml, extraClass) {
    document.documentElement.setAttribute('data-theme', 'light');
    var root = document.getElementById('reg-root');
    if (!root) return;
    root.innerHTML =
      '<div class="au">' +
      leftPanel(title, sub) +
      '<div class="ra"><div class="fm ' +
      (extraClass || '') +
      '">' +
      stepper(step) +
      formHtml +
      '</div></div></div>';
    wirePasswordToggles(root);
  }

  function wirePasswordToggles(scope) {
    (scope || document).querySelectorAll('[data-showpw]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var inp = btn.parentNode.querySelector('input');
        if (!inp) return;
        inp.type = inp.type === 'password' ? 'text' : 'password';
        btn.setAttribute('aria-label', inp.type === 'password' ? 'Show password' : 'Hide password');
      });
    });
  }

  function requireToken(redirect) {
    if (!localStorage.getItem('token')) {
      location.replace(redirect || '/register/');
      return false;
    }
    return true;
  }

  window.OsRegister = {
    mountShell: mountShell,
    stepper: stepper,
    requireToken: requireToken,
    wirePasswordToggles: wirePasswordToggles,
  };
})();
