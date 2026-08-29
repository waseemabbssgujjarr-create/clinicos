/**
 * Dashboard fixes — logo upload, billing plans, portal fallback (React-safe)
 */
(function () {
  if (!/^\/(dashboard|staff)(\/|$)/.test(location.pathname)) return;

  var PLANS = [
    {
      id: 'STARTER',
      name: 'Starter',
      price: 29,
      popular: false,
      features: [
        'Full clinic dashboard',
        '500 patients',
        '1,000 AI messages/mo',
        'WhatsApp AI receptionist',
        'SMS reminders',
        'Online booking',
      ],
    },
    {
      id: 'PRO',
      name: 'Pro',
      price: 59,
      popular: true,
      features: [
        'Everything in Starter',
        '2,000 patients',
        '5,000 AI messages/mo',
        'Voice AI phone calls',
        'Advanced analytics',
        'Google review management',
      ],
    },
    {
      id: 'ENTERPRISE',
      name: 'Enterprise',
      price: 99,
      popular: false,
      features: [
        'Everything in Pro',
        'Unlimited patients',
        'Unlimited AI messages',
        '10 staff accounts',
        'Priority support',
      ],
    },
  ];

  function authHeaders(json) {
    var h = json ? { 'Content-Type': 'application/json' } : {};
    var token = localStorage.getItem('token');
    if (token) h.Authorization = 'Bearer ' + token;
    return h;
  }

  function toast(msg, isError) {
    var el = document.createElement('div');
    el.className = 'dma-toast-info';
    el.style.borderColor = isError ? '#fecaca' : '#bbf7d0';
    el.style.color = isError ? '#b91c1c' : '#15803d';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 5000);
  }

  function wireUploadLogo() {
    document.querySelectorAll('main button').forEach(function (btn) {
      if (!/upload logo/i.test(btn.textContent || '')) return;
      if (btn.dataset.dmaLogoWired) return;
      btn.dataset.dmaLogoWired = '1';

      var scope =
        btn.closest('.dma-upload-row') ||
        btn.closest('[class*="flex"]') ||
        btn.parentElement;
      var fileInput =
        (scope && scope.querySelector('input[type="file"]')) ||
        document.querySelector('main input[type="file"]');

      if (!fileInput) {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/jpeg,image/png,image/webp,image/svg+xml';
        fileInput.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;opacity:0;';
        document.body.appendChild(fileInput);
      }

      btn.addEventListener('click', function () {
        fileInput.value = '';
        fileInput.click();
      });

      if (fileInput.dataset.dmaUploadWired) return;
      fileInput.dataset.dmaUploadWired = '1';

      fileInput.addEventListener('change', function () {
        if (!fileInput.files || !fileInput.files[0]) return;
        var file = fileInput.files[0];
        if (file.size > 5 * 1024 * 1024) {
          toast('Logo must be under 5 MB.', true);
          return;
        }
        var fd = new FormData();
        fd.append('logo', file);
        var prev = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Uploading…';
        fetch('/api/settings/logo', {
          method: 'POST',
          headers: authHeaders(false),
          body: fd,
          credentials: 'include',
        })
          .then(function (r) {
            return r.json().then(function (data) {
              if (!r.ok) throw new Error(data.error || 'Upload failed');
              return data;
            });
          })
          .then(function (data) {
            toast('Logo uploaded successfully.', false);
            if (data.logoUrl) {
              var img =
                (scope && scope.querySelector('img')) ||
                document.querySelector('main img[src*="cloudinary"]');
              if (img) img.src = data.logoUrl;
            }
          })
          .catch(function (err) {
            toast(err.message || 'Could not upload logo.', true);
          })
          .finally(function () {
            btn.disabled = false;
            btn.textContent = prev;
          });
      });
    });
  }

  function dedupeBillingPlans() {
    var nodes = document.querySelectorAll('#dma-billing-plans');
    for (var i = 1; i < nodes.length; i++) {
      nodes[i].remove();
    }
  }

  function enhanceBillingPage() {
    if (!/\/dashboard\/billing/.test(location.pathname)) return;
    document.body.classList.add('dma-billing-page');
    dedupeBillingPlans();
    if (document.getElementById('dma-billing-plans') || window.__dmaBillingPlansLoading) return;
    window.__dmaBillingPlansLoading = true;

    fetch('/api/billing/subscription', {
      headers: authHeaders(true),
      credentials: 'include',
    })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (sub) {
        dedupeBillingPlans();
        if (document.getElementById('dma-billing-plans')) return;

        var current = (sub && sub.plan) || 'TRIAL';
        var wrap = document.createElement('section');
        wrap.id = 'dma-billing-plans';
        wrap.className = 'dma-billing-plans';
        wrap.setAttribute('data-dma-injected', '1');
        wrap.innerHTML =
          '<h2 class="dma-billing-plans-title">Upgrade your plan</h2>' +
          '<p class="dma-billing-plans-sub">Choose a plan that fits your clinic. You can change or cancel anytime.</p>' +
          '<div class="dma-billing-plans-grid"></div>';

        var grid = wrap.querySelector('.dma-billing-plans-grid');
        PLANS.forEach(function (plan) {
          var card = document.createElement('article');
          card.className =
            'dma-plan-card' +
            (plan.popular ? ' dma-plan-popular' : '') +
            (plan.id === current ? ' dma-plan-current' : '');
          var feats = plan.features
            .map(function (f) {
              return '<li>' + f + '</li>';
            })
            .join('');
          card.innerHTML =
            '<div class="dma-plan-card-head"><strong>' +
            plan.name +
            '</strong>' +
            (plan.popular ? '<span class="dma-plan-badge">Popular</span>' : '') +
            '</div>' +
            '<div class="dma-plan-price">$' +
            plan.price +
            '<small>/mo</small></div><ul>' +
            feats +
            '</ul><button type="button" class="rounded-btn bg-brand text-white"' +
            (plan.id === current ? ' disabled' : '') +
            '>' +
            (plan.id === current ? 'Current plan' : 'Upgrade to ' + plan.name) +
            '</button>';
          var upgradeBtn = card.querySelector('button');
          if (plan.id !== current) {
            upgradeBtn.addEventListener('click', function () {
              upgradeBtn.disabled = true;
              upgradeBtn.textContent = 'Redirecting…';
              fetch('/api/billing/checkout', {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ plan: plan.id }),
                credentials: 'include',
              })
                .then(function (r) {
                  return r.json().then(function (data) {
                    if (!r.ok) throw new Error(data.error || 'Checkout failed');
                    return data;
                  });
                })
                .then(function (data) {
                  if (data.url) location.href = data.url;
                  else throw new Error('No checkout URL returned');
                })
                .catch(function (err) {
                  toast(err.message || 'Could not start checkout.', true);
                  upgradeBtn.disabled = false;
                  upgradeBtn.textContent = 'Upgrade to ' + plan.name;
                });
            });
          }
          grid.appendChild(card);
        });

        var anchor =
          document.querySelector('main [class*="space-y"]') ||
          document.querySelector('main > div');
        if (anchor) anchor.insertBefore(wrap, anchor.firstChild);
        else document.querySelector('main').appendChild(wrap);

        /* Hide duplicate React "Upgrade your plan" section at bottom */
        document.querySelectorAll('main h2, main .card h2, main h3').forEach(function (h) {
          if (h.closest('#dma-billing-plans')) return;
          var t = (h.textContent || '').trim().toLowerCase();
          if (/upgrade your plan|upgrade plan/.test(t)) {
            var block = h.closest('.card') || h.closest('[class*="space-y"]') || h.parentElement;
            if (block && !block.querySelector('#dma-billing-plans')) {
              block.classList.add('dma-billing-react-upgrade-hidden');
            }
          }
        });

        document.querySelectorAll('main button').forEach(function (btn) {
          if (/manage billing/i.test(btn.textContent || '')) {
            btn.classList.add('dma-billing-portal-btn');
          }
        });

        if (current === 'TRIAL' || (sub && !sub.paymentMethod)) {
          var firstCard = document.querySelector('main .card');
          if (firstCard && !firstCard.querySelector('.dma-billing-hint')) {
            var hint = document.createElement('p');
            hint.className = 'dma-billing-hint';
            hint.setAttribute('data-dma-injected', '1');
            hint.textContent =
              'Manage Billing opens the Stripe portal after you subscribe. Use Upgrade below to start a paid plan.';
            firstCard.appendChild(hint);
          }
        }
      })
      .catch(function () {})
      .finally(function () {
        window.__dmaBillingPlansLoading = false;
      });
  }

  function wireBillingPortalFallback() {
    if (window.__dmaBillingPortalPatch) return;
    window.__dmaBillingPortalPatch = true;
    var origFetch = window.fetch;
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : input && input.url;
      var isPortal =
        url &&
        /\/api\/billing\/portal/i.test(url) &&
        init &&
        (init.method || 'GET').toUpperCase() === 'POST';
      return origFetch.apply(this, arguments).then(function (res) {
        if (!isPortal || res.ok) return res;
        return res.clone().json().then(function (data) {
          var msg = (data && (data.error || data.message)) || '';
          if (/no billing|subscribe first/i.test(msg)) {
            toast('Subscribe to a paid plan first using Upgrade below.', true);
          }
          return res;
        }).catch(function () {
          return res;
        });
      });
    };
  }

  function fixReplyButtons() {
    document.querySelectorAll('main button').forEach(function (btn) {
      var text = (btn.textContent || '').replace(/\s+/g, ' ').trim();
      if (/reply/i.test(text) && text.length < 24) {
        btn.classList.add('dma-reply-btn');
      }
    });
  }

  function runSafe() {
    wireUploadLogo();
    fixReplyButtons();
    if (/\/dashboard\/billing/.test(location.pathname)) {
      enhanceBillingPage();
    }
  }

  wireBillingPortalFallback();

  if (document.body) {
    runSafe();
    setTimeout(runSafe, 800);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      runSafe();
      setTimeout(runSafe, 800);
    });
  }
})();
