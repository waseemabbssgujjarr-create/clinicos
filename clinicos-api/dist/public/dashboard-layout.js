/**
 * Clinic dashboard layout fixes — CSS-class only (no DOM reparenting; safe for React)
 */
(function () {
  if (!/^\/(dashboard|staff)(\/|$)/.test(location.pathname)) return;

  var ACTION_RE =
    /^(new appointment|add patient|invite staff|request reviews|manage billing|save changes|upload logo|send test|\+ )/i;

  function isActionButton(el) {
    if (!el || el.tagName !== 'BUTTON') return false;
    var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length > 48) return false;
    if (/^(all|today|tomorrow|this week|this month|whatsapp|sms|email|professional|friendly|formal|arrived|complete|cancel|reply)$/i.test(text)) {
      return false;
    }
    return ACTION_RE.test(text) || /^\+/.test(text);
  }

  /** Mark header + CTA with classes only — never move nodes */
  function fixPageHeaders(root) {
    root.querySelectorAll('main h1').forEach(function (h1) {
      if (h1.dataset.dmaHeaderDone) return;

      var headingBlock = h1.parentElement;
      if (!headingBlock) return;

      var scope = headingBlock.parentElement;
      if (!scope) return;

      var actionBtn = null;
      var actionWrap = null;
      var node = headingBlock.nextElementSibling;

      for (var i = 0; i < 5 && node; i++) {
        if (node.tagName === 'BUTTON' && isActionButton(node)) {
          actionBtn = node;
          actionWrap = node;
          break;
        }
        var innerBtn = node.querySelector && node.querySelector(':scope > button');
        if (innerBtn && node.children.length <= 2 && isActionButton(innerBtn)) {
          actionBtn = innerBtn;
          actionWrap = node;
          break;
        }
        if (node.querySelector && (node.querySelector('table') || node.querySelector('form[class*="grid"]'))) {
          break;
        }
        node = node.nextElementSibling;
      }

      headingBlock.classList.add('dma-page-heading-block');
      h1.dataset.dmaHeaderDone = '1';

      if (actionBtn) {
        actionBtn.classList.add('dma-page-cta');
        actionBtn.classList.remove('w-full');
        if (actionWrap) actionWrap.classList.add('dma-page-cta-wrap');
        scope.classList.add('dma-page-header-scope');
      }

      if (/\/dashboard\/staff/.test(location.pathname)) {
        scope.classList.add('dma-staff-page-scope');
        var meta = h1.nextElementSibling;
        if (meta && /member/i.test(meta.textContent || '')) {
          meta.classList.add('dma-staff-meta');
        }
      }
    });
  }

  function fixFilterRows(root) {
    root.querySelectorAll('main button').forEach(function (btn) {
      var text = (btn.textContent || '').trim().toUpperCase();
      if (!/^(ALL|TODAY|TOMORROW|THIS WEEK|THIS MONTH|WHATSAPP|SMS|EMAIL)$/.test(text)) return;
      var row = btn.parentElement;
      if (!row || row.classList.contains('dma-filter-row')) return;
      if (row.querySelectorAll('button').length < 2) return;
      row.classList.add('dma-filter-row');
    });
  }

  function fixInlineActionRows(root) {
    root.querySelectorAll('main [class*="flex"]').forEach(function (row) {
      var input = row.querySelector('input:not([type="hidden"])');
      var btn = row.querySelector('button');
      if (!input || !btn) return;
      if ((btn.textContent || '').match(/send test/i)) {
        row.classList.add('dma-inline-action');
        btn.classList.remove('w-full');
      }
    });
  }

  function fixUploadRows(root) {
    root.querySelectorAll('main button').forEach(function (btn) {
      if (!/upload logo/i.test(btn.textContent || '')) return;
      var row = btn.closest('[class*="flex"]') || btn.parentElement;
      if (row) row.classList.add('dma-upload-row');
    });
  }

  function enhanceEmptyStates(root) {
    root.querySelectorAll('main .card-body, main [class*="rounded"][class*="border"]').forEach(function (panel) {
      if (panel.dataset.dmaEmptyDone) return;
      var text = (panel.textContent || '').replace(/\s+/g, ' ').trim();
      if (/no messages yet|select a conversation|no activity|no data|nothing here/i.test(text)) {
        panel.classList.add('dma-empty-panel');
        panel.dataset.dmaEmptyDone = '1';
      }
    });

    root.querySelectorAll('main [class*="border-b"]').forEach(function (bar) {
      if (bar.querySelectorAll('button').length < 3) return;
      if (/working hours|booking url|general|ai settings|clinic details/i.test(bar.textContent || '')) {
        bar.classList.add('dma-settings-tabs');
        bar.querySelectorAll('button').forEach(function (btn) {
          var cls = btn.className || '';
          if (/text-brand|border-brand|bg-brand/.test(cls)) {
            btn.classList.add('dma-tab-active');
          }
        });
      }
    });
  }

  function fixMessagesLayout(root) {
    if (!/\/dashboard\/messages/.test(location.pathname)) return;
    root.querySelectorAll('main [class*="lg:grid-cols-3"], main [class*="lg:grid-cols-2"]').forEach(function (grid) {
      grid.classList.add('dma-messages-layout');
    });
  }

  function fixQuickActions(root) {
    root.querySelectorAll('main .card').forEach(function (card) {
      var header = card.querySelector('.card-header');
      if (!header || !/quick action/i.test(header.textContent || '')) return;
      card.classList.add('dma-quick-actions-card');
      card.querySelectorAll('.card-body [class*="grid-cols-3"], .card-body [class*="grid-cols-2"], .card-body [class*="grid"]').forEach(function (grid) {
        if (grid.querySelector('button[class*="flex-col"], button.flex-col')) {
          grid.classList.add('dma-quick-actions');
        }
      });
    });
  }

  function runAll() {
    fixPageHeaders(document);
    fixFilterRows(document);
    fixInlineActionRows(document);
    fixUploadRows(document);
    enhanceEmptyStates(document);
    fixMessagesLayout(document);
    fixQuickActions(document);
  }

  function schedule() {
    runAll();
    setTimeout(runAll, 600);
    setTimeout(runAll, 2000);
  }

  if (document.body) schedule();
  else document.addEventListener('DOMContentLoaded', schedule);
})();
