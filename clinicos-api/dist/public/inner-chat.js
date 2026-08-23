/**
 * Doctors My Agency — inner AI chat (calls /api/public/ai-demo).
 * Use on /demo/, booking pages, and patient portal — NOT the IQ Pigeon sales widget.
 */
(function () {
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function InnerChat(root, opts) {
    opts = opts || {};
    this.root = typeof root === 'string' ? document.querySelector(root) : root;
    if (!this.root) return;
    this.apiUrl = opts.apiUrl || '/api/public/ai-demo';
    this.title = opts.title || 'AI Receptionist Demo';
    this.subtitle = opts.subtitle || 'Powered by DMA Clinic Knowledge Engine';
    this.placeholder = opts.placeholder || 'Ask about booking, prices, or hours…';
    this.introMessage = opts.introMessage || 'Hi! I\'m the AI receptionist demo. Ask me to book a dental cleaning, check prices, or clinic hours.';
    this.history = [];
    this.render();
    this.bind();
  }

  InnerChat.prototype.render = function () {
    this.root.innerHTML =
      '<div class="inner-chat">' +
        '<div class="inner-chat-head">' +
          '<div><strong>' + esc(this.title) + '</strong>' +
          '<span class="inner-chat-sub">' + esc(this.subtitle) + '</span></div>' +
        '</div>' +
        '<div class="inner-chat-log" aria-live="polite"></div>' +
        '<form class="inner-chat-form">' +
          '<input type="text" class="inner-chat-input" autocomplete="off" placeholder="' + esc(this.placeholder) + '" />' +
          '<button type="submit" class="inner-chat-send">Send</button>' +
        '</form>' +
      '</div>';
    this.logEl = this.root.querySelector('.inner-chat-log');
    this.form = this.root.querySelector('.inner-chat-form');
    this.input = this.root.querySelector('.inner-chat-input');
    this.sendBtn = this.root.querySelector('.inner-chat-send');
    this.addBubble('ai', this.introMessage);
  };

  InnerChat.prototype.bind = function () {
    var self = this;
    this.form.addEventListener('submit', function (e) {
      e.preventDefault();
      self.send();
    });
  };

  InnerChat.prototype.addBubble = function (role, text) {
    var div = document.createElement('div');
    div.className = 'inner-chat-msg inner-chat-msg--' + role;
    div.innerHTML = '<div class="inner-chat-bubble">' + esc(text) + '</div>';
    this.logEl.appendChild(div);
    this.logEl.scrollTop = this.logEl.scrollHeight;
  };

  InnerChat.prototype.setLoading = function (on) {
    this.sendBtn.disabled = on;
    this.input.disabled = on;
    if (on) {
      this.loadingEl = document.createElement('div');
      this.loadingEl.className = 'inner-chat-msg inner-chat-msg--ai';
      this.loadingEl.innerHTML = '<div class="inner-chat-bubble inner-chat-bubble--typing">Typing…</div>';
      this.logEl.appendChild(this.loadingEl);
      this.logEl.scrollTop = this.logEl.scrollHeight;
    } else if (this.loadingEl) {
      this.loadingEl.remove();
      this.loadingEl = null;
    }
  };

  InnerChat.prototype.buildHistory = function (excludeLast) {
    var items = excludeLast ? this.history.slice(0, -1) : this.history;
    return items.map(function (h) {
      return (h.role === 'user' ? 'Patient: ' : 'AI: ') + h.text;
    }).join('\n');
  };

  InnerChat.prototype.getSessionId = function () {
    try {
      var key = 'dma-web-session';
      var id = localStorage.getItem(key);
      if (!id) {
        id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(key, id);
      }
      return id;
    } catch (_) {
      return 'guest';
    }
  };

  InnerChat.prototype.send = function () {
    var text = (this.input.value || '').trim();
    if (!text) return;
    this.input.value = '';
    this.addBubble('user', text);
    this.history.push({ role: 'user', text: text });
    this.setLoading(true);
    var self = this;
    fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        conversationHistory: this.buildHistory(true),
        sessionId: this.getSessionId(),
      }),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        self.setLoading(false);
        if (!res.ok) {
          self.addBubble('ai', res.data.error || 'AI is unavailable. Check DEEPSEEK_API_KEY on the server.');
          return;
        }
        var reply = res.data.aiReply || res.data.reply || 'No reply received.';
        self.history.push({ role: 'ai', text: reply });
        self.addBubble('ai', reply);
        if (res.data.intent || res.data.leadScore) {
          var meta = [];
          if (res.data.intent) meta.push('Intent: ' + res.data.intent);
          if (res.data.leadScore) meta.push('Lead: ' + res.data.leadScore);
          if (res.data.action && res.data.action !== 'none') meta.push('Action: ' + res.data.action);
          if (meta.length) {
            var note = document.createElement('div');
            note.className = 'inner-chat-meta';
            note.textContent = meta.join(' · ');
            self.logEl.appendChild(note);
            self.logEl.scrollTop = self.logEl.scrollHeight;
          }
        }
      })
      .catch(function () {
        self.setLoading(false);
        self.addBubble('ai', 'Network error — could not reach the AI demo API.');
      });
  };

  window.DmaInnerChat = InnerChat;
})();
