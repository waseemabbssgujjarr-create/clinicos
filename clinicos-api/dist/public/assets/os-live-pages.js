/**
 * Prototype page structure (clinic.js) with live DmaApp API data.
 * Loaded after clinic.js / clinic2.js; overrides selected OS.reg routes.
 */
(function () {
  if (!window.OS || !window.DmaApp) return;

  var U = OS.U;
  var ic = OS.ic;
  var esc = OS.esc;
  var chip = OS.chip;
  var card = OS.card;
  var head = OS.head;
  var kpi = OS.kpi;
  var empty = OS.empty;

  function A() {
    return DmaApp;
  }

  function greet() {
    var h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function displayName() {
    var u = A().user() || {};
    var n = (u.ownerName || u.name || 'Doctor').trim();
    if (u.role === 'STAFF') return n.split(/\s+/)[0];
    return n.indexOf('Dr') === 0 ? n : n;
  }

  function apptList(d) {
    return (d && (d.data || d.appointments)) || [];
  }

  function statusOf(a) {
    return String(a.status || '').toUpperCase();
  }

  function visitChipCode(a) {
    if (window.DmaClinical && DmaClinical.visitState) {
      return DmaClinical.visitState(a).code || statusOf(a);
    }
    return statusOf(a);
  }

  function feeOf(a) {
    var f = a.fee != null ? Number(a.fee) : NaN;
    return isFinite(f) ? f : 0;
  }

  function money(n) {
    var v = Number(n || 0);
    if (!isFinite(v) || v <= 0) return '—';
    return A().money ? A().money(v) : String(v);
  }

  function fmtTime(dt) {
    return A().fmtTime ? A().fmtTime(dt) : '—';
  }

  function fmtDate(dt) {
    if (!dt) return '—';
    try {
      return new Date(dt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (_) {
      return '—';
    }
  }

  function initials(name) {
    return A().initials ? A().initials(name) : OS.av(name || '?');
  }

  function apRow(a) {
    var p = a.patient || {};
    var name = p.fullName || 'Patient';
    var doc = (a.doctor && a.doctor.fullName) || a.practitionerName || '—';
    return (
      '<div class="slot rv"><span class="tm">' +
      esc(fmtTime(a.dateTime)) +
      '</span>' +
      OS.av(name) +
      '<div class="sp"><div class="b">' +
      esc(name) +
      '</div><div class="xs mut">' +
      esc(a.treatment || 'Visit') +
      ' · ' +
      esc(doc) +
      '</div></div>' +
      chip(visitChipCode(a)) +
      '</div>'
    );
  }

  function waitRow(a, i) {
    var p = a.patient || {};
    var name = p.fullName || 'Patient';
    var doc = (a.doctor && a.doctor.fullName) || '—';
    var mins = Math.max(
      0,
      Math.round((Date.now() - new Date(a.updatedAt || a.dateTime).getTime()) / 60000)
    );
    return (
      '<div class="slot">' +
      OS.av(name) +
      '<div class="sp"><div class="b">' +
      esc(name) +
      '</div><div class="xs mut">' +
      esc(a.treatment || 'Visit') +
      ' · waiting ' +
      mins +
      ' min</div></div>' +
      chip(visitChipCode(a)) +
      '</div>'
    );
  }

  function quickActions() {
    return (
      '<div class="grid g2" style="gap:12px">' +
      [
        ['New appointment', 'dashboard/appointments?action=book', 'calendar'],
        ['Add patient', 'dashboard/patients?action=add', 'userplus'],
        ['Open waiting room', 'dashboard/waiting', 'clock'],
        ['Open inbox', 'dashboard/messages', 'chat'],
      ]
        .map(function (q) {
          return (
            '<a class="card flat hv" href="' +
            U(q[1]) +
            '" style="padding:16px;display:flex;flex-direction:column;gap:10px"><span class="fico" style="width:40px;height:40px;border-radius:12px">' +
            ic(q[2]) +
            '</span><b class="sm">' +
            esc(q[0]) +
            '</b></a>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function wtabsComm(cur) {
    return OS.wtabs(OS.WS.comm, cur);
  }

  var origDashboard = OS.pages['dashboard'];
  var origWhatsApp = OS.pages['dashboard/whatsapp'];

  /* ── Dashboard (owner) ─────────────────────────────────────────────────── */

  function dashboardOwnerShell() {
    return (
      head(
        [greet() + ', ' + esc(displayName()), 'Here is how the clinic looks right now.'],
        '<a class="btn pri" href="' +
          U('dashboard/appointments') +
          '?action=book">' +
          ic('plus') +
          'New appointment</a>'
      ) + '<div id="os-live-dash">' + empty('Loading', 'Fetching today’s clinic data…', '', 'clock') + '</div>'
    );
  }

  function paintDashboardOwner(data) {
    var el = document.getElementById('os-live-dash');
    if (!el) return;
    var today = data.today;
    var patients = data.patients;
    var wa = data.wa;
    var train = data.train;
    var u = A().user() || {};
    var clinic = u.clinicName || u.name || 'Your clinic';

    var connected = !!(wa.connected || wa.status === 'connected' || wa.status === 'CONNECTED');
    var published = !!(train.isPublished || train.publishedAt);
    try {
      OS.S.set('wa', connected);
      OS.S.set('ai', published);
    } catch (_) {}

    var waitingRows = today.filter(function (a) {
      var c = visitChipCode(a);
      return c === 'ARRIVED' || c === 'CALLED' || c === 'WAITING' || statusOf(a) === 'IN_PROGRESS';
    });
    var completed = today.filter(function (a) {
      return statusOf(a) === 'COMPLETED';
    }).length;
    var feeToday = today.reduce(function (s, a) {
      return s + feeOf(a);
    }, 0);

    var waBand =
      '<div class="band rv" style="margin-bottom:18px"><span class="bi">' +
      ic('phone') +
      '</span><div class="sp"><b>' +
      (wa.unavailable
        ? 'WhatsApp status unavailable'
        : connected
          ? 'WhatsApp is connected'
          : 'WhatsApp is not connected') +
      '</b><div class="sm mut">' +
      (wa.unavailable
        ? 'Connection status could not be loaded. Retry from the WhatsApp page.'
        : connected
          ? 'Inbound chats reach your inbox and the AI receptionist.'
          : 'Connect a number to let patients message the clinic.') +
      '</div></div>' +
      (wa.unavailable
        ? ''
        : connected
          ? '<a class="btn pri sm" href="' + U('dashboard/whatsapp') + '">Open WhatsApp Hub</a>'
          : '<a class="btn pri sm" href="' + U('dashboard/whatsapp') + '?connect=1">Connect WhatsApp</a>') +
      '</div>';

    var kpiFee =
      feeToday > 0
        ? kpi('Visit fees today', money(feeToday), 'dollar', '', 't4')
        : kpi(
            'Completed today',
            String(completed),
            'check',
            'dashboard/appointments',
            't4'
          );

    var sched =
      today.length > 0
        ? today.slice(0, 8).map(apRow).join('')
        : empty('No appointments today', 'Book a visit or wait for WhatsApp bookings.');

    var waitHtml =
      waitingRows.length > 0
        ? waitingRows.slice(0, 6).map(waitRow).join('')
        : empty('Waiting room is clear', 'Check in a confirmed visit when a patient arrives.');

    var recentHtml =
      patients.length > 0
        ? patients
            .slice(0, 4)
            .map(function (p) {
              return (
                '<a class="slot" href="' +
                U('dashboard/patients/detail/?id=' + encodeURIComponent(p.id)) +
                '">' +
                OS.av(p.fullName || 'Patient') +
                '<div class="sp"><div class="b">' +
                esc(p.fullName || 'Patient') +
                '</div><div class="xs mut">' +
                esc(p.phone || '—') +
                '</div></div>' +
                ic('chevR') +
                '</a>'
              );
            })
            .join('')
        : empty('No patients yet', 'Add a patient chart when someone registers.');

    var alerts = [];
    if (!wa.unavailable && !connected) {
      alerts.push([
        'WhatsApp is not connected',
        'Patients cannot reach the AI receptionist until a number is connected.',
        'dashboard/whatsapp',
        'Connect WhatsApp',
      ]);
    }
    if (!published && !wa.unavailable) {
      alerts.push([
        'AI receptionist is not published',
        'Publish your draft when you are ready for the AI to answer patients.',
        'dashboard/ai',
        'Review draft',
      ]);
    }
    today
      .filter(function (a) {
        return statusOf(a) === 'PENDING' && new Date(a.dateTime) < new Date();
      })
      .slice(0, 3)
      .forEach(function (a) {
        var nm = (a.patient && a.patient.fullName) || 'A visit';
        alerts.push([
          nm + ' is overdue for confirmation',
          'Still pending after the scheduled start time.',
          'dashboard/appointments',
          'Open schedule',
        ]);
      });

    var alertsHtml = alerts.length
      ? card(
          'Clinic activity',
          '<div class="col">' +
            alerts
              .map(function (a) {
                return (
                  '<div class="band warn" style="padding:14px 18px"><span class="bi" style="color:var(--warn)">' +
                  ic('alert') +
                  '</span><div class="sp"><b class="sm">' +
                  esc(a[0]) +
                  '</b><div class="xs mut">' +
                  esc(a[1]) +
                  '</div></div><a class="btn gh sm" href="' +
                  U(a[2]) +
                  '">' +
                  esc(a[3]) +
                  '</a></div>'
                );
              })
              .join('') +
            '</div>',
          '',
          '',
          'Only shown when something needs attention'
        )
      : '';

    el.innerHTML =
      waBand +
      '<div class="grid g4 keep2" style="margin-bottom:18px">' +
      kpi('Today’s appointments', String(today.length), 'calendar', 'dashboard/appointments') +
      kpi('Waiting patients', String(waitingRows.length), 'clock', 'dashboard/waiting', 't2') +
      kpi('Completed today', String(completed), 'check', 'dashboard/appointments', 't3') +
      kpiFee +
      '</div>' +
      '<div class="grid g2" style="margin-bottom:18px">' +
      card(
        'Today’s schedule',
        sched,
        '<a class="btn gh sm" href="' + U('dashboard/appointments') + '">View all</a>',
        '',
        new Date().toLocaleDateString(undefined, { weekday: 'long' })
      ) +
      card(
        'Waiting room',
        waitHtml,
        '<a class="btn gh sm" href="' + U('dashboard/waiting') + '">Open</a>',
        '',
        'Live queue'
      ) +
      '</div>' +
      '<div class="grid g2" style="margin-bottom:18px">' +
      card(
        'Recent patients',
        '<div class="col">' + recentHtml + '</div>',
        '<a class="btn gh sm" href="' + U('dashboard/patients') + '">All patients</a>'
      ) +
      card('Quick actions', quickActions()) +
      '</div>' +
      alertsHtml +
      '<p class="xs mut tc" style="margin-top:16px">' +
      esc(clinic) +
      ' · WhatsApp ' +
      (wa.unavailable ? 'unavailable' : connected ? 'connected' : 'not connected') +
      ' · AI ' +
      (published ? 'published' : 'draft') +
      '</p>';

    OS.post(el);
  }

  function loadDashboardOwner() {
    Promise.all([
      A().get('/api/appointments?filter=today&limit=80').catch(function () {
        return { _fail: true, data: [] };
      }),
      A().get('/api/patients?limit=50').catch(function () {
        return { data: [] };
      }),
      A().waStatus().catch(function () {
        return { unavailable: true };
      }),
      A().get('/api/ai/training-profile').catch(function () {
        return {};
      }),
    ]).then(function (parts) {
      if (parts[0]._fail) {
        var el = document.getElementById('os-live-dash');
        if (el) {
          el.innerHTML = empty(
            'Couldn’t load today’s schedule',
            'Try again in a moment.',
            '<button type="button" class="btn pri" id="os-dash-retry">Try again</button>',
            'alert'
          );
          var rb = document.getElementById('os-dash-retry');
          if (rb) rb.onclick = loadDashboardOwner;
        }
        return;
      }
      paintDashboardOwner({
        today: apptList(parts[0]),
        patients: (parts[1] && parts[1].data) || [],
        wa: parts[2] || {},
        train: parts[3] || {},
      });
      if (window.OsLive && OsLive.patchChrome) OsLive.patchChrome();
    });
  }

  OS.reg('dashboard', 'Dashboard', function () {
    if (OS.role() !== 'owner') return origDashboard ? origDashboard() : '';
    return dashboardOwnerShell();
  });
  OS.init['dashboard'] = function () {
    if (OS.role() === 'owner') loadDashboardOwner();
  };

  /* ── WhatsApp: Communication tab + Command Center ──────────────────────── */

  function whatsappShell() {
    return (
      wtabsComm('dashboard/whatsapp') +
      '<div class="band rv wa-cc-hero" style="margin-bottom:18px">' +
      '<div class="sp"><p class="xs mut" style="margin:0 0 4px;text-transform:uppercase;letter-spacing:.04em">WhatsApp Command Center</p>' +
      '<h2 style="margin:0 0 8px;font-size:22px">Your clinic on WhatsApp — managed like a human receptionist</h2>' +
      '<p class="sm mut" style="margin:0">Patients message your business number. AI books appointments, captures leads, and escalates when needed.</p>' +
      '<p class="xs mut" id="os-wa-hero-status" style="margin-top:10px">Loading connection…</p></div></div>' +
      '<div id="os-wa-hub-slot"></div>' +
      head(
        ['WhatsApp', 'Your clinic’s WhatsApp connection and its status.'],
        '<span id="os-wa-head-actions"></span>'
      ) +
      '<div class="grid g21" id="os-wa-comm-grid">' +
      '<div class="col" id="os-wa-main-col">' +
      empty('Loading', 'Fetching WhatsApp connection…', '', 'phone') +
      '</div>' +
      '<div class="col" id="os-wa-rail-col"></div></div>' +
      '<div id="os-wa-extra" style="margin-top:18px"></div>'
    );
  }

  function paintWhatsAppComm(hub, train, log) {
    var connected = hub.connected === true && !hub._unavailable;
    var headAct = document.getElementById('os-wa-head-actions');
    if (headAct) {
      headAct.innerHTML = connected
        ? '<a class="btn gh" href="' +
          U('dashboard/messages') +
          '">' +
          ic('chat') +
          'Open Inbox</a><a class="btn pri" href="' +
          U('dashboard/ai') +
          '">' +
          ic('sparkles') +
          'Train AI</a>'
        : '<a class="btn pri" href="' +
          U('dashboard/whatsapp') +
          '?connect=1">' +
          ic('phone') +
          'Connect WhatsApp</a>';
    }

    var hero = document.getElementById('os-wa-hero-status');
    if (hero) {
      hero.textContent = hub._unavailable
        ? 'Connection status unavailable'
        : connected
          ? (hub.phoneNumber || hub.displayName || 'WhatsApp') + ' · Connected'
          : 'Not connected';
    }

    var published = !!(train.isPublished || train.publishedAt);
    var main = document.getElementById('os-wa-main-col');
    var rail = document.getElementById('os-wa-rail-col');
    if (!main || !rail) return;

    var connBody;
    if (hub._unavailable) {
      connBody = empty(
        'WhatsApp status unavailable',
        'Could not load connection details. Use the command center panel above to retry.',
        '',
        'phone'
      );
    } else if (!connected) {
      connBody = empty(
        'WhatsApp is not connected',
        'Connect a business number through Meta Embedded Signup so patients can message the clinic.',
        '<a class="btn pri" href="' +
          U('dashboard/whatsapp') +
          '?connect=1">' +
          ic('phone') +
          'Connect WhatsApp</a>',
        'phone'
      );
    } else {
      var webhookOk =
        hub.webhookStatus === 'subscribed' || hub.webhookStatus === 'UP' || hub.webhookSubscribed;
      connBody =
        '<div class="row" style="margin-bottom:16px"><span class="band" style="padding:10px 16px">' +
        chip('CONNECTED') +
        '</span></div><dl class="kv"><dt>Phone number</dt><dd>' +
        esc(hub.phoneNumber || hub.displayName || '—') +
        '</dd><dt>Webhook</dt><dd>' +
        (webhookOk ? chip('UP', 'Receiving') : chip('PENDING', hub.webhookStatus || 'Unknown')) +
        '</dd><dt>WABA ID</dt><dd>' +
        esc(hub.wabaId || '—') +
        '</dd><dt>Connected</dt><dd>' +
        esc(fmtDate(hub.connectedAt || hub.createdAt)) +
        '</dd></dl><div class="row wrap" style="margin-top:20px">' +
        '<button type="button" class="btn gh" id="os-wa-check-webhook">' +
        ic('refresh') +
        'Check webhook</button>' +
        '<a class="btn gh" href="' +
        U('dashboard/whatsapp') +
        '?connect=1">Reconnect</a>' +
        '<button type="button" class="btn dng" id="os-wa-disconnect">Disconnect</button></div>';
    }

    main.innerHTML =
      card('Connection', connBody) +
      card(
        'How inbound messages flow',
        '<div class="row wrap" style="gap:8px">' +
          ['Patient message', 'Clinic by number', 'Patient or lead', 'AI receptionist', 'Reply on WhatsApp', 'Inbox']
            .map(function (s, i, a) {
              return (
                '<span class="chip ' +
                (i === 3 ? 'vio' : '') +
                '">' +
                esc(s) +
                '</span>' +
                (i < a.length - 1 ? ic('arrowR') : '')
              );
            })
            .join('') +
          '</div>'
      );

    var recentLines = (log && log.messages) || [];
    var recentHtml =
      recentLines.length > 0
        ? '<div class="tl">' +
          recentLines.slice(0, 5).map(function (m) {
            var who =
              (m.patient && m.patient.fullName) ||
              (m.direction === 'INBOUND' ? m.fromNumber : m.toNumber) ||
              'Contact';
            var label =
              m.direction === 'INBOUND'
                ? 'Message received'
                : m.isHandledByAI
                  ? 'AI replied'
                  : 'Staff replied';
            return (
              '<div><b class="sm">' +
              esc(label) +
              '</b><div class="xs mut">' +
              esc(fmtTime(m.createdAt || m.timestamp)) +
              (who ? ' · ' + esc(who) : '') +
              '</div></div>'
            );
          }).join('') +
          '</div>'
        : '<p class="sm mut">No recent WhatsApp activity yet.</p>';

    rail.innerHTML =
      card(
        'AI receptionist',
        '<div class="row">' +
          chip(published ? 'PUBLISHED' : 'DRAFT') +
          '</div><p class="sm mut" style="margin:10px 0">It answers common questions and books visits. It does not diagnose and does not replace your doctors.</p><a class="btn soft" href="' +
          U('dashboard/ai') +
          '">Open AI Receptionist</a>'
      ) + card('Recent', recentHtml);

    var chk = document.getElementById('os-wa-check-webhook');
    if (chk) {
      chk.onclick = function () {
        chk.disabled = true;
        A()
          .post('/api/whatsapp/verify-waba', {})
          .then(function (r) {
            chk.disabled = false;
            var d = (r && r.d) || {};
            A().toast(
              d.subscribed ? 'Webhook subscribed' : d.message || d.error || 'Check complete',
              d.subscribed ? 'ok' : 'warn'
            );
          })
          .catch(function () {
            chk.disabled = false;
            A().toast('Could not check webhook', 'err');
          });
      };
    }
    var disc = document.getElementById('os-wa-disconnect');
    if (disc) {
      disc.onclick = function () {
        if (!confirm('Disconnect WhatsApp from this clinic?')) return;
        disc.disabled = true;
        fetch('/api/whatsapp/connections/disconnect', {
          method: 'DELETE',
          headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') },
          credentials: 'include',
        }).then(function () {
          location.reload();
        });
      };
    }

    OS.post(document.getElementById('os-wa-comm-grid'));
  }

  function loadWhatsAppPage() {
    Promise.all([
      A().get('/api/whatsapp/hub').catch(function () {
        return { _unavailable: true };
      }),
      A().get('/api/ai/training-profile').catch(function () {
        return {};
      }),
      A().get('/api/whatsapp/message-log').catch(function () {
        return { messages: [] };
      }),
    ]).then(function (parts) {
      paintWhatsAppComm(parts[0] || {}, parts[1] || {}, parts[2] || {});
      if (window.DmaWaHub && DmaWaHub.boot) DmaWaHub.boot();
      if (/[?&]connect=1(?:&|$)/.test(location.search) && window.DmaWaHub && DmaWaHub.autoConnect) {
        DmaWaHub.autoConnect();
      }
    });
  }

  OS.reg('dashboard/whatsapp', 'Communication', whatsappShell);
  OS.init['dashboard/whatsapp'] = loadWhatsAppPage;

  OS.LIVE_WIRED = ['dashboard', 'dashboard/whatsapp'];
})();
