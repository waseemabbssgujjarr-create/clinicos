/**
 * Voice section WhatsApp chat — voice note → transcription → typing → AI reply, ~8s loop
 */
(function () {
  var chat = document.getElementById('waVoiceChatLoop');
  if (!chat) return;

  var TYPING_MS = 1200;
  var LOOP_MS = 8000;
  var MSG_ANIM_MS = 420;

  var sequence = [
    {
      type: 'voice',
      duration: '0:12',
      time: '2:14'
    },
    {
      type: 'msg',
      dir: 'in',
      text: 'I need a Botox appointment next Friday afternoon...',
      time: '2:14',
      transcript: true
    },
    { type: 'typing' },
    {
      type: 'msg',
      dir: 'out',
      text: 'I understood your request! I have Botox slots on Friday at 2pm and 4:30pm. Which would you prefer?',
      time: '2:14'
    }
  ];

  var loopTimer = null;
  var stepTimers = [];

  function wait(ms) {
    return new Promise(function (resolve) {
      stepTimers.push(setTimeout(resolve, ms));
    });
  }

  function scrollToBottom() {
    chat.scrollTop = chat.scrollHeight;
  }

  function createMsg(dir, text, time, transcript) {
    var el = document.createElement('div');
    el.className = 'wa-msg wa-msg-' + dir + (transcript ? ' wa-voice-transcript' : '');
    el.innerHTML =
      '<span class="wa-msg-text">' + text + '</span>' +
      '<span class="wa-msg-time">' + time + '</span>';
    return el;
  }

  function createVoice(duration, time) {
    var el = document.createElement('div');
    el.className = 'wa-voice';
    el.innerHTML =
      '<div class="wa-voice-row">' +
        '<div class="wa-voice-play">▶</div>' +
        '<div class="wa-voice-wave">' +
          '<span></span><span></span><span></span><span></span>' +
          '<span></span><span></span><span></span><span></span>' +
        '</div>' +
      '</div>' +
      '<div class="wa-voice-meta">' +
        '<span class="wa-voice-dur">' + duration + '</span>' +
        '<span class="wa-msg-time">' + time + '</span>' +
      '</div>';
    return el;
  }

  function createTyping() {
    var el = document.createElement('div');
    el.className = 'wa-typing';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<span></span><span></span><span></span>';
    return el;
  }

  function show(el) {
    chat.appendChild(el);
    scrollToBottom();
    requestAnimationFrame(function () {
      el.classList.add('wa-visible');
    });
  }

  function clearTimers() {
    stepTimers.forEach(clearTimeout);
    stepTimers = [];
    if (loopTimer) {
      clearTimeout(loopTimer);
      loopTimer = null;
    }
  }

  async function runSequence() {
    clearTimers();
    chat.innerHTML = '';

    for (var i = 0; i < sequence.length; i++) {
      var step = sequence[i];

      if (step.type === 'voice') {
        show(createVoice(step.duration, step.time));
        await wait(MSG_ANIM_MS + 180);
      } else if (step.type === 'msg') {
        show(createMsg(step.dir, step.text, step.time, step.transcript));
        await wait(MSG_ANIM_MS + 280);
      } else if (step.type === 'typing') {
        var typing = createTyping();
        show(typing);
        await wait(TYPING_MS);
        typing.classList.remove('wa-visible');
        typing.classList.add('wa-hiding');
        await wait(220);
        if (typing.parentNode) typing.parentNode.removeChild(typing);
        await wait(80);
      }
    }

    loopTimer = setTimeout(runSequence, LOOP_MS);
  }

  runSequence();
})();
