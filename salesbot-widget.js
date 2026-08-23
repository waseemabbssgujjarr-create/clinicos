window.SalesBotConfig = {
  botId: '21',
  color: '#F97316',
  apiBase: typeof window !== 'undefined' ? window.location.origin : '',
  botName: 'Sara — Doctor My Agency',
  bottomOffset: 20,
  isDemo: true,
};

(function () {
  var BRAND = '#F97316';
  var BRAND_DARK = '#ea580c';

  function isMobileChat() {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  function injectWidgetTheme() {
    var id = 'dma-salesbot-theme';
    if (document.getElementById(id)) return;
    var style = document.createElement('style');
    style.id = id;
    style.textContent =
      '#salesbot-bubble{background-color:' + BRAND + '!important}' +
      '#salesbot-header{background:linear-gradient(135deg,' + BRAND + ' 0%,' + BRAND_DARK + ' 100%)!important}' +
      '.sb-msg.user{background:' + BRAND + '!important}' +
      '#salesbot-send{background:' + BRAND + '!important}' +
      '#salesbot-input:focus{border-color:' + BRAND + '!important;box-shadow:0 0 0 3px rgba(249,115,22,0.15)!important}' +
      '#salesbot-window,#salesbot-bubble{position:fixed!important;margin:0!important;z-index:2147483000!important}' +
      '#salesbot-window.open{display:flex!important;flex-direction:column!important;overflow:hidden!important;opacity:1!important;visibility:visible!important}' +
      '#salesbot-window:not(.open){display:none!important;height:0!important;overflow:hidden!important;visibility:hidden!important}' +
      '#salesbot-bubble.hidden{opacity:0!important;pointer-events:none!important}' +
      '#salesbot-header{flex-shrink:0!important}' +
      '#salesbot-messages{flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior:contain!important}' +
      '#salesbot-input-area{flex-shrink:0!important;background:#fff!important}' +
      '#salesbot-powered{flex-shrink:0!important}' +
      'body.dma-salesbot-open{overflow:hidden!important;touch-action:none}' +
      'body.dma-salesbot-keyboard #salesbot-powered{display:none!important}' +
      '@media (max-width:768px){' +
        '#salesbot-window.open{left:0!important;right:0!important;width:100%!important;max-width:100%!important;border-radius:0!important;bottom:auto!important;transform:none!important}' +
        '#salesbot-input{font-size:16px!important}' +
      '}';
    document.head.appendChild(style);
  }

  function scrollMessagesToBottom() {
    var messages = document.getElementById('salesbot-messages');
    if (!messages) return;
    requestAnimationFrame(function () {
      messages.scrollTop = messages.scrollHeight;
    });
  }

  function syncOpenState() {
    var win = document.getElementById('salesbot-window');
    var bubble = document.getElementById('salesbot-bubble');
    if (!win) return;

    var isOpen = win.classList.contains('open');
    document.body.classList.toggle('dma-salesbot-open', isOpen);

    if (isOpen) {
      win.style.removeProperty('display');
      win.style.removeProperty('height');
      win.style.removeProperty('overflow');
      win.style.removeProperty('visibility');
      if (bubble) bubble.style.removeProperty('display');
      fitChatToViewport();
      scrollMessagesToBottom();
    }
  }

  function fitChatToViewport() {
    var win = document.getElementById('salesbot-window');
    if (!win || !win.classList.contains('open')) return;

    var vv = window.visualViewport;
    var mobile = isMobileChat();

    if (!mobile || !vv) {
      document.body.classList.remove('dma-salesbot-keyboard');
      win.style.removeProperty('top');
      win.style.removeProperty('left');
      win.style.removeProperty('right');
      win.style.removeProperty('bottom');
      win.style.removeProperty('width');
      win.style.removeProperty('height');
      win.style.removeProperty('max-height');
      win.style.removeProperty('transform');
      return;
    }

    var top = Math.max(0, vv.offsetTop);
    var height = vv.height;
    var keyboardOpen = height < window.innerHeight - 72;

    document.body.classList.toggle('dma-salesbot-keyboard', keyboardOpen);

    win.style.setProperty('position', 'fixed', 'important');
    win.style.setProperty('top', top + 'px', 'important');
    win.style.setProperty('left', '0', 'important');
    win.style.setProperty('right', '0', 'important');
    win.style.setProperty('bottom', 'auto', 'important');
    win.style.setProperty('width', '100%', 'important');
    win.style.setProperty('height', height + 'px', 'important');
    win.style.setProperty('max-height', height + 'px', 'important');
    win.style.setProperty('transform', 'none', 'important');

    scrollMessagesToBottom();
  }

  function ensureInputVisible() {
    fitChatToViewport();
    var input = document.getElementById('salesbot-input');
    var inputArea = document.getElementById('salesbot-input-area');
    if (inputArea && inputArea.scrollIntoView) {
      try {
        inputArea.scrollIntoView({ block: 'end', behavior: 'auto' });
      } catch (_) {
        inputArea.scrollIntoView(false);
      }
    }
    if (input && input.scrollIntoView) {
      try {
        input.scrollIntoView({ block: 'end', behavior: 'auto' });
      } catch (_) {
        input.scrollIntoView(false);
      }
    }
    scrollMessagesToBottom();
  }

  function scheduleInputVisible() {
    [0, 50, 150, 320, 550, 900].forEach(function (ms) {
      setTimeout(ensureInputVisible, ms);
    });
  }

  function patchSalesBotUX() {
    var win = document.getElementById('salesbot-window');
    var bubble = document.getElementById('salesbot-bubble');
    var input = document.getElementById('salesbot-input');
    var messages = document.getElementById('salesbot-messages');
    if (!win || !bubble || win.dataset.dmaPatched) return;
    win.dataset.dmaPatched = '1';

    new MutationObserver(syncOpenState).observe(win, {
      attributes: true,
      attributeFilter: ['class'],
    });

    bubble.addEventListener('click', function () {
      setTimeout(syncOpenState, 0);
      setTimeout(function () {
        syncOpenState();
        if (isMobileChat()) scheduleInputVisible();
      }, 300);
    }, true);

    var closeBtn = document.getElementById('salesbot-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        setTimeout(syncOpenState, 0);
      }, true);
    }

    if (input) {
      input.addEventListener('focus', scheduleInputVisible);
      input.addEventListener('click', scheduleInputVisible);
      input.addEventListener('input', function () {
        scrollMessagesToBottom();
        fitChatToViewport();
      });
    }

    if (messages) {
      new MutationObserver(scrollMessagesToBottom).observe(messages, {
        childList: true,
        subtree: true,
      });
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', function () {
        fitChatToViewport();
        scrollMessagesToBottom();
      });
      window.visualViewport.addEventListener('scroll', fitChatToViewport);
    }

    window.addEventListener('resize', function () {
      if (win.classList.contains('open')) fitChatToViewport();
    });

    syncOpenState();
  }

  window.__dmaSalesBotSync = syncOpenState;

  if (window.__salesBotLoading) return;
  window.__salesBotLoading = true;

  function wireOpenHelper() {
    injectWidgetTheme();
    patchSalesBotUX();

    window.openSalesBot = function () {
      var bubble = document.getElementById('salesbot-bubble');
      var win = document.getElementById('salesbot-window');
      if (bubble) {
        bubble.click();
      } else if (win) {
        win.classList.add('open');
        var b = document.getElementById('salesbot-bubble');
        if (b) b.classList.add('hidden');
      }
      syncOpenState();
    };

    document.querySelectorAll('[data-open-chat]').forEach(function (el) {
      if (el.dataset.chatBound) return;
      el.dataset.chatBound = '1';
      el.addEventListener('click', function (e) {
        if (el.tagName === 'A' && el.getAttribute('href') === '#') e.preventDefault();
        window.openSalesBot();
      });
    });

    var openChat =
      window.location.search.indexOf('openChat=1') !== -1 ||
      window.location.pathname.replace(/\/$/, '') === '/demo';
    if (openChat) {
      setTimeout(function () { window.openSalesBot(); }, 1400);
    }
  }

  var s = document.createElement('script');
  s.src = 'https://iqpigeon.com/assets/js/chat-widget.js?v=1784196863';
  s.async = true;
  s.onload = function () {
    injectWidgetTheme();
    setTimeout(injectWidgetTheme, 500);
    setTimeout(injectWidgetTheme, 1500);
    wireOpenHelper();
    setTimeout(patchSalesBotUX, 400);
    setTimeout(patchSalesBotUX, 1500);
    if (typeof window.trimLandingFooterGap === 'function') {
      window.trimLandingFooterGap();
      setTimeout(window.trimLandingFooterGap, 300);
      setTimeout(window.trimLandingFooterGap, 1500);
    }
  };
  document.body.appendChild(s);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(wireOpenHelper, 2000);
    });
  } else {
    setTimeout(wireOpenHelper, 2000);
  }
})();
