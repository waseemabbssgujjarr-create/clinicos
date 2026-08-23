/**
 * Google Reviews page — class markers only (React-safe, no reparenting)
 */
(function () {
  if (!/\/dashboard\/reviews/.test(location.pathname)) return;

  function markReviewsPage() {
    document.body.classList.add('dma-reviews-page');

    document.querySelectorAll('main button').forEach(function (btn) {
      var text = (btn.textContent || '').replace(/\s+/g, ' ').trim();
      if (/request reviews/i.test(text)) {
        btn.classList.add('dma-reviews-request');
        btn.classList.remove('w-full');
      }
      if (/reply/i.test(text) && text.length < 24) {
        btn.classList.add('dma-reply-btn');
        btn.classList.remove('w-full');
        var row = btn.parentElement;
        if (row && row.tagName === 'DIV' && row.querySelectorAll('button').length === 1) {
          row.classList.add('dma-review-actions');
        }
      }
    });

    var grid =
      document.querySelector('main [class*="lg:grid-cols-3"]') ||
      document.querySelector('main [class*="lg:grid-cols-2"]') ||
      document.querySelector('main [class*="grid-cols-1"][class*="lg:grid"]');

    if (grid && !grid.dataset.dmaReviewsMarked) {
      grid.classList.add('dma-reviews-grid');
      grid.dataset.dmaReviewsMarked = '1';

      var directChildren = grid.children;
      var foundSummary = false;

      for (var i = 0; i < directChildren.length; i++) {
        var child = directChildren[i];
        var isCard =
          child.classList.contains('card') ||
          (child.className && /rounded/.test(child.className) && /border/.test(child.className));

        if (!foundSummary && isCard && /4\.|review|google business|g\.page/i.test(child.textContent || '')) {
          child.classList.add('dma-reviews-summary');
          foundSummary = true;
          continue;
        }

        if (child.classList && child.classList.contains('card')) {
          child.classList.add('dma-review-item');
        } else if (child.className && /space-y/.test(child.className)) {
          child.classList.add('dma-reviews-feed');
          child.querySelectorAll('.card, [class*="rounded"][class*="border"]').forEach(function (c) {
            c.classList.add('dma-review-item');
          });
        }
      }
    }

    document.querySelectorAll('main .card [class*="border-l-4"], main .card [class*="bg-brand-light"]').forEach(function (el) {
      if (/your reply/i.test(el.textContent || '')) {
        el.classList.add('dma-clinic-reply');
        el.querySelectorAll('p, span, strong').forEach(function (label) {
          if (/your reply/i.test(label.textContent || '')) {
            label.classList.add('dma-clinic-reply-label');
          }
        });
      }
    });
  }

  function run() {
    markReviewsPage();
  }

  if (document.body) {
    run();
    setTimeout(run, 600);
    setTimeout(run, 1800);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      run();
      setTimeout(run, 600);
    });
  }
})();
