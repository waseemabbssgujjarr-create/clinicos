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

  /* ── Dashboard (live API for all roles) ─────────────────────────────────── */

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

  OS.reg('dashboard', 'Dashboard', dashboardOwnerShell);
  OS.init['dashboard'] = loadDashboardOwner;

  /* ── WhatsApp: single Command Center hub (DmaWaHub) ───────────────────── */

  function whatsappShell() {
    return wtabsComm('dashboard/whatsapp') + '<div id="os-wa-hub-slot"></div>';
  }

  function loadWhatsAppPage() {
    if (window.DmaWaHub && DmaWaHub.boot) DmaWaHub.boot();
    if (/[?&]connect=1(?:&|$)/.test(location.search) && window.DmaWaHub && DmaWaHub.autoConnect) {
      setTimeout(function () {
        DmaWaHub.autoConnect();
      }, 400);
    }
  }

  OS.reg('dashboard/whatsapp', 'Communication', whatsappShell);
  OS.init['dashboard/whatsapp'] = loadWhatsAppPage;

  OS.LIVE_WIRED = ['dashboard', 'dashboard/whatsapp'];
})();
