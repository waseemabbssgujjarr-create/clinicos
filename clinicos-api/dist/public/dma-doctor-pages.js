/**
 * Doctors My Agency — connected clinic pages.
 * Each screen reads/writes the same APIs and deep-links the others.
 */
(function (global) {
  var A = function () { return global.DmaApp; };

  function el(id) { return document.getElementById(id); }
  function page() { return el('doc-page'); }
  function esc(s) { return A().esc(s); }
  function failMsg(r, fb) { return (A().friendlyError && A().friendlyError(r, fb)) || fb || "Couldn't complete that request."; }

  function greeting() {
    var h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function drawer(opts) {
    if (global.DmaUI && DmaUI.drawer) return DmaUI.drawer(opts);
    A().modal(opts.title, opts.html, opts.footer || '');
    return {
      close: function () { A().closeModal(); },
      setBody: function (html) {
        var b = document.querySelector('.dma-modal-b, .ds-drawer-b');
        if (b) b.innerHTML = html;
      },
      el: document.getElementById('ds-drawer') || document.querySelector('.dma-modal')
    };
  }

  function pageHead(title, desc, actionsHtml, kicker) {
    return '<div class="dma-head dma-head-page ds-page-enter"><div>' +
      (kicker ? '<div class="dma-head-kicker"><span class="ds-pill">' + kicker + '</span></div>' : '') +
      '<h1>' + title + '</h1>' +
      (desc ? '<p class="dma-prose">' + desc + '</p>' : '') +
      '</div>' +
      (actionsHtml ? '<div class="dma-head-actions">' + actionsHtml + '</div>' : '') + '</div>';
  }

  function sectionBlock(title, body, extra) {
    return '<section class="dma-section' + (extra ? ' ' + extra : '') + '">' +
      (title ? '<header class="dma-section-h"><h2>' + title + '</h2></header>' : '') +
      '<div class="dma-section-b">' + body + '</div></section>';
  }

  function firstName() {
    var u = A().user();
    var n = (u.ownerName || u.name || 'Doctor').trim().split(/\s+/)[0];
    return n;
  }

  function statusSelect(current, onchangeAttr) {
    var opts = ['PENDING', 'CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW', 'CANCELLED'];
    return '<select class="dma-status-sel" ' + (onchangeAttr || '') + '>' +
      opts.map(function (s) {
        return '<option value="' + s + '"' + (s === current ? ' selected' : '') + '>' + s.replace('_', ' ') + '</option>';
      }).join('') + '</select>';
  }

  function identity() {
    var u = A().user();
    if (u.role === 'STAFF') {
      var sr = u.staffRole || u.clinicRole;
      if (!sr) {
        try {
          var t = localStorage.getItem('token') || '';
          var p = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
          sr = p.staffRole;
        } catch (_) {}
      }
      return String(sr || 'RECEPTIONIST').toUpperCase();
    }
    return 'OWNER';
  }

  function money(n) {
    var v = Number(n || 0);
    if (!isFinite(v)) return '—';
    return A().money ? A().money(v) : (v ? v.toFixed(0) : '0');
  }

  function apptList(d) {
    return (d && (d.data || d.appointments)) || [];
  }

  function statusOf(a) { return String(a.status || '').toUpperCase(); }
  function visitOf(a) {
    return global.DmaClinical && DmaClinical.visitState
      ? DmaClinical.visitState(a)
      : { code: statusOf(a), persist: statusOf(a), label: statusOf(a) };
  }

  function feeOf(a) {
    var f = a.fee != null ? Number(a.fee) : NaN;
    return isFinite(f) ? f : 0;
  }

  function todayRates(rows) {
    var n = rows.length;
    var completed = rows.filter(function (a) { return statusOf(a) === 'COMPLETED'; }).length;
    var cancelled = rows.filter(function (a) { return statusOf(a) === 'CANCELLED'; }).length;
    var noshow = rows.filter(function (a) { return statusOf(a) === 'NO_SHOW'; }).length;
    return {
      completed: completed,
      cancelRate: n ? Math.round((cancelled / n) * 100) : 0,
      noShowRate: n ? Math.round((noshow / n) * 100) : 0,
      revenue: rows.filter(function (a) { return statusOf(a) === 'COMPLETED'; }).reduce(function (s, a) { return s + feeOf(a); }, 0),
      waiting: rows.filter(function (a) { return statusOf(a) === 'ARRIVED' || statusOf(a) === 'IN_PROGRESS'; }).length,
      uniquePatients: Object.keys(rows.reduce(function (m, a) {
        var id = a.patientId || (a.patient && a.patient.id) || a.id;
        m[id] = 1;
        return m;
      }, {})).length,
    };
  }

  function todayCapacity(hours, rows) {
    var days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    var key = days[new Date().getDay()];
    var h = hours && hours[key];
    var booked = rows.filter(function (a) {
      var s = statusOf(a);
      return s !== 'CANCELLED' && s !== 'NO_SHOW';
    }).length;
    if (!h) return { booked: booked, slots: 0, label: booked + ' booked · working hours not set' };
    if (h.isOpen === false) return { booked: booked, slots: 0, label: 'Clinic closed today' };
    function mins(t) {
      var p = String(t || '09:00').split(':');
      return (Number(p[0]) || 0) * 60 + (Number(p[1]) || 0);
    }
    var slot = Number(h.slotDuration || 30) || 30;
    var slots = Math.max(0, Math.floor((mins(h.close || h.end) - mins(h.open || h.start)) / slot));
    return { booked: booked, slots: slots, label: booked + ' of ' + slots + ' slots booked today' };
  }

  function timelineHtml(rows, opts) {
    opts = opts || {};
    if (!rows.length) return A().empty('No appointments today', 'Book a visit or wait for WhatsApp bookings.', '/dashboard/appointments/?action=book', 'Book now');
    var u = A().user();
    return '<div class="dma-timeline">' + rows.map(function (a) {
      var pract = (u.ownerName || u.name || 'Clinic');
      if (global.DmaClinical && DmaClinical.assignedClinician) {
        var c = DmaClinical.assignedClinician(a);
        if (c && c.name) pract = c.name;
      }
      var p = a.patient || {};
      var action = '';
      if (opts.checkIn && statusOf(a) === 'CONFIRMED') {
        action = '<button type="button" class="dma-btn dma-btn-sm dma-btn-primary" data-checkin="' + esc(a.id) + '">Check in</button>';
      }
      return '<div class="dma-tl" data-appt="' + esc(a.id) + '">' +
        '<time>' + A().fmtTime(a.dateTime) + '</time>' +
        '<div><div class="who">' + esc(p.fullName || 'Patient') + '</div>' +
        '<div class="meta">' + esc(a.treatment || 'Visit') + ' · ' + esc(pract) + '</div></div>' +
        '<div class="st">' + (action || A().chip(a.status)) + '</div></div>';
    }).join('') + '</div>';
  }

  function bindTimeline(container, rows, reload) {
    if (!container) return;
    container.querySelectorAll('[data-checkin]').forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        A().patch('/api/appointments/' + b.getAttribute('data-checkin'), { status: 'ARRIVED' }).then(function (r) {
          if (r.ok) { A().toast('Checked in', 'ok'); if (reload) reload(); }
          else A().toast(failMsg(r, "Couldn't check in this visit."), 'err');
        });
      };
    });
    container.querySelectorAll('[data-appt]').forEach(function (n) {
      n.style.cursor = 'pointer';
      n.onclick = function (e) {
        if (e.target.closest('button, a, select')) return;
        var a = rows.filter(function (x) { return x.id === n.getAttribute('data-appt'); })[0];
        if (a) openApptDrawer(a, reload);
      };
    });
  }

  function compositionHtml(rows) {
    var counts = {};
    rows.forEach(function (a) {
      var s = statusOf(a) || 'PENDING';
      counts[s] = (counts[s] || 0) + 1;
    });
    var total = rows.length || 1;
    var keys = Object.keys(counts);
    if (!keys.length) return '<p class="dma-hint">No visits yet today.</p>';
    return keys.map(function (k) {
      var pct = Math.round((counts[k] / total) * 100);
      return '<div class="dma-comp-row"><span style="width:88px">' + esc(k.replace('_', ' ')) + '</span>' +
        '<div class="dma-comp-bar"><i style="width:' + pct + '%"></i></div><strong>' + counts[k] + '</strong></div>';
    }).join('');
  }

  function nextPatientCard(rows) {
    var now = Date.now();
    var upcoming = rows.filter(function (a) {
      var st = statusOf(a);
      return st !== 'CANCELLED' && st !== 'COMPLETED' && st !== 'NO_SHOW';
    }).sort(function (a, b) { return new Date(a.dateTime) - new Date(b.dateTime); });
    var next = upcoming.filter(function (a) { return new Date(a.dateTime).getTime() >= now - 30 * 60 * 1000; })[0] || upcoming[0];
    if (!next) return '<section class="dma-section"><div class="dma-section-b">' + A().empty('No next patient', 'The schedule is clear.') + '</div></section>';
    var p = next.patient || {};
    return '<div class="dma-next-card" id="next-card" data-id="' + esc(next.id) + '">' +
      '<div class="dma-avatar">' + A().initials(p.fullName) + '</div>' +
      '<div style="flex:1;min-width:0"><span class="ds-pill">Next patient</span>' +
      '<h2 style="margin:8px 0 4px">' + esc(p.fullName || 'Patient') + '</h2>' +
      '<p class="dma-hint" style="margin:0">' + A().fmtTime(next.dateTime) + ' · ' + esc(next.treatment || 'Visit') + ' · ' + A().chip(next.status) + '</p></div>' +
      '<div class="dma-head-actions">' +
        (p.id || next.patientId ? '<a class="dma-btn dma-btn-ghost" href="/dashboard/patients/detail/?id=' + esc(next.patientId || p.id) + '">Open chart</a>' : '') +
        '<button type="button" class="dma-btn dma-btn-primary" id="start-consult">Start consultation</button>' +
      '</div></div>';
  }

  /* ── HOME ─────────────────────────────────────────────────────────────── */
  function home() {
    var id = identity();
    if (id === 'NURSE') return homeNurse();
    if (id === 'MANAGER') return homeManager();
    if (id === 'ASSISTANT') return homeAssistant();
    if (id === 'RECEPTIONIST') return homeReception();
    return homeOwner();
  }

  function homeOwner() {
    var root = page();
    var u = A().user();
    var clinic = u.name || u.clinicName || 'Your clinic';
    root.innerHTML =
      pageHead(greeting() + ', ' + esc(firstName()),
        "Here's what needs attention today.",
        '<a class="dma-btn dma-btn-primary" href="/dashboard/appointments/?action=book">New appointment</a>') +
      '<div id="home-clinic">' + A().spinner() + '</div>';

    Promise.all([
      A().get('/api/appointments?filter=today&limit=80').catch(function () { return { _fail: true, data: [] }; }),
      A().get('/api/patients?limit=50').catch(function () { return { data: [] }; }),
      A().waStatus().catch(function () { return { unavailable: true }; }),
      A().get('/api/ai/training-profile').catch(function () { return {}; }),
      A().get('/api/leads?limit=20').catch(function () { return { leads: [] }; })
    ]).then(function (p) {
      var todayPack = p[0] || {};
      if (todayPack._fail) {
        el('home-clinic').innerHTML = '<div class="ds-empty"><h2>We couldn’t load today’s schedule.</h2><p>Try again in a moment.</p><button type="button" class="dma-btn dma-btn-primary" id="home-retry">Try again</button></div>';
        if (el('home-retry')) el('home-retry').onclick = home;
        return;
      }
      var today = apptList(todayPack);
      var patients = (p[1] && p[1].data) || [];
      var wa = p[2] || {};
      var train = p[3] || {};
      var leads = (p[4] && p[4].leads) || [];
      var rates = todayRates(today);
      var waitingRows = today.filter(function (a) {
        var v = visitOf(a);
        return v.code === 'WAITING' || v.code === 'CALLED' || statusOf(a) === 'ARRIVED';
      });
      var feeToday = today.reduce(function (s, a) { return s + feeOf(a); }, 0);
      var connected = !!(wa.connected || wa.status === 'connected' || wa.status === 'CONNECTED');
      var published = !!(train.isPublished || train.publishedAt);
      var startToday = new Date(); startToday.setHours(0, 0, 0, 0);
      var newPts = patients.filter(function (pt) { return pt.createdAt && new Date(pt.createdAt) >= startToday; }).length;
      var recent = patients.slice(0, 6);

      var alerts = [];
      if (wa.unavailable) alerts.push('WhatsApp connection status is unavailable.');
      else if (!connected) alerts.push('WhatsApp is not connected yet.');
      if (!published && !wa.unavailable) alerts.push('Publish the AI receptionist when you are ready for it to answer patients.');
      today.filter(function (a) { return statusOf(a) === 'PENDING' && new Date(a.dateTime) < new Date(); }).forEach(function (a) {
        alerts.push((a.patient && a.patient.fullName ? a.patient.fullName : 'A visit') + ' is still pending after start time.');
      });
      leads.filter(function (l) { return String(l.leadScore || '').toUpperCase() === 'HOT'; }).slice(0, 2).forEach(function (l) {
        alerts.push('Follow up: ' + (l.fullName || l.phone || 'a new enquiry'));
      });

      var waitHtml = waitingRows.length
        ? waitingRows.map(function (a, i) {
            var pt = a.patient || {};
            var mins = Math.max(0, Math.round((Date.now() - new Date(a.updatedAt || a.dateTime).getTime()) / 60000));
            return '<a class="cos-queue-row" href="/dashboard/waiting/"><span class="cos-queue-num">' + String(i + 1).padStart(2, '0') + '</span><span><strong>' + esc(pt.fullName || 'Patient') + '</strong><span class="dma-hint">Waiting ' + mins + ' min</span></span>' + A().chip(visitOf(a).label) + '</a>';
          }).join('')
        : '<p class="dma-hint">No one is waiting. Check in a confirmed visit when a patient arrives.</p>';

      var recentHtml = recent.length
        ? recent.map(function (pt) {
            return '<a class="dma-row-item" href="/dashboard/patients/detail/?id=' + esc(pt.id) + '"><div class="name">' + esc(pt.fullName || 'Patient') + '</div><div class="sub">' + esc(pt.phone || '') + '</div></a>';
          }).join('')
        : '<p class="dma-hint">No patients on file yet.</p>';

      var waHome = '';
      if (!wa.unavailable) {
        if (connected) {
          waHome =
            '<section class="dma-home-wa dma-home-wa--on" aria-label="WhatsApp">' +
              '<div class="dma-home-wa-copy"><strong>WhatsApp Connected</strong>' +
              '<p>Your clinic is connected via Meta WhatsApp.</p></div>' +
              '<a class="dma-btn dma-btn-ghost" href="/dashboard/whatsapp/">Open WhatsApp Hub →</a>' +
            '</section>';
        } else {
          waHome =
            '<section class="dma-home-wa" aria-label="Connect WhatsApp">' +
              '<div class="dma-home-wa-copy"><strong>Connect WhatsApp</strong>' +
              '<p>Connect your clinic\'s WhatsApp Business account securely through Meta.</p></div>' +
              '<a class="dma-btn dma-btn-wa" id="dma-home-wa-connect" href="/dashboard/whatsapp/">Connect WhatsApp</a>' +
            '</section>';
        }
      }

      el('home-clinic').innerHTML =
        waHome +
        '<div class="cos-kpi-row">' +
          '<a class="cos-card cos-card--kpi" href="/dashboard/appointments/?view=today"><span>Today\'s appointments</span><strong>' + today.length + '</strong></a>' +
          '<a class="cos-card cos-card--kpi" href="/dashboard/waiting/"><span>Waiting patients</span><strong>' + waitingRows.length + '</strong></a>' +
          '<a class="cos-card cos-card--kpi" href="/dashboard/waiting/"><span>Completed today</span><strong>' + rates.completed + '</strong></a>' +
          (feeToday > 0
            ? '<div class="cos-card cos-card--kpi"><span>Visit fees today</span><strong>' + money(feeToday) + '</strong></div>'
            : '<a class="cos-card cos-card--kpi" href="/dashboard/patients/"><span>New patients</span><strong>' + newPts + '</strong></a>') +
        '</div>' +
        '<div class="dma-grid-2 ds-dash-split">' +
          sectionBlock("Today's schedule", timelineHtml(today)) +
          sectionBlock('Waiting room', waitHtml + (waitingRows.length ? '<p class="dma-hint"><a href="/dashboard/waiting/">Open waiting room</a></p>' : '')) +
        '</div>' +
        '<div class="dma-grid-2">' +
          sectionBlock('Recent patients', recentHtml) +
          sectionBlock('Quick actions',
            '<div class="cos-quick-actions">' +
              '<a class="dma-btn dma-btn-ghost" href="/dashboard/appointments/?action=book">New appointment</a>' +
              '<a class="dma-btn dma-btn-ghost" href="/dashboard/patients/?action=new">Add patient</a>' +
              '<a class="dma-btn dma-btn-ghost" href="/dashboard/waiting/">Open waiting room</a>' +
              '<a class="dma-btn dma-btn-ghost" href="/dashboard/messages/">Open inbox</a>' +
            '</div>') +
        '</div>' +
        (alerts.length ? sectionBlock('Clinic activity', '<div class="dma-alert-list">' + alerts.map(function (t) { return '<div class="cos-card cos-card--alert">' + esc(t) + '</div>'; }).join('') + '</div>') : '') +
        '<p class="dma-hint">' + esc(clinic) + ' · WhatsApp ' + (wa.unavailable ? 'unavailable' : (connected ? 'connected' : 'not connected')) + ' · AI receptionist ' + (published ? 'published' : 'draft') + '</p>';

      bindTimeline(el('home-clinic'), today, home);
    });
  }

  function kpi(label, val, sub) {
    return '<div class="dma-kpi"><span>' + esc(label) + '</span><strong>' + esc(val) + '</strong>' + (sub ? '<em>' + esc(sub) + '</em>' : '') + '</div>';
  }

  function personCard(name, role, stat, statLabel) {
    return '<div class="dma-person-card"><div class="dma-avatar">' + A().initials(name) + '</div>' +
      '<strong>' + esc(name) + '</strong><div class="dma-hint">' + esc(role || '') + '</div>' +
      '<div style="margin-top:8px"><strong>' + esc(stat) + '</strong> <span class="dma-hint">' + esc(statLabel) + '</span></div></div>';
  }

  function homeReception() {
    var root = page();
    root.innerHTML =
      pageHead(greeting() + ', ' + esc(firstName()),
        'Who needs to be processed next?',
        '<a class="dma-btn dma-btn-ghost" href="/dashboard/patients/?action=new">New patient</a>' +
        '<a class="dma-btn dma-btn-ghost" href="/dashboard/payments/">Payment</a>' +
        '<a class="dma-btn dma-btn-primary" href="/dashboard/appointments/?action=book">New appointment</a>',
        'Front desk') +
      '<div class="cos-kpi-row" id="rec-kpis">' + A().spinner() + '</div>' +
      '<div class="dma-grid-2">' +
        sectionBlock("Today's appointments", '<div id="rec-tl"></div>') +
        sectionBlock('Waiting room', '<div id="rec-wait"></div>') +
      '</div>';
    Promise.all([
      A().get('/api/appointments?filter=today&limit=80'),
      A().get('/api/patients?limit=40').catch(function () { return { data: [] }; })
    ]).then(function (parts) {
      var rows = apptList(parts[0]);
      var patients = (parts[1] && parts[1].data) || [];
      var rates = todayRates(rows);
      var waiting = rows.filter(function (a) {
        var v = visitOf(a);
        return v.code === 'WAITING' || v.code === 'CALLED';
      });
      var arrived = rows.filter(function (a) { return statusOf(a) === 'ARRIVED'; }).length;
      var startToday = new Date(); startToday.setHours(0, 0, 0, 0);
      var newPts = patients.filter(function (pt) { return pt.createdAt && new Date(pt.createdAt) >= startToday; }).length;
      var hasFee = rows.some(function (a) { return a.fee != null && Number(a.fee) > 0; });
      el('rec-kpis').innerHTML =
        '<div class="cos-card cos-card--kpi"><span>Today</span><strong>' + rows.length + '</strong><em>appointments</em></div>' +
        '<div class="cos-card cos-card--kpi"><span>Arrived</span><strong>' + arrived + '</strong><em>checked in</em></div>' +
        '<div class="cos-card cos-card--kpi"><span>Waiting</span><strong>' + waiting.length + '</strong><em>ready to call</em></div>' +
        '<div class="cos-card cos-card--kpi"><span>' + (hasFee ? 'Payments' : 'New patients') + '</span><strong>' + (hasFee ? money(rates.revenue) : newPts) + '</strong><em>' + (hasFee ? 'visit fees today' : 'charts opened') + '</em></div>';
      el('rec-tl').innerHTML = timelineHtml(rows, { checkIn: true });
      bindTimeline(el('rec-tl'), rows, home);
      el('rec-wait').innerHTML = waiting.length
        ? waiting.map(function (a) {
            var p = a.patient || {};
            var vis = visitOf(a);
            var action = vis.code === 'CALLED'
              ? '<span class="dma-hint">Called on this board</span>'
              : '<button type="button" class="dma-btn dma-btn-sm dma-btn-primary" data-call="' + esc(a.id) + '">Call patient</button>';
            return '<div class="dma-row-item"><div><div class="name">' + esc(p.fullName || 'Patient') + '</div><div class="sub">' + esc(a.treatment) + ' · ' + A().fmtTime(a.dateTime) + ' · ' + A().chip(vis.code) + '</div></div>' +
              action + '</div>';
          }).join('')
        : '<p class="dma-hint">No one is waiting. Check in a confirmed visit from the timeline.</p>';
      el('rec-wait').querySelectorAll('[data-call]').forEach(function (b) {
        b.onclick = function () {
          if (global.DmaClinical && DmaClinical.markCalled) {
            DmaClinical.markCalled(b.getAttribute('data-call'));
            A().toast('Patient called.', 'ok');
            home();
          }
        };
      });
    }).catch(function () {
      el('rec-kpis').innerHTML = '';
      el('rec-tl').innerHTML = A().empty("Couldn't load today's appointments.", 'Check your connection.');
    });
  }

  function homeNurse() {
    var root = page();
    root.innerHTML =
      pageHead(greeting() + ', ' + esc(firstName()),
        'Which patients need clinical attention?',
        '<a class="dma-btn dma-btn-primary" href="/dashboard/vitals/">Record vitals</a>',
        'Clinical') +
      '<div id="nurse-next"></div>' +
      '<div class="dma-grid-2">' +
        sectionBlock('Waiting patients', '<div id="nurse-wait"></div>') +
        sectionBlock('Vitals required', '<div id="nurse-vitals"></div>') +
      '</div>' +
      '<div class="dma-grid-2">' +
        sectionBlock('Current patients', '<div id="nurse-now"></div>') +
        sectionBlock('Clinical tasks', '<div id="nurse-tasks"></div>') +
      '</div>';
    A().get('/api/appointments?filter=today&limit=80').then(function (d) {
      var rows = apptList(d);
      el('nurse-next').innerHTML = nextPatientCard(rows);
      var waiting = rows.filter(function (a) {
        var code = visitOf(a).code;
        return code === 'WAITING' || code === 'CALLED' || code === 'CONFIRMED';
      });
      var current = rows.filter(function (a) { return statusOf(a) === 'IN_PROGRESS'; });
      var needVitals = rows.filter(function (a) {
        var st = statusOf(a);
        if (st !== 'ARRIVED' && st !== 'IN_PROGRESS') return false;
        var enc = global.DmaClinical && DmaClinical.fromAppointment(a);
        return enc ? !DmaClinical.vitalsHasData(enc.vitals) : true;
      });
      el('nurse-wait').innerHTML = waiting.length
        ? waiting.map(function (a) {
            var p = a.patient || {};
            var pid = a.patientId || p.id || '';
            return '<a class="dma-row-item" href="' + (pid ? '/dashboard/patients/detail/?id=' + esc(pid) : '/dashboard/appointments/') + '">' +
              '<div class="dma-avatar">' + A().initials(p.fullName) + '</div><div><div class="name">' + esc(p.fullName || 'Patient') + '</div>' +
              '<div class="sub">' + A().fmtTime(a.dateTime) + ' · ' + A().chip(visitOf(a).code) + '</div></div></a>';
          }).join('')
        : '<p class="dma-hint">No waiting patients.</p>';
      el('nurse-vitals').innerHTML = needVitals.length
        ? needVitals.map(function (a) {
            var p = a.patient || {};
            return '<a class="dma-row-item" href="/dashboard/vitals/?id=' + esc(a.id) + '"><div class="name">' + esc(p.fullName || 'Patient') + '</div><div class="sub">No vitals recorded for this visit</div></a>';
          }).join('')
        : '<p class="dma-hint">No visits are waiting for vitals.</p>';
      el('nurse-now').innerHTML = current.length
        ? current.map(function (a) {
            var p = a.patient || {};
            return '<a class="dma-row-item" href="/dashboard/clinical/?id=' + esc(a.id) + '"><div class="name">' + esc(p.fullName || 'Patient') + '</div><div class="sub">In consultation</div></a>';
          }).join('')
        : '<p class="dma-hint">No one is in consultation.</p>';
      el('nurse-tasks').innerHTML = '<p class="dma-hint">Clinical tasks follow live visits. Record vitals on a real encounter — readings are never invented.</p>';
      var start = document.getElementById('start-consult');
      var nid = document.getElementById('next-card') && document.getElementById('next-card').getAttribute('data-id');
      if (start && nid) start.onclick = function () {
        A().patch('/api/appointments/' + nid, { status: 'IN_PROGRESS' }).then(function (r) {
          if (r.ok) {
            if (global.DmaClinical && DmaClinical.clearCalled) DmaClinical.clearCalled(nid);
            home();
          } else A().toast(failMsg(r, "Couldn't start this visit."), 'err');
        });
      };
    });
  }

  function homeAssistant() {
    var root = page();
    root.innerHTML =
      pageHead(greeting() + ', ' + esc(firstName()),
        'Keep appointments, patients and follow-ups moving.',
        '<a class="dma-btn dma-btn-ghost" href="/dashboard/messages/">Inbox</a>' +
        '<a class="dma-btn dma-btn-primary" href="/dashboard/appointments/?action=book">New appointment</a>',
        'Desk') +
      '<div class="dma-grid-2">' +
        sectionBlock("Today's appointments", '<div id="as-tl"></div>') +
        sectionBlock('Tasks', '<div id="as-tk"></div>') +
      '</div>';
    Promise.all([
      A().get('/api/appointments?filter=today&limit=80').catch(function () { return { data: [] }; }),
      A().get('/api/leads?limit=20').catch(function () { return { leads: [] }; })
    ]).then(function (p) {
      var rows = apptList(p[0]);
      var leads = p[1].leads || [];
      el('as-tl').innerHTML = timelineHtml(rows);
      bindTimeline(el('as-tl'), rows, home);
      var items = leads.filter(function (l) { return String(l.status || 'NEW').toUpperCase() === 'NEW'; }).slice(0, 6);
      el('as-tk').innerHTML = items.length
        ? items.map(function (l) {
            return '<a class="dma-row-item" href="/dashboard/leads/?id=' + esc(l.id) + '"><div class="name">' + esc(l.fullName || l.phone || 'Lead') + '</div><div class="sub">Follow up</div></a>';
          }).join('')
        : '<p class="dma-hint">No open follow-ups.</p>';
    });
  }

  function homeManager() {
    var root = page();
    root.innerHTML =
      pageHead(greeting() + ', ' + esc(firstName()),
        'How is the clinic operating today?',
        '<a class="dma-btn dma-btn-ghost" href="/dashboard/reports/">Reports</a>' +
        '<a class="dma-btn dma-btn-primary" href="/dashboard/appointments/?action=book">+ Appointment</a>',
        'Operations') +
      '<div class="cos-kpi-row" id="mgr-kpis">' + A().spinner() + '</div>' +
      '<div class="dma-grid-2">' +
        sectionBlock('Today’s appointments', '<div id="mgr-tl"></div>') +
        sectionBlock('Leads to follow', '<div id="mgr-leads"></div>') +
      '</div>';
    Promise.all([
      A().get('/api/appointments?filter=today&limit=80').catch(function () { return { data: [] }; }),
      A().get('/api/leads?limit=20').catch(function () { return { leads: [] }; }),
      A().get('/api/settings').catch(function () { return {}; }),
    ]).then(function (p) {
      var rows = apptList(p[0]);
      var leads = p[1].leads || [];
      var settings = p[2] || {};
      var rates = todayRates(rows);
      var hours = A().parseJson(settings.workingHours, {}) || {};
      var cap = todayCapacity(hours, rows);
      el('mgr-kpis').innerHTML =
        '<div class="cos-card cos-card--kpi"><span>Appointments</span><strong>' + rows.length + '</strong><em>today</em></div>' +
        '<div class="cos-card cos-card--kpi"><span>Patient volume</span><strong>' + rates.uniquePatients + '</strong><em>unique charts</em></div>' +
        '<div class="cos-card cos-card--kpi"><span>Capacity</span><strong>' + cap.booked + (cap.slots ? '/' + cap.slots : '') + '</strong><em>' + esc(cap.label) + '</em></div>' +
        '<div class="cos-card cos-card--kpi"><span>Visit fees</span><strong>' + money(rates.revenue) + '</strong><em>completed visits</em></div>';
      el('mgr-tl').innerHTML = timelineHtml(rows);
      bindTimeline(el('mgr-tl'), rows, home);
      el('mgr-leads').innerHTML = leads.slice(0, 8).map(function (l) {
        return '<a class="dma-row-item" href="/dashboard/leads/?id=' + esc(l.id) + '"><div><div class="name">' + esc(l.fullName || l.phone || 'Lead') + '</div><div class="sub">' + esc(l.treatmentInterest || l.status) + '</div></div>' + A().chip(l.leadScore || 'NEW') + '</a>';
      }).join('') || '<p class="dma-hint">No open leads.</p>';
    });
  }

  var ICONS = {
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
    msg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    bill: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/></svg>',
  };

  function openApptDrawer(a, onChanged) {
    if (global.DmaInner && DmaInner.apptDrawer) return DmaInner.apptDrawer(a, onChanged);
    var p = a.patient || {};
    var pid = a.patientId || p.id || '';
    var vis = visitOf(a);
    var enc = global.DmaClinical && DmaClinical.fromAppointment ? DmaClinical.fromAppointment(a) : { clinicalNote: {} };
    var d = drawer({
      title: p.fullName || 'Appointment',
      subtitle: (a.treatment || 'Visit') + ' · ' + A().fmtDate(a.dateTime) + ' ' + A().fmtTime(a.dateTime),
      html: (global.DmaUI ? DmaUI.kv([
        ['Patient', p.fullName],
        ['Phone', p.phone || '—'],
        ['Treatment', a.treatment || 'Visit'],
        ['When', A().fmtDate(a.dateTime) + ' ' + A().fmtTime(a.dateTime)],
        ['Duration', (a.durationMin || 30) + ' min'],
        ['Status', vis.label],
        ['Visit reason', (enc.clinicalNote && (enc.clinicalNote.complaint || enc.clinicalNote.freeText)) || '—']
      ]) : '') +
        '<div class="dma-field"><label>Status</label>' + statusSelect(a.status, 'id="ap-st"') + '</div>',
      footer:
        '<button type="button" class="dma-btn dma-btn-ghost" data-close="1">Close</button>' +
        (pid ? '<a class="dma-btn dma-btn-ghost" href="/dashboard/patients/detail/?id=' + esc(pid) + '">Chart</a>' : '') +
        (pid ? '<a class="dma-btn dma-btn-primary" href="/dashboard/messages/?patient=' + esc(pid) + '">Message</a>' : '')
    });
    var sel = document.getElementById('ap-st');
    if (sel) sel.onchange = function () {
      A().patch('/api/appointments/' + a.id, { status: sel.value }).then(function (r) {
        if (r.ok) { A().toast('Appointment updated', 'ok'); if (onChanged) onChanged(); }
        else A().toast(failMsg(r, "Couldn't update this visit."), 'err');
      });
    };
    return d;
  }

  /* ── APPOINTMENTS ─────────────────────────────────────────────────────── */
  function appointments() {
    var root = page();
    root.innerHTML =
      pageHead('Appointments', 'Schedule, confirm, and follow up from WhatsApp or the front desk.',
        '<button class="dma-btn dma-btn-primary" id="btn-book">New appointment</button>', 'Schedule') +
      '<div class="dma-tabs" id="appt-view"></div>' +
      '<section class="dma-section"><div class="dma-section-b" id="appt-list">' + A().spinner() + '</div></section>';

    var view = A().qs('view') || (A().qs('filter') === '' ? 'list' : 'today');
    if (view !== 'calendar' && view !== 'list') view = 'today';
    var views = [['today', 'Today'], ['list', 'List'], ['calendar', 'Calendar']];
    function drawViews() {
      el('appt-view').innerHTML = views.map(function (v) {
        return '<button type="button" data-v="' + v[0] + '" class="' + (view === v[0] ? 'active' : '') + '">' + v[1] + '</button>';
      }).join('');
    }
    drawViews();
    el('appt-view').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      view = b.getAttribute('data-v');
      A().setQs({ view: view, filter: null, action: null }, true);
      drawViews();
      load();
    };
    el('btn-book').onclick = function () { openBookModal(A().qs('patient')); };

    function load() {
      var filter = view === 'today' ? 'today' : view === 'calendar' ? 'week' : '';
      var q = '/api/appointments?limit=50' + (filter ? '&filter=' + encodeURIComponent(filter) : '');
      A().get(q).then(function (d) {
        var rows = d.data || [];
        if (A().qs('id')) {
          var wanted = rows.filter(function (a) { return a.id === A().qs('id'); })[0];
          if (wanted) openApptDrawer(wanted, load);
        }
        if (!rows.length) {
          el('appt-list').innerHTML = A().empty('No appointments', 'Book the first visit or wait for the AI receptionist.', '#', 'Book appointment');
          var cta = el('appt-list').querySelector('a');
          if (cta) cta.onclick = function (ev) { ev.preventDefault(); openBookModal(); };
          return;
        }
        if (view === 'calendar') {
          var groups = {};
          var order = [];
          rows.forEach(function (a) {
            var day = A().fmtDate(a.dateTime);
            if (!groups[day]) { groups[day] = []; order.push(day); }
            groups[day].push(a);
          });
          el('appt-list').innerHTML = order.map(function (day) {
            return '<h3 class="dma-hint" style="margin:12px 0 8px;font-weight:800">' + esc(day) + '</h3>' +
              groups[day].map(apptRow).join('');
          }).join('');
        } else {
          el('appt-list').innerHTML = rows.map(apptRow).join('');
        }
        el('appt-list').querySelectorAll('[data-appt]').forEach(function (n) {
          n.onclick = function (e) {
            if (e.target.closest('a, select, button')) return;
            var id = n.getAttribute('data-appt');
            var a = rows.filter(function (x) { return x.id === id; })[0];
            if (a) openApptDrawer(a, load);
          };
        });
        el('appt-list').querySelectorAll('select[data-id]').forEach(function (sel) {
          sel.onchange = function (e) {
            e.stopPropagation();
            A().patch('/api/appointments/' + sel.getAttribute('data-id'), { status: sel.value }).then(function (r) {
              if (r.ok) A().toast('Appointment updated', 'ok');
              else A().toast(failMsg(r, "Couldn't update this visit."), 'err');
              load();
            });
          };
        });
      }).catch(function () {
        el('appt-list').innerHTML = A().empty('Could not load appointments', 'Check your connection and try again.');
      });
    }

    function apptRow(a) {
      var p = a.patient || {};
      var pid = a.patientId || p.id || '';
      return '<div class="dma-appt" data-appt="' + esc(a.id) + '">' +
        '<div class="dma-appt-time">' + A().fmtTime(a.dateTime) + '<div class="dma-hint">' + A().fmtDate(a.dateTime) + '</div></div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-weight:800">' + esc(p.fullName || 'Patient') + ' ' + A().chip(a.status) + '</div>' +
          '<div class="dma-hint">' + esc(a.treatment || 'Visit') + (a.durationMin ? ' · ' + a.durationMin + ' min' : '') + (p.phone ? ' · ' + esc(p.phone) : '') + '</div>' +
        '</div></div>';
    }

    load();
    if (A().qs('action') === 'book') openBookModal(A().qs('patient'));
  }

  function openBookModal(patientId) {
    A().get('/api/patients?limit=100').then(function (d) {
      var pts = d.data || [];
      var settingsP = A().get('/api/settings').catch(function () { return {}; });
      return settingsP.then(function (s) {
        var treatments = A().parseJson(s.treatments, []) || [];
        if (!Array.isArray(treatments)) treatments = [];
        var tOpts = treatments.map(function (t) {
          var name = typeof t === 'string' ? t : (t.name || t.title || '');
          return '<option>' + esc(name) + '</option>';
        }).join('');
        A().modal('New appointment',
          '<div class="dma-field"><label>Patient</label><select id="bk-patient">' +
            pts.map(function (p) {
              return '<option value="' + esc(p.id) + '"' + (p.id === patientId ? ' selected' : '') + '>' + esc(p.fullName) + ' · ' + esc(p.phone) + '</option>';
            }).join('') + '</select></div>' +
          (pts.length ? '' : '<p class="dma-hint">No patients yet. <a href="/dashboard/patients/?action=new">Add a patient</a> first.</p>') +
          '<div class="dma-row"><div class="dma-field"><label>Treatment</label>' +
            (tOpts ? '<select id="bk-tx">' + tOpts + '</select>' : '<input id="bk-tx" placeholder="Consultation">') +
          '</div><div class="dma-field"><label>Duration (min)</label><input id="bk-dur" type="number" value="30" min="15" max="120"></div></div>' +
          '<div class="dma-field"><label>Date & time</label><input id="bk-dt" type="datetime-local"></div>' +
          '<div class="dma-field"><label>Notes</label><textarea id="bk-notes" rows="2"></textarea></div>',
          '<button class="dma-btn dma-btn-ghost" data-close>Cancel</button>' +
          '<button class="dma-btn dma-btn-primary" id="bk-save">Book & notify</button>'
        );
        var save = el('bk-save');
        if (save) save.onclick = function () {
          if (!pts.length) { A().goto('/dashboard/patients/?action=new'); return; }
          var local = el('bk-dt').value;
          if (!local) { A().toast('Pick a date and time', 'err'); return; }
          save.disabled = true;
          A().post('/api/appointments', {
            patientId: el('bk-patient').value,
            treatment: el('bk-tx').value || 'Consultation',
            dateTime: new Date(local).toISOString(),
            durationMin: Number(el('bk-dur').value || 30),
            notes: el('bk-notes').value || undefined,
            channel: 'MANUAL',
            sendConfirmation: true,
          }).then(function (r) {
            save.disabled = false;
            if (!r.ok) { A().toast(failMsg(r, "Couldn't book this visit."), 'err'); return; }
            A().closeModal();
            A().toast('Appointment booked', 'ok');
            A().setQs({ action: null }, true);
            appointments();
          });
        };
      });
    });
  }

  function openPatientModal(onSaved) {
    A().modal('Add patient',
      '<div class="dma-field"><label>Full name</label><input id="pt-name" required></div>' +
      '<div class="dma-row"><div class="dma-field"><label>Phone</label><input id="pt-phone" placeholder="+92…"></div>' +
      '<div class="dma-field"><label>Email</label><input id="pt-email" type="email"></div></div>' +
      '<div class="dma-row"><div class="dma-field"><label>Gender</label><select id="pt-gender"><option value="">—</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>' +
      '<div class="dma-field"><label>Date of birth</label><input id="pt-dob" type="date"></div></div>' +
      '<div class="dma-field"><label>Medical notes</label><textarea id="pt-notes" rows="2"></textarea></div>',
      '<button class="dma-btn dma-btn-ghost" data-close>Cancel</button><button class="dma-btn dma-btn-primary" id="pt-save">Save patient</button>'
    );
    el('pt-save').onclick = function () {
      var body = {
        fullName: el('pt-name').value.trim(),
        phone: el('pt-phone').value.trim(),
        email: el('pt-email').value.trim(),
        gender: el('pt-gender').value || undefined,
        dateOfBirth: el('pt-dob').value || undefined,
        medicalNotes: el('pt-notes').value || undefined,
      };
      if (!body.fullName || !body.phone) { A().toast('Name and phone are required', 'err'); return; }
      el('pt-save').disabled = true;
      A().post('/api/patients', body).then(function (r) {
        el('pt-save').disabled = false;
        if (!r.ok) { A().toast(failMsg(r, "Couldn't save those details."), 'err'); return; }
        A().closeModal();
        A().toast('Patient added', 'ok');
        if (onSaved) onSaved(r.d);
      });
    };
  }

  function openPatientDrawer(p) {
    var last = (p.appointments && p.appointments[0]) || {};
    var d = drawer({
      title: p.fullName || 'Patient',
      subtitle: p.phone || '',
      tabs: [
        { id: 'overview', label: 'Overview' },
        { id: 'appointments', label: 'Visits' },
        { id: 'clinical', label: 'Prescriptions' },
        { id: 'documents', label: 'Documents' }
      ],
      footer:
        '<a class="dma-btn dma-btn-ghost" href="/dashboard/patients/detail/?id=' + esc(p.id) + '">Open full chart</a>' +
        '<a class="dma-btn dma-btn-ghost" href="/dashboard/messages/?patient=' + esc(p.id) + '">Message</a>' +
        '<a class="dma-btn dma-btn-primary" href="/dashboard/appointments/?action=book&patient=' + esc(p.id) + '">Book</a>',
      onTab: function (tab, api) {
        if (tab === 'overview') {
          api.setBody((global.DmaUI ? DmaUI.kv([
            ['Phone', p.phone], ['Email', p.email], ['Gender', p.gender],
            ['Visits', (p._count && p._count.appointments) || 0],
            ['Last visit', last.dateTime && new Date(last.dateTime).getTime() < Date.now() ? A().fmtDate(last.dateTime) : '—'],
            ['Next appointment', last.dateTime && new Date(last.dateTime).getTime() >= Date.now() ? A().fmtDate(last.dateTime) : '—']
          ]) : '<p>' + esc(p.phone) + '</p>'));
          return;
        }
        api.setBody('<p class="dma-hint">Loading…</p>');
        if (tab === 'appointments') {
          A().get('/api/patients/' + p.id + '/appointments').then(function (d) {
            var rows = Array.isArray(d) ? d : (d.data || []);
            api.setBody(rows.length ? rows.slice(0, 12).map(function (a) {
              return '<div class="dma-row-item"><div><div class="name">' + esc(a.treatment || 'Visit') + '</div><div class="sub">' + A().fmtDate(a.dateTime) + '</div></div>' + A().chip(a.status) + '</div>';
            }).join('') : '<p class="dma-hint">No visits yet.</p>');
          }).catch(function () { api.setBody('<p class="dma-hint">Could not load appointments.</p>'); });
        } else if (tab === 'messages') {
          A().get('/api/patients/' + p.id + '/messages').then(function (d) {
            var rows = Array.isArray(d) ? d : (d.data || d.messages || []);
            api.setBody(rows.length ? rows.slice(0, 10).map(function (m) {
              return '<p class="dma-hint"><strong>' + (m.direction === 'INBOUND' ? 'Patient' : 'Clinic') + ':</strong> ' + esc((m.body || '').slice(0, 160)) + '</p>';
            }).join('') : '<p class="dma-hint">No messages yet.</p>');
          }).catch(function () { api.setBody('<p class="dma-hint">Could not load messages.</p>'); });
        } else if (tab === 'clinical') {
          var lastId = last.id;
          api.setBody(
            '<p class="dma-prose">Prescriptions are written on a visit. This drawer does not keep a separate medication list.</p>' +
            (lastId
              ? '<a class="dma-btn dma-btn-primary" href="/dashboard/prescriptions/?id=' + esc(lastId) + '">Open last prescription</a>'
              : '<p class="dma-hint">No visit yet. Book an appointment first.</p>')
          );
        } else if (tab === 'documents') {
          api.setBody(
            '<p class="dma-prose">Documents are stored on authenticated clinic endpoints. Open the documents workspace to download files.</p>' +
            '<a class="dma-btn dma-btn-primary" href="/dashboard/documents/">Open documents</a>'
          );
        } else if (tab === 'activity') {
          A().get('/api/patients/' + p.id + '/appointments').then(function (d) {
            var rows = Array.isArray(d) ? d : (d.data || []);
            api.setBody(rows.length ? rows.slice(0, 12).map(function (a) {
              return '<div class="dma-row-item"><div><div class="name">' + esc(a.status) + ' · ' + esc(a.treatment || 'Visit') + '</div><div class="sub">' + A().fmtDate(a.dateTime) + '</div></div></div>';
            }).join('') : '<p class="dma-hint">No activity recorded yet.</p>');
          }).catch(function () { api.setBody('<p class="dma-hint">Could not load activity.</p>'); });
        } else {
          api.setBody('<p class="dma-prose">' + esc(p.medicalNotes || 'No notes recorded.') + '</p>');
        }
      }
    });
    return d;
  }

  /* ── PATIENTS ─────────────────────────────────────────────────────────── */
  function patients() {
    var root = page();
    var filter = 'all';
    root.innerHTML =
      pageHead('Patients', "Search and manage your clinic's patient records.",
        '<button class="dma-btn dma-btn-primary" id="pt-add">+ New patient</button>') +
      '<div class="cos-pt-toolbar"><input class="dma-search" id="pt-search" placeholder="Search patients..." aria-label="Search patients">' +
      '<div class="dma-tabs" id="pt-filters" role="tablist">' +
        '<button type="button" data-f="all" class="active">All</button>' +
        '<button type="button" data-f="active">Active</button>' +
        '<button type="button" data-f="recent">Recent</button>' +
      '</div></div>' +
      '<section class="dma-section"><div class="dma-table-wrap"><table class="dma-table dma-table--patients"><thead><tr><th>Patient</th><th>Contact</th><th>Last visit</th><th>Next appointment</th><th></th></tr></thead><tbody id="pt-body"><tr><td colspan="5">' + A().spinner() + '</td></tr></tbody></table></div><div class="ds-card-list" id="pt-cards" hidden></div></section>';

    var rows = [];
    function visible() {
      var now = Date.now();
      return rows.filter(function (p) {
        if (filter === 'active') return p.isActive !== false;
        if (filter === 'recent') {
          var last = (p.appointments && p.appointments[0]) || {};
          return last.dateTime && (now - new Date(last.dateTime).getTime()) < 30 * 24 * 60 * 60 * 1000;
        }
        return true;
      });
    }
    function paint() {
      var list = visible();
      if (!rows.length) {
        el('pt-body').innerHTML = '<tr><td colspan="5">' + A().empty('No patients yet', 'Add a patient, or they will appear from WhatsApp.', '#', 'Add patient') + '</td></tr>';
        if (el('pt-cards')) el('pt-cards').innerHTML = '';
        var c = el('pt-body').querySelector('a'); if (c) c.onclick = function (e) { e.preventDefault(); el('pt-add').click(); };
        return;
      }
      if (!list.length) {
        el('pt-body').innerHTML = '<tr><td colspan="5"><p class="dma-hint">No patients match this filter.</p></td></tr>';
        if (el('pt-cards')) el('pt-cards').innerHTML = '';
        return;
      }
      el('pt-body').innerHTML = list.map(function (p) {
        var i = rows.indexOf(p);
        var last = (p.appointments && p.appointments[0]) || {};
        var when = last.dateTime ? new Date(last.dateTime).getTime() : 0;
        var lastLabel = when && when < Date.now() ? A().fmtDate(last.dateTime) : '—';
        var nextLabel = when && when >= Date.now() ? A().fmtDate(last.dateTime) : '—';
        return '<tr data-i="' + i + '">' +
          '<td><div class="dma-pt-identity"><div class="dma-avatar" aria-hidden="true">' + A().initials(p.fullName) + '</div><div><strong>' + esc(p.fullName) + '</strong></div></div></td>' +
          '<td>' + esc(p.phone || p.email || '—') + '</td>' +
          '<td>' + lastLabel + '</td>' +
          '<td>' + nextLabel + '</td>' +
          '<td style="white-space:nowrap">' +
            '<a class="dma-btn dma-btn-ghost dma-btn-sm" href="/dashboard/messages/?patient=' + esc(p.id) + '">Message</a> ' +
            '<a class="dma-btn dma-btn-ghost dma-btn-sm" href="/dashboard/appointments/?action=book&patient=' + esc(p.id) + '">Book</a>' +
          '</td></tr>';
      }).join('');
      if (el('pt-cards')) {
        el('pt-cards').innerHTML = list.map(function (p) {
          var i = rows.indexOf(p);
          var last = (p.appointments && p.appointments[0]) || {};
          return '<button type="button" class="ds-entity-card" data-i="' + i + '">' +
            '<div class="dma-avatar" aria-hidden="true">' + A().initials(p.fullName) + '</div>' +
            '<div><strong>' + esc(p.fullName) + '</strong><div class="dma-hint">' + esc(p.phone || '') + '</div>' +
            '<div class="dma-hint">' + (last.dateTime ? A().fmtDate(last.dateTime) : 'No visits yet') + '</div></div></button>';
        }).join('');
      }
    }
    function load(q) {
      A().get('/api/patients?limit=50' + (q ? '&search=' + encodeURIComponent(q) : '')).then(function (d) {
        rows = d.data || [];
        paint();
      });
    }
    if (el('pt-filters')) {
      el('pt-filters').onclick = function (e) {
        var b = e.target.closest('[data-f]'); if (!b) return;
        filter = b.getAttribute('data-f');
        el('pt-filters').querySelectorAll('button').forEach(function (x) { x.classList.toggle('active', x === b); });
        paint();
      };
    }
    el('pt-body').onclick = function (e) {
      if (e.target.closest('a, button')) return;
      var tr = e.target.closest('[data-i]');
      if (!tr) return;
      openPatientDrawer(rows[Number(tr.getAttribute('data-i'))]);
    };
    if (el('pt-cards')) {
      el('pt-cards').onclick = function (e) {
        var card = e.target.closest('[data-i]');
        if (!card) return;
        openPatientDrawer(rows[Number(card.getAttribute('data-i'))]);
      };
    }
    var t;
    el('pt-search').oninput = function () {
      clearTimeout(t);
      var v = el('pt-search').value;
      t = setTimeout(function () { load(v); }, 250);
    };
    el('pt-add').onclick = function () {
      openPatientModal(function (p) { load(); if (p) openPatientDrawer(p); });
    };
    load();
    if (A().qs('action') === 'new') openPatientModal(function (p) { load(); if (p) openPatientDrawer(p); });
  }

  function patientDetail() {
    var id = A().qs('id');
    if (!id) {
      var m = location.pathname.match(/\/dashboard\/patients\/([a-zA-Z0-9]+)\/?$/);
      id = m && m[1] !== 'detail' ? m[1] : '';
    }
    var root = page();
    if (!id) {
      root.innerHTML = A().empty('Select a patient', 'Open the patient list to view a chart.', '/dashboard/patients/', 'Patients');
      return;
    }
    root.innerHTML = A().spinner();
    Promise.all([
      A().get('/api/patients/' + id),
      A().get('/api/patients/' + id + '/appointments').catch(function () { return []; }),
      A().get('/api/patients/' + id + '/messages').catch(function () { return []; }),
    ]).then(function (parts) {
      var p = parts[0];
      var appts = Array.isArray(parts[1]) ? parts[1] : (parts[1].data || parts[1].appointments || []);
      var msgs = Array.isArray(parts[2]) ? parts[2] : (parts[2].data || parts[2].messages || []);
      var tab = 'overview';
      function draw() {
        root.innerHTML =
          pageHead(esc(p.fullName), esc(p.phone || '') + (p.email ? ' · ' + esc(p.email) : ''),
            '<a class="dma-btn dma-btn-ghost" href="/dashboard/messages/?patient=' + esc(p.id) + '">WhatsApp thread</a>' +
            '<a class="dma-btn dma-btn-primary" href="/dashboard/appointments/?action=book&patient=' + esc(p.id) + '">Book visit</a>') +
          '<p class="dma-hint" style="margin-top:-8px"><a href="/dashboard/patients/">← Patients</a></p>' +
          '<div class="dma-tabs" id="pt-tabs">' +
            [['overview','Overview'],['appointments','Appointments'],['messages','Messages'],['notes','Notes']].map(function (t) {
              return '<button type="button" data-t="' + t[0] + '" class="' + (tab === t[0] ? 'active' : '') + '">' + t[1] + '</button>';
            }).join('') +
          '</div><div id="pt-tab-body" class="dma-section"><div class="dma-section-b"></div></div>';
        var body = el('pt-tab-body').querySelector('.dma-section-b');
        if (tab === 'overview') {
          body.innerHTML = [['Phone', p.phone], ['Email', p.email], ['Gender', p.gender], ['Blood group', p.bloodGroup], ['Allergies', p.allergies]].map(function (row) {
            return '<div class="dma-field"><label>' + row[0] + '</label><div>' + esc(row[1] || '—') + '</div></div>';
          }).join('');
        } else if (tab === 'appointments') {
          body.innerHTML = appts.length ? appts.map(function (a) {
            return '<div class="dma-row-item"><div><div class="name">' + esc(a.treatment || 'Visit') + '</div><div class="sub">' + A().fmtDate(a.dateTime) + ' ' + A().fmtTime(a.dateTime) + '</div></div>' + A().chip(a.status) + '</div>';
          }).join('') : '<p class="dma-hint">No visits yet.</p>';
        } else if (tab === 'messages') {
          body.innerHTML = msgs.length ? msgs.map(function (m) {
            return '<div class="dma-hint" style="margin-bottom:8px"><strong>' + (m.direction === 'INBOUND' ? 'Patient' : 'Clinic') + ':</strong> ' + esc((m.body || '').slice(0, 140)) + '</div>';
          }).join('') : '<p class="dma-hint">No messages yet. Connect WhatsApp to start.</p>';
        } else {
          body.innerHTML = '<p>' + esc(p.medicalNotes || 'No notes recorded.') + '</p>';
        }
        el('pt-tabs').onclick = function (e) {
          var b = e.target.closest('button'); if (!b) return;
          tab = b.getAttribute('data-t');
          draw();
        };
      }
      draw();
    }).catch(function () {
      root.innerHTML = A().empty('Patient not found', 'They may have been removed.', '/dashboard/patients/', 'Back to patients');
    });
  }

  /* ── MESSAGES ─────────────────────────────────────────────────────────── */
  function messages() {
    var root = page();
    var owner = identity() === 'OWNER';
    root.innerHTML =
      pageHead('Inbox', 'Patient conversations. Reply, escalate, or open the chart.',
        owner ? '<a class="dma-btn dma-btn-ghost" href="/dashboard/whatsapp/">WhatsApp</a><a class="dma-btn dma-btn-primary" href="/dashboard/broadcasts/">New broadcast</a>' : '',
        '') +
      '<div id="msg-wa"></div>' +
      '<div class="dma-inbox" id="msg-inbox"><div class="dma-inbox-list" id="msg-list">' + A().spinner() + '</div><div class="dma-thread" id="msg-thread"></div><aside class="dma-inbox-ctx" id="msg-ctx"></aside></div>';

    if (owner) {
      A().waStatus().then(function (wa) {
        var on = !!(wa.connected || wa.status === 'connected' || wa.status === 'CONNECTED');
        el('msg-wa').innerHTML = on ? '' : '<div class="dma-banner warn">Inbox is empty until WhatsApp is connected. <a href="/dashboard/whatsapp/">Connect with Meta</a></div>';
      });
    }

    var selected = A().qs('patient');
    A().get('/api/messages?limit=80').then(function (rows) {
      var list = Array.isArray(rows) ? rows : (rows.data || rows.messages || []);
      var threads = {};
      var order = [];
      list.forEach(function (m) {
        var pid = m.patientId || (m.patient && m.patient.id) || m.fromNumber || m.id;
        if (!threads[pid]) { threads[pid] = { id: pid, patient: m.patient || { fullName: m.fromNumber, phone: m.fromNumber }, last: m, unread: 0 }; order.push(pid); }
        if (m.direction === 'INBOUND' && !m.isRead) threads[pid].unread++;
        if (new Date(m.createdAt) > new Date(threads[pid].last.createdAt || 0)) threads[pid].last = m;
      });
      if (!order.length) {
        el('msg-list').innerHTML = A().empty('No conversations', 'When patients message WhatsApp, threads appear here.');
        el('msg-thread').innerHTML = '';
        return;
      }
      if (!selected) selected = order[0];
      function renderList() {
        el('msg-list').innerHTML = order.map(function (pid) {
          var t = threads[pid];
          return '<div class="dma-inbox-item' + (pid === selected ? ' on' : '') + (t.unread ? ' unread' : '') + '" data-id="' + esc(pid) + '">' +
            '<div class="name">' + esc((t.patient && t.patient.fullName) || 'Patient') + (t.unread ? ' <span class="dma-chip dma-chip-blue">' + t.unread + '</span>' : '') + '</div>' +
            '<div class="sub">' + esc((t.last.body || '').slice(0, 70)) + '</div>' +
            '<div class="dma-hint">' + A().ago(t.last.createdAt) + '</div></div>';
        }).join('');
        el('msg-list').querySelectorAll('.dma-inbox-item').forEach(function (n) {
          n.onclick = function () {
            selected = n.getAttribute('data-id');
            A().setQs({ patient: selected }, true);
            var box = el('msg-inbox');
            if (box) box.classList.add('thread-open');
            renderList();
            openThread();
          };
        });
      }
      function openThread() {
        var t = threads[selected] || {};
        var p = t.patient || {};
        el('msg-thread').innerHTML =
          '<div class="dma-thread-h">' +
            '<button type="button" class="dma-btn dma-btn-ghost dma-btn-sm" id="msg-back" style="display:none">Back</button>' +
            '<div class="dma-avatar">' + A().initials(p.fullName) + '</div>' +
            '<div style="flex:1"><div class="name" style="font-weight:800">' + esc(p.fullName || 'Patient') + '</div><div class="dma-hint">' + esc(p.phone || '') + '</div></div>' +
            '<a class="dma-btn dma-btn-ghost dma-btn-sm" href="/dashboard/patients/detail/?id=' + esc(selected) + '">Chart</a>' +
            '<a class="dma-btn dma-btn-ghost dma-btn-sm" href="/dashboard/appointments/?action=book&patient=' + esc(selected) + '">Book</a>' +
          '</div>' +
          '<div class="dma-thread-m" id="msg-bubbles">' + A().spinner() + '</div>' +
          '<form class="dma-thread-c" id="msg-form"><input id="msg-input" placeholder="Reply on WhatsApp…" autocomplete="off"><button class="dma-btn dma-btn-primary" type="submit">Send</button></form>';
        var ctx = el('msg-ctx');
        if (ctx) {
          ctx.innerHTML =
            '<div class="dma-pt-identity" style="margin-bottom:12px"><div class="dma-avatar">' + A().initials(p.fullName) + '</div>' +
            '<div><strong>' + esc(p.fullName || 'Patient') + '</strong><div class="dma-hint">' + esc(p.phone || '') + '</div></div></div>' +
            '<p class="dma-hint">Patient context from this clinic. Open the chart for full history.</p>' +
            '<div class="dma-btn-row" style="margin-top:12px">' +
              '<a class="dma-btn dma-btn-ghost dma-btn-sm" href="/dashboard/patients/detail/?id=' + esc(selected) + '">Open chart</a>' +
              '<a class="dma-btn dma-btn-ghost dma-btn-sm" href="/dashboard/leads/">Leads</a>' +
            '</div>';
        }
        var back = el('msg-back');
        if (back) {
          if (window.matchMedia && window.matchMedia('(max-width: 900px)').matches) back.style.display = '';
          back.onclick = function () {
            var box = el('msg-inbox');
            if (box) box.classList.remove('thread-open');
          };
        }
        A().get('/api/messages/threads/' + selected).then(function (thread) {
          var items = Array.isArray(thread) ? thread : (thread.messages || thread.data || []);
          el('msg-bubbles').innerHTML = items.length
            ? items.map(function (m) {
                var st = m.deliveryStatus || '';
                var who = m.senderType === 'AI' || m.isHandledByAI ? 'AI' : (m.direction === 'OUTBOUND' ? 'You' : '');
                var ticks = st === 'read' ? 'Read' : st === 'delivered' ? 'Delivered' : st === 'failed' ? 'Failed' : st === 'sending' ? 'Sending' : st === 'sent' ? 'Sent' : '';
                return '<div class="dma-bubble ' + (m.direction === 'OUTBOUND' ? 'out' : 'in') + '">' + esc(m.body || '') +
                  '<div class="cos-meta">' + A().ago(m.createdAt) +
                  (who ? ' · <span class="cos-ai">' + who + '</span>' : '') +
                  (m.direction === 'OUTBOUND' && ticks ? ' · <span class="cos-status-' + esc(st) + '">' + ticks + '</span>' : '') +
                  '</div></div>';
              }).join('')
            : '<p class="dma-hint">No messages in this thread yet.</p>';
          el('msg-bubbles').scrollTop = el('msg-bubbles').scrollHeight;
        }).catch(function () {
          el('msg-bubbles').innerHTML = '<p class="dma-hint">Could not load this thread.</p>';
        });
        el('msg-form').onsubmit = function (e) {
          e.preventDefault();
          var body = el('msg-input').value.trim();
          if (!body) return;
          A().post('/api/messages/send', { patientId: selected, body: body, channel: 'WHATSAPP' }).then(function (r) {
            if (!r.ok) { A().toast(failMsg(r, "Couldn't send that message. Connect WhatsApp first."), 'err'); return; }
            el('msg-input').value = '';
            A().toast('Sent', 'ok');
            openThread();
          });
        };
      }
      renderList();
      openThread();
    });
  }

  /* ── AI / TRAIN ───────────────────────────────────────────────────────── */
  function ai() {
    var root = page();
    if (global.DmaAiTraining) {
      global.DmaAiTraining.mount(root);
      return;
    }
    root.innerHTML = '<p class="dma-hint">Training module failed to load. Refresh the page.</p>';
  }
  /* ── ANALYTICS ────────────────────────────────────────────────────────── */
  function analytics() {
    var root = page();
    var tab = A().qs('tab') || 'clinical';
    if (tab === 'overview' || tab === 'appointments') tab = 'clinical';
    if (tab === 'messages') tab = 'operational';
    root.innerHTML =
      pageHead('Analytics', 'Know how your clinic is performing — from records it actually captured.',
        '<a class="dma-btn dma-btn-ghost" href="/dashboard/reviews/">Reviews</a>') +
      '<div class="dma-tabs" id="an-tabs"></div>' +
      '<div class="dma-kpis" id="an-kpis">' + A().spinner() + '</div>' +
      '<div id="an-body"></div>';
      var tabs = [['clinical', 'Clinical'], ['operational', 'Operational'], ['financial', 'Financial']];
    function drawTabs() {
      el('an-tabs').innerHTML = tabs.map(function (t) {
        return '<button type="button" data-t="' + t[0] + '" class="' + (tab === t[0] ? 'active' : '') + '">' + t[1] + '</button>';
      }).join('');
    }
    drawTabs();
    el('an-tabs').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      tab = b.getAttribute('data-t');
      A().setQs({ tab: tab }, true);
      drawTabs();
      paint();
    };
    var cache = null;
    function paint() {
      if (!cache) return;
      var ov = cache[0] || {};
      var weekFail = !!(cache[1] && cache[1]._fail);
      var txsFail = !!(cache[2] && cache[2]._fail);
      var chFail = !!(cache[3] && cache[3]._fail);
      var revFail = !!(cache[4] && cache[4]._fail);
      var week = weekFail ? [] : (Array.isArray(cache[1]) ? cache[1] : []);
      var txs = txsFail ? [] : (Array.isArray(cache[2]) ? cache[2] : (cache[2] && cache[2].data) || []);
      var ch = chFail ? [] : (Array.isArray(cache[3]) ? cache[3] : []);
      var rev = revFail ? [] : (Array.isArray(cache[4]) ? cache[4] : []);
      el('an-kpis').innerHTML =
        kpi('Visit fees', ov.revenue && ov.revenue.value != null ? A().money(ov.revenue.value) : 'Unavailable', ov.revenue && ov.revenue.change != null ? ((ov.revenue.change >= 0 ? 'up ' : 'down ') + ov.revenue.change + '% vs last month') : '') +
        kpi('Appointments', ov.appointments && ov.appointments.value != null ? ov.appointments.value : 'Unavailable', ov.appointments && ov.appointments.change != null ? ov.appointments.change + '% vs last month' : '') +
        kpi('Return rate', ov.returnRate && ov.returnRate.value != null ? ov.returnRate.value + '%' : 'Unavailable', 'completed patients returning') +
        kpi('No-show rate', ov.noShowRate && ov.noShowRate.value != null ? ov.noShowRate.value + '%' : 'Unavailable', 'this month');
      var max = Math.max.apply(null, week.map(function (d) { return d.count || 0; }).concat([1]));
      var weekHtml = weekFail
        ? '<p class="dma-hint">Unavailable</p>'
        : (week.length
        ? week.map(function (d) {
            var c = d.count || 0;
            return '<div class="dma-comp-row"><span style="width:48px">' + esc(d.date) + '</span><div class="dma-comp-bar"><i style="width:' + Math.round((c / max) * 100) + '%"></i></div><strong>' + c + '</strong></div>';
          }).join('')
        : '<p class="dma-hint">No appointments in the last 7 days.</p>');
      var txHtml = txsFail ? '<p class="dma-hint">Unavailable</p>' : (txs.length ? txs.map(function (t) {
        return '<div class="dma-row-item"><div class="name">' + esc(t.treatment || t.name) + '</div><div class="meta">' + esc(t.count || t._count || 0) + '</div></div>';
      }).join('') : '<p class="dma-hint">No completed treatments yet.</p>');
      var chHtml = chFail ? '<p class="dma-hint">Unavailable</p>' : (ch.length ? ch.map(function (c) {
        return '<div class="dma-row-item"><div class="name">' + esc(c.channel || c.name) + '</div><div class="meta">' + esc(c.count || 0) + '</div></div>';
      }).join('') : '<p class="dma-hint">No messages yet. <a href="/dashboard/whatsapp/">Connect WhatsApp</a>.</p>');
      var revHtml = revFail
        ? '<p class="dma-hint">Unavailable</p>'
        : (rev.length
        ? rev.map(function (r) {
            var mx = Math.max.apply(null, rev.map(function (x) { return Number(x.revenue) || 0; }).concat([1]));
            var v = Number(r.revenue) || 0;
            return '<div class="dma-comp-row"><span style="width:88px">' + esc(r.month) + '</span><div class="dma-comp-bar"><i style="width:' + Math.round((v / mx) * 100) + '%"></i></div><strong>' + money(v) + '</strong></div>';
          }).join('')
        : '<p class="dma-hint">No completed visit fees yet.</p>');
      if (tab === 'operational') {
        el('an-body').innerHTML = sectionBlock('Messages by channel', chHtml) + sectionBlock('Appointments (7 days)', weekHtml);
      } else if (tab === 'financial') {
        el('an-body').innerHTML = sectionBlock('Visit fees by month', '<p class="dma-hint">Fees recorded on completed visits.</p>' + revHtml);
      } else {
        el('an-body').innerHTML =
          '<div class="dma-grid-2">' + sectionBlock('Appointments over time', weekHtml) + sectionBlock('Top services', txHtml) + '</div>' +
          '<div class="dma-grid-2">' +
            '<div class="cos-card cos-card--kpi"><span>No-show rate</span><strong>' + (ov.noShowRate && ov.noShowRate.value != null ? ov.noShowRate.value + '%' : 'Unavailable') + '</strong><em>Share of visits marked no-show this month.</em></div>' +
            '<div class="cos-card cos-card--kpi"><span>Patient return rate</span><strong>' + (ov.returnRate && ov.returnRate.value != null ? ov.returnRate.value + '%' : 'Unavailable') + '</strong><em>Completed patients who booked again.</em></div>' +
          '</div>';
      }
    }
    Promise.all([
      A().getFull('/api/analytics/overview'),
      A().getFull('/api/analytics/weekly-appointments'),
      A().getFull('/api/analytics/top-treatments'),
      A().getFull('/api/analytics/messages-by-channel'),
      A().getFull('/api/analytics/monthly-revenue'),
    ]).then(function (p) {
      if (!p[0] || !p[0].ok) {
        el('an-kpis').innerHTML = '';
        el('an-body').innerHTML = A().empty('Analytics unavailable', 'The analytics API could not be reached. Try again.');
        return;
      }
      cache = p.map(function (r) {
        return r && r.ok ? (r.d || []) : { _fail: true };
      });
      paint();
    }).catch(function () {
      el('an-kpis').innerHTML = '';
      el('an-body').innerHTML = A().empty('Analytics unavailable', 'Check your connection and try again.');
    });
  }

  /* ── REVIEWS ──────────────────────────────────────────────────────────── */
  function reviews() {
    var root = page();
    root.innerHTML =
      pageHead('Reviews', 'See patient feedback and request reviews after completed visits.',
        '<button class="dma-btn dma-btn-primary" id="rv-req">Request reviews</button>', 'Reputation') +
      '<div id="rv-body">' + A().spinner() + '</div>';
    A().getFull('/api/reviews').then(function (r) {
      if (!r.ok) {
        el('rv-body').innerHTML = A().empty('Reviews unavailable', 'Could not load reviews. Try again.');
        return;
      }
      var d = r.d || {};
      if (!d.configured) {
        el('rv-body').innerHTML = A().empty('Google reviews not connected', 'Add a Place ID in Settings, then request reviews after completed appointments.', '/dashboard/settings/?tab=clinic', 'Open settings');
        return;
      }
      var rows = d.reviews || [];
      el('rv-body').innerHTML =
        '<div class="dma-kpis"><div class="dma-kpi"><div><label>Rating</label><strong>' + esc(d.rating || '—') + '</strong></div></div>' +
        '<div class="dma-kpi"><div><label>Reviews</label><strong>' + esc(d.totalReviews || rows.length) + '</strong></div></div></div>' +
        '<section class="dma-section"><header class="dma-section-h"><h2>Google reviews</h2></header><div class="dma-section-b">' +
        (rows.map(function (r, i) {
          return '<div class="dma-row-item" data-rv="' + i + '" role="button" tabindex="0"><div><div class="name">' + esc(r.author_name || 'Patient') + ' · ' + esc(r.rating) + '/5</div><div class="sub">' + esc((r.text || '').slice(0, 120)) + '</div></div></div>';
        }).join('') || '<p class="dma-hint">No Google reviews returned yet.</p>') +
        '</div></section>';
      el('rv-body').querySelectorAll('[data-rv]').forEach(function (n) {
        n.onclick = function () {
          var r = rows[Number(n.getAttribute('data-rv'))];
          if (!r) return;
          drawer({
            title: r.author_name || 'Review',
            subtitle: (r.rating || '—') + '/5',
            html: '<p class="dma-prose">' + esc(r.text || 'No comment.') + '</p>',
            footer: '<button type="button" class="dma-btn dma-btn-ghost" data-close="1">Close</button>'
          });
        };
      });
    }).catch(function () {
      el('rv-body').innerHTML = A().empty('Reviews unavailable', 'Could not load reviews. Try again.');
    });
    el('rv-req').onclick = function () {
      A().get('/api/appointments?filter=month&limit=50').then(function (d) {
        var done = (d.data || []).filter(function (a) { return a.status === 'COMPLETED'; });
        var ids = done.map(function (a) { return a.patientId; }).filter(Boolean);
        if (!ids.length) { A().toast('No completed visits this month to request reviews from', 'err'); return; }
        A().post('/api/reviews/request', { patientIds: ids, channel: 'WHATSAPP' }).then(function (r) {
          if (r.ok) A().toast('Review requests queued on WhatsApp', 'ok');
          else A().toast(failMsg(r, "Couldn't send. Connect WhatsApp first."), 'err');
        });
      });
    };
  }

  /* ── STAFF ────────────────────────────────────────────────────────────── */
  function staff() {
    var root = page();
    root.innerHTML =
      pageHead('Team', 'Manage the people who help run your clinic.',
        '<button class="dma-btn dma-btn-primary" id="st-add">+ Invite team member</button>') +
      '<div class="dma-tabs" id="st-tabs" role="tablist"><button type="button" data-g="all" class="active">All</button><button type="button" data-g="doctors">Doctors</button><button type="button" data-g="staff">Staff</button></div>' +
      '<div id="st-body">' + A().spinner() + '</div>';
    function openStaff(s, load) {
      var d = drawer({
        title: s.name,
        subtitle: s.role,
        wide: true,
        tabs: [
          { id: 'profile', label: 'Profile' },
          { id: 'permissions', label: 'Permissions' },
          { id: 'activity', label: 'Activity' }
        ],
        footer: '<button type="button" class="dma-btn dma-btn-ghost" data-close="1">Close</button>',
        onTab: function (tab, api) {
          if (tab === 'profile') {
            api.setBody((global.DmaUI ? DmaUI.kv([['Email', s.email], ['Role', s.role], ['Status', s.status], ['Joined', s.createdAt ? A().fmtDate(s.createdAt) : '—']]) : '') +
              '<p class="dma-hint">Details from the staff directory.</p>');
            api.setFooter('<button type="button" class="dma-btn dma-btn-ghost" data-close="1">Close</button>');
            return;
          }
          if (tab === 'permissions') {
            api.setBody(
              '<div class="dma-field"><label for="st-edit-role">Role</label><select id="st-edit-role">' +
              ['RECEPTIONIST', 'NURSE', 'ASSISTANT', 'MANAGER'].map(function (r) {
                return '<option value="' + r + '"' + (s.role === r ? ' selected' : '') + '>' + r + '</option>';
              }).join('') + '</select></div>' +
              '<p class="dma-hint">Role is the live permission control for this member.</p>'
            );
            api.setFooter(
              '<button type="button" class="dma-btn dma-btn-ghost" data-close="1">Close</button>' +
              '<button type="button" class="dma-btn dma-btn-primary" id="st-save-role">Save</button>'
            );
            var save = document.getElementById('st-save-role');
            if (save) save.onclick = function () {
              var sel = document.getElementById('st-edit-role');
              A().patch('/api/staff/' + s.id, { role: sel ? sel.value : s.role }).then(function (r) {
                if (r.ok) { A().toast('Staff updated', 'ok'); if (d && d.close) d.close(); else A().closeModal(); load(); }
                else A().toast(failMsg(r, "Couldn't update this team member."), 'err');
              });
            };
            return;
          }
          api.setBody('<div class="ds-empty-panel"><strong>No activity log yet</strong>This clinic does not expose a staff activity API. Nothing is invented here.</div>');
          api.setFooter('<button type="button" class="dma-btn dma-btn-ghost" data-close="1">Close</button>');
        }
      });
    }
    var group = 'all';
    var staffList = [];
    var doctors = [];
    function paintTeam() {
      var showDocs = group !== 'staff';
      var showStaff = group !== 'doctors';
      var html = '';
      if (showDocs) {
        html += doctors.map(function (pr, i) {
          return '<div class="dma-person-card">' +
            '<div class="dma-avatar">' + A().initials(pr.name) + '</div>' +
            '<strong>' + esc(pr.name) + '</strong><div class="dma-hint">' + esc(pr.specialty || 'Doctor') + '</div>' +
            '<div style="margin:8px 0">' + A().chip('Doctor') + '</div></div>';
        }).join('');
      }
      if (showStaff) {
        html += staffList.map(function (s, i) {
          return '<div class="dma-person-card" data-i="' + i + '">' +
            '<div class="dma-avatar">' + A().initials(s.name) + '</div>' +
            '<strong>' + esc(s.name) + '</strong><div class="dma-hint">' + esc(s.role) + '</div>' +
            '<div style="margin:8px 0">' + A().chip(s.status) + '</div>' +
            '<div class="dma-head-actions" style="margin-top:8px">' +
              '<button type="button" class="dma-btn dma-btn-ghost dma-btn-sm" data-view="' + i + '">View</button>' +
              '<button type="button" class="dma-btn dma-btn-ghost dma-btn-sm" data-edit="' + i + '">Edit</button>' +
              '<button type="button" class="dma-btn dma-btn-danger dma-btn-sm" data-id="' + esc(s.id) + '">Deactivate</button>' +
            '</div></div>';
        }).join('');
      }
      if (!html) {
        el('st-body').innerHTML = A().empty(
          group === 'doctors' ? 'No doctors listed' : 'No staff yet',
          group === 'doctors' ? 'Clinicians appear from the clinic roster.' : 'Invite a receptionist to share the inbox.'
        );
        return;
      }
      el('st-body').innerHTML = '<div class="dma-staff-grid">' + html + '</div>';
      el('st-body').querySelectorAll('[data-view], [data-edit]').forEach(function (b) {
        b.onclick = function () {
          var s = staffList[Number(b.getAttribute('data-view') || b.getAttribute('data-edit'))];
          if (s) openStaff(s, load);
        };
      });
      el('st-body').querySelectorAll('button[data-id]').forEach(function (b) {
        b.onclick = function () {
          A().del('/api/staff/' + b.getAttribute('data-id')).then(function (r) {
            if (r.ok) { A().toast('Staff updated', 'ok'); load(); }
            else A().toast(failMsg(r, "Couldn't update that team member."), 'err');
          });
        };
      });
    }
    function load() {
      Promise.all([
        A().get('/api/staff'),
        A().get('/api/roster').catch(function () { return { practitioners: [] }; })
      ]).then(function (p) {
        var rows = p[0];
        if (rows && (rows.error || rows.code)) {
          el('st-body').innerHTML = '<div class="cos-unavail"><h2>Team directory</h2><p>Staff invites are managed by the clinic owner.</p></div>';
          return;
        }
        staffList = Array.isArray(rows) ? rows : [];
        doctors = (p[1] && p[1].practitioners) || [];
        paintTeam();
      });
    }
    if (el('st-tabs')) {
      el('st-tabs').onclick = function (e) {
        var b = e.target.closest('[data-g]'); if (!b) return;
        group = b.getAttribute('data-g');
        el('st-tabs').querySelectorAll('button').forEach(function (x) { x.classList.toggle('active', x === b); });
        paintTeam();
      };
    }
    load();
    el('st-add').onclick = function () {
      A().modal('Invite staff',
        '<div class="dma-field"><label>Name</label><input id="st-name"></div>' +
        '<div class="dma-field"><label>Email</label><input id="st-email" type="email"></div>' +
        '<div class="dma-field"><label>Role</label><select id="st-role"><option value="RECEPTIONIST">Receptionist</option><option value="NURSE">Nurse</option><option value="ASSISTANT">Assistant</option><option value="MANAGER">Manager</option></select></div>',
        '<button class="dma-btn dma-btn-ghost" data-close>Cancel</button><button class="dma-btn dma-btn-primary" id="st-save">Send invite</button>'
      );
      el('st-save').onclick = function () {
        A().post('/api/staff/invite', { name: el('st-name').value, email: el('st-email').value, role: el('st-role').value }).then(function (r) {
          if (!r.ok) { A().toast(failMsg(r, "Couldn't send that invite."), 'err'); return; }
          A().closeModal(); A().toast('Invite sent', 'ok'); load();
        });
      };
    };
  }

  /* ── BILLING ──────────────────────────────────────────────────────────── */
  function billing() {
    var root = page();
    root.innerHTML =
      pageHead('Billing', 'Your current plan, usage and invoices.') +
      '<div id="bl-body">' + A().spinner() + '</div>';
    Promise.all([A().get('/api/billing/subscription'), A().get('/api/billing/invoices').catch(function () { return []; })]).then(function (p) {
      var s = p[0] || {};
      var inv = Array.isArray(p[1]) ? p[1] : [];
      var d = s.planDetails || {};
      el('bl-body').innerHTML =
        '<div class="dma-grid-2">' +
        '<section class="dma-section"><header class="dma-section-h"><h2>Current plan</h2>' + A().chip(s.planStatus || s.plan) + '</header>' +
        '<div class="dma-section-b"><p class="dma-prose">' + esc(d.name || s.plan || 'Plan') + '</p>' +
        '<p class="dma-hint">Staff seats: ' + esc(d.staff) + ' · Patients: ' + esc(d.patients) + ' · AI messages: ' + esc(d.aiMessages) + '</p>' +
        (s.trialEndsAt ? '<p class="dma-hint">Trial ends ' + A().fmtDate(s.trialEndsAt) + '</p>' : '') +
        (s.currentPeriodEnd ? '<p class="dma-hint">Renews ' + A().fmtDate(s.currentPeriodEnd) + '</p>' : '') +
        '<div class="dma-btn-row"><button class="dma-btn dma-btn-primary" id="bl-up">Upgrade</button><button class="dma-btn dma-btn-ghost" id="bl-portal">Manage payment</button></div>' +
        '</div></section>' +
        '<section class="dma-section dma-section-muted"><header class="dma-section-h"><h2>WhatsApp</h2></header><div class="dma-section-b"><p class="dma-prose">Connection is included with the clinic workspace. Finish Meta Embedded Signup on the WhatsApp page.</p><a class="dma-btn dma-btn-wa" href="/dashboard/whatsapp/">Open WhatsApp</a></div></section></div>' +
        '<section class="dma-section"><header class="dma-section-h"><h2>Invoices</h2></header><div class="dma-section-b">' +
        (inv.map(function (i) {
          return '<div class="dma-row-item"><div class="name">' + esc(i.number || i.id) + '</div><div class="meta">' + esc(i.status) + ' · ' + A().fmtDate(i.created || i.date) + '</div></div>';
        }).join('') || '<p class="dma-hint">No invoices yet.</p>') +
        '</div></section>';
      el('bl-up').onclick = function () {
        A().post('/api/billing/checkout', { plan: 'PRO' }).then(function (r) {
          if (r.d && r.d.url) location.href = r.d.url;
          else A().toast(failMsg(r, "Checkout isn't available right now."), 'err');
        });
      };
      el('bl-portal').onclick = function () {
        A().post('/api/billing/portal', {}).then(function (r) {
          if (r.d && r.d.url) location.href = r.d.url;
          else A().toast(failMsg(r, "The billing portal isn't available right now."), 'err');
        });
      };
    });
  }

  /* ── SETTINGS ─────────────────────────────────────────────────────────── */
  function settings() {
    var root = page();
    var tab = A().qs('tab') || 'clinic';
    root.innerHTML =
      pageHead('Settings', 'Manage your clinic configuration.') +
      '<div class="cos-settings" id="st-wrap">' +
        '<nav class="cos-settings-nav" id="st-tabs" role="tablist" aria-label="Settings"></nav>' +
        '<div class="cos-settings-body" id="st-body"></div>' +
      '</div>';
    var tabs = [['clinic', 'Clinic'], ['hours', 'Hours'], ['treatments', 'Services'], ['booking', 'Scheduling'], ['notify', 'Notifications'], ['templates', 'Templates'], ['integrations', 'Integrations'], ['roles', 'Team & roles'], ['security', 'Security'], ['privacy', 'Privacy'], ['profile', 'Profile']];
    function draw() {
      el('st-tabs').innerHTML = tabs.map(function (t) {
        return '<button type="button" role="tab" aria-selected="' + (tab === t[0] ? 'true' : 'false') + '" data-t="' + t[0] + '" class="' + (tab === t[0] ? 'active' : '') + '">' + t[1] + '</button>';
      }).join('');
    }
    draw();
    if (global.DmaUI && DmaUI.bindTablist) DmaUI.bindTablist(el('st-tabs'));
    el('st-tabs').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      tab = b.getAttribute('data-t'); A().setQs({ tab: tab }, true); draw(); render();
    };
    function render() {
      if (!tab) { if (el('st-body')) el('st-body').innerHTML = ''; return; }
      A().get('/api/settings').catch(function () { return {}; }).then(function (s) {
        if (tab === 'clinic') {
          el('st-body').innerHTML =
            '<div class="dma-notice">Used in booking and WhatsApp greetings. <a href="/dashboard/whatsapp/">WhatsApp</a> · <a href="/dashboard/ai/">AI receptionist</a></div>' +
            '<section class="dma-section"><header class="dma-section-h"><h2>Clinic information</h2></header><div class="dma-section-b">' +
            '<div class="dma-row"><div class="dma-field"><label>Clinic name</label><input id="s-name" value="' + esc(s.name || '') + '"></div>' +
            '<div class="dma-field"><label>Specialty</label><input id="s-spec" value="' + esc(s.specialty || '') + '"></div></div>' +
            '<div class="dma-row"><div class="dma-field"><label>Phone</label><input id="s-phone" value="' + esc(s.phone || '') + '"></div>' +
            '<div class="dma-field"><label>Email</label><input id="s-email" value="' + esc(s.email || '') + '"></div></div>' +
            '<div class="dma-field"><label>Address</label><input id="s-addr" value="' + esc(s.address || '') + '"></div>' +
            '<div class="dma-field"><label>Google Place ID</label><input id="s-place" value="' + esc(s.googlePlaceId || '') + '"><p class="dma-hint">Used on the Reviews page.</p></div>' +
            '<button class="dma-btn dma-btn-primary" id="s-save">Save changes</button></div></section>';
          el('s-save').onclick = function () {
            A().patch('/api/settings/clinic', {
              name: el('s-name').value, phone: el('s-phone').value,
              email: el('s-email').value, specialty: el('s-spec').value, address: el('s-addr').value,
              googlePlaceId: el('s-place').value || undefined,
            }).then(function (r) {
              if (r.ok) A().toast('Clinic saved — AI and booking will use the new details', 'ok');
              else A().toast(failMsg(r, "Couldn't save those settings."), 'err');
            });
          };
        } else if (tab === 'hours') {
          var days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
          var wh = A().parseJson(s.workingHours, {}) || {};
          if (typeof wh !== 'object' || Array.isArray(wh)) wh = {};
          el('st-body').innerHTML = '<section class="dma-section"><header class="dma-section-h"><h2>Working hours</h2></header><div class="dma-section-b" id="hrs">' +
            days.map(function (d) {
              var row = wh[d] || { open: '09:00', close: '17:00', closed: false };
              if (typeof row === 'string') row = { open: '09:00', close: '17:00', closed: false };
              var label = d.charAt(0).toUpperCase() + d.slice(1);
              return '<div class="ds-hours-row' + (row.closed ? ' is-closed' : '') + '"><strong>' + label + '</strong>' +
                '<span class="ds-hours-state">' + (row.closed ? 'Closed' : 'Open') + '</span>' +
                '<input type="time" aria-label="' + label + ' open" data-d="' + d + '" data-k="open" value="' + esc(row.open || '09:00') + '"' + (row.closed ? ' disabled' : '') + '>' +
                '<span class="dma-hint">—</span>' +
                '<input type="time" aria-label="' + label + ' close" data-d="' + d + '" data-k="close" value="' + esc(row.close || '17:00') + '"' + (row.closed ? ' disabled' : '') + '>' +
                '<label><input type="checkbox" data-d="' + d + '" data-k="closed"' + (row.closed ? ' checked' : '') + '> Closed</label></div>';
            }).join('') + '<button class="dma-btn dma-btn-primary" id="hrs-save">Save changes</button></div></section>';
          document.querySelectorAll('#hrs input[data-k="closed"]').forEach(function (cb) {
            cb.onchange = function () {
              var row = cb.closest('.ds-hours-row');
              var on = cb.checked;
              if (row) {
                row.classList.toggle('is-closed', on);
                var state = row.querySelector('.ds-hours-state');
                if (state) state.textContent = on ? 'Closed' : 'Open';
                row.querySelectorAll('input[type="time"]').forEach(function (inp) { inp.disabled = on; });
              }
            };
          });
          el('hrs-save').onclick = function () {
            var out = {};
            days.forEach(function (d) {
              out[d] = {
                open: document.querySelector('input[data-d="' + d + '"][data-k="open"]').value,
                close: document.querySelector('input[data-d="' + d + '"][data-k="close"]').value,
                closed: document.querySelector('input[data-d="' + d + '"][data-k="closed"]').checked,
                isOpen: !document.querySelector('input[data-d="' + d + '"][data-k="closed"]').checked,
                slotDuration: 30
              };
            });
            A().patch('/api/settings/hours', { workingHours: JSON.stringify(out) }).then(function (r) {
              if (r.ok) A().toast('Hours saved — receptionist will offer these slots', 'ok');
              else A().toast(failMsg(r, "Couldn't save those settings."), 'err');
            });
          };
        } else if (tab === 'treatments') {
          var txs = A().parseJson(s.treatments, []) || [];
          if (!Array.isArray(txs)) txs = [];
          function drawTx() {
            el('st-body').innerHTML = '<section class="dma-section"><header class="dma-section-h"><h2>Services</h2><p>These appear in booking, WhatsApp and the AI receptionist.</p></header><div class="dma-section-b">' +
              '<div id="tx-list"></div><button class="dma-btn dma-btn-ghost" id="tx-add">Add service</button> ' +
              '<button class="dma-btn dma-btn-primary" id="tx-save">Save changes</button></div></section>';
            el('tx-list').innerHTML = (txs.length ? txs : [{ name: '', fee: '' }]).map(function (t, i) {
              var name = typeof t === 'string' ? t : (t.name || '');
              var fee = typeof t === 'object' ? (t.fee || t.price || '') : '';
              return '<div class="ds-tx-row"><input data-i="' + i + '" data-k="name" placeholder="Treatment name" value="' + esc(name) + '">' +
                '<input data-i="' + i + '" data-k="fee" type="number" placeholder="Fee" value="' + esc(fee) + '">' +
                '<button class="dma-btn dma-btn-danger dma-btn-sm" data-rm="' + i + '">Remove</button></div>';
            }).join('');
            el('tx-add').onclick = function () { txs.push({ name: '', fee: '' }); drawTx(); };
            el('tx-list').onclick = function (e) {
              var b = e.target.closest('[data-rm]'); if (!b) return;
              txs.splice(Number(b.getAttribute('data-rm')), 1); drawTx();
            };
            el('tx-save').onclick = function () {
              var next = [];
              el('tx-list').querySelectorAll('.ds-tx-row').forEach(function (row) {
                var name = row.querySelector('[data-k="name"]').value.trim();
                var fee = Number(row.querySelector('[data-k="fee"]').value || 0);
                if (name) next.push({ name: name, fee: fee || undefined });
              });
              A().patch('/api/settings/treatments', { treatments: JSON.stringify(next) }).then(function (r) {
                if (r.ok) { A().toast('Treatments saved — AI and booking are in sync', 'ok'); txs = next; }
                else A().toast(failMsg(r, "Couldn't save those settings."), 'err');
              });
            };
          }
          drawTx();
        } else if (tab === 'profile') {
          el('st-body').innerHTML =
            '<section class="dma-section dma-section-muted"><header class="dma-section-h"><h2>Owner profile</h2><p>Displayed in the top bar and used in clinic communications.</p></header><div class="dma-section-b">' +
            '<div class="dma-field"><label>Owner name</label><input id="s-owner" value="' + esc(s.ownerName || '') + '"></div>' +
            '<div class="dma-field"><label>Clinic email</label><input id="s-email-p" type="email" value="' + esc(s.email || '') + '"></div>' +
            '<button class="dma-btn dma-btn-primary" id="s-prof">Save profile</button></div></section>';
          el('s-prof').onclick = function () {
            A().patch('/api/settings/clinic', { ownerName: el('s-owner').value, email: el('s-email-p').value }).then(function (r) {
              if (r.ok) A().toast('Profile saved', 'ok');
              else A().toast(failMsg(r, "Couldn't save those settings."), 'err');
            });
          };
        } else if (tab === 'booking') {
          var slug = s.bookingSlug || '';
          var url = location.origin + '/patients/clinic/' + slug;
          el('st-body').innerHTML =
            '<section class="dma-section dma-section-muted"><header class="dma-section-h"><h2>Appointment settings</h2></header><div class="dma-section-b">' +
            '<div class="dma-field"><label>Booking slug</label><input id="bk-slug" value="' + esc(slug) + '"></div>' +
            '<p class="dma-hint">Public page: <a href="' + esc(url) + '" target="_blank">' + esc(url) + '</a></p>' +
            '<div class="dma-field"><label>Default visit fee</label><input id="bk-fee" type="number" value="' + esc(s.defaultFee || '') + '"></div>' +
            '<label class="dma-hint"><input type="checkbox" id="bk-auto"' + (s.autoConfirm ? ' checked' : '') + '> Auto-confirm WhatsApp bookings</label>' +
            '<button class="dma-btn dma-btn-primary" id="bk-save">Save</button></div></section>';
          el('bk-save').onclick = function () {
            Promise.all([
              A().patch('/api/settings/clinic', { bookingSlug: el('bk-slug').value, defaultFee: Number(el('bk-fee').value || 0) || undefined }),
              A().patch('/api/settings/ai', { autoConfirm: el('bk-auto').checked })
            ]).then(function () { A().toast('Appointment settings saved', 'ok'); });
          };
        } else if (tab === 'notify') {
          el('st-body').innerHTML =
            '<section class="dma-section"><header class="dma-section-h"><h2>Reminders</h2></header><div class="dma-section-b">' +
            '<div class="dma-field"><label>WhatsApp reminder timing</label><select id="n-time"><option value="24h">24 hours before</option><option value="2h">2 hours before</option><option value="both">Both</option></select></div>' +
            '<button class="dma-btn dma-btn-primary" id="n-save">Save</button></div></section>';
          el('n-time').value = s.reminderTiming || 'both';
          el('n-save').onclick = function () {
            A().patch('/api/settings/ai', { reminderTiming: el('n-time').value }).then(function (r) {
              if (r.ok) A().toast('Reminder timing saved', 'ok'); else A().toast(failMsg(r, "Couldn't save those settings."), 'err');
            });
          };
        } else if (tab === 'templates') {
          el('st-body').innerHTML =
            '<section class="dma-section"><header class="dma-section-h"><h2>Intro template</h2></header><div class="dma-section-b">' +
            '<div class="dma-field"><label>Custom WhatsApp intro</label><textarea id="t-intro" rows="4">' + esc(s.customIntroMsg || '') + '</textarea></div>' +
            '<button class="dma-btn dma-btn-primary" id="t-save">Save template</button></div></section>';
          el('t-save').onclick = function () {
            A().patch('/api/settings/ai', { customIntroMsg: el('t-intro').value }).then(function (r) {
              if (r.ok) A().toast('Template saved', 'ok'); else A().toast(failMsg(r, "Couldn't save those settings."), 'err');
            });
          };
        } else if (tab === 'integrations') {
          el('st-body').innerHTML =
            '<div class="dma-grid-2">' +
            '<section class="dma-section"><header class="dma-section-h"><h2>WhatsApp</h2></header><div class="dma-section-b"><p class="dma-prose">Connect your clinic WhatsApp so patients can message you.</p><a class="dma-btn dma-btn-primary" href="/dashboard/whatsapp/">Open WhatsApp</a></div></section>' +
            '<section class="dma-section"><header class="dma-section-h"><h2>AI receptionist</h2></header><div class="dma-section-b"><p class="dma-prose">Configure how your receptionist communicates with patients.</p><a class="dma-btn dma-btn-primary" href="/dashboard/ai/">Open AI receptionist</a></div></section>' +
            '<section class="dma-section"><header class="dma-section-h"><h2>Billing</h2></header><div class="dma-section-b"><p class="dma-prose">Manage your Clinicos subscription.</p><a class="dma-btn dma-btn-primary" href="/dashboard/billing/">Open billing</a></div></section>' +
            '</div>';
        } else if (tab === 'roles') {
          el('st-body').innerHTML =
            '<section class="dma-section"><header class="dma-section-h"><h2>Roles</h2></header><div class="dma-section-b"><p class="dma-prose">Staff roles: Receptionist, Nurse, Assistant and Manager. Staff cannot change billing, AI or clinic settings.</p><a class="dma-btn dma-btn-primary" href="/dashboard/staff/">Open staff directory</a></div></section>';
        } else if (tab === 'security' || tab === 'privacy') {
          el('st-body').innerHTML =
            '<section class="dma-section"><header class="dma-section-h"><h2>' + (tab === 'security' ? 'Security' : 'Data & privacy') + '</h2></header><div class="dma-section-b">' +
            '<p class="dma-prose">Passwords are hashed and sessions use clinic sign-in. Patient charts can be deactivated by the owner.</p>' +
            '<a class="dma-btn dma-btn-ghost" href="/dashboard/patients/">Patient records</a></div></section>';
        } else {
          var slug2 = s.bookingSlug || '';
          var url2 = location.origin + '/patients/clinic/' + slug2;
          el('st-body').innerHTML =
            '<section class="dma-section dma-section-muted"><header class="dma-section-h"><h2>Public booking</h2></header><div class="dma-section-b">' +
            '<div class="dma-field"><label>Booking slug</label><input id="bk-slug" value="' + esc(slug2) + '"></div>' +
            '<p class="dma-hint">Public page: <a href="' + esc(url2) + '" target="_blank">' + esc(url2) + '</a></p>' +
            '<div class="dma-field"><label>Default fee</label><input id="bk-fee" type="number" value="' + esc(s.defaultFee || '') + '"></div>' +
            '<button class="dma-btn dma-btn-primary" id="bk-save">Save booking</button></div></section>';
          el('bk-save').onclick = function () {
            A().patch('/api/settings/clinic', { bookingSlug: el('bk-slug').value, defaultFee: Number(el('bk-fee').value || 0) || undefined }).then(function (r) {
              if (r.ok) A().toast('Booking page updated', 'ok');
              else A().toast(failMsg(r, "Couldn't save those settings."), 'err');
            });
          };
        }
      });
    }
    render();
  }

  /* ── NOTIFICATIONS ────────────────────────────────────────────────────── */
  function notifications() {
    var root = page();
    root.innerHTML =
      pageHead('Updates', 'Bookings, WhatsApp escalations, and system notices.',
        '<button class="dma-btn dma-btn-ghost" id="n-read">Mark all read</button>', 'Inbox') +
      '<section class="dma-section"><div class="dma-section-b" id="n-list">' + A().spinner() + '</div></section>';
    function load() {
      A().get('/api/notifications').then(function (rows) {
        var list = Array.isArray(rows) ? rows : [];
        el('n-list').innerHTML = list.length ? list.map(function (n) {
          var cat = /whatsapp|message|inbox/i.test(n.type || n.title || '') ? 'Messages'
            : /lead/i.test(n.type || n.title || '') ? 'Patients'
            : /appoint/i.test(n.type || n.title || '') ? 'Appointments'
            : /clinical|vital|prescription|lab/i.test(n.type || n.title || '') ? 'Clinical'
            : /ai|train/i.test(n.type || n.title || '') ? 'AI'
            : /security|login/i.test(n.type || n.title || '') ? 'Security'
            : 'System';
          var href = cat === 'Messages' ? '/dashboard/messages/'
            : /lead/i.test(n.type || n.title || '') ? '/dashboard/leads/'
            : cat === 'Appointments' ? '/dashboard/appointments/'
            : cat === 'Clinical' ? '/dashboard/clinical/'
            : '/dashboard/';
          return '<a class="dma-row-item' + (n.isRead ? '' : ' unread') + '" href="' + href + '"><div><div class="name">' + esc(n.title || 'Update') + '</div><div class="sub">' + esc(cat) + ' · ' + esc(n.body || '') + '</div></div><div class="meta">' + A().ago(n.createdAt) + (n.isRead ? '' : ' · new') + '</div></a>';
        }).join('') : A().empty('No updates', 'New bookings and WhatsApp alerts will land here.');
      });
    }
    load();
    el('n-read').onclick = function () {
      A().patch('/api/notifications/read-all', {}).then(function () {
        A().toast('Marked read', 'ok');
        if (DmaDoctorShell.refreshBadges) DmaDoctorShell.refreshBadges();
        load();
      });
    };
  }

  function mount() {
    if (!A() || !A().requireAuth()) return;
    var root = page();
    if (!root) return;
    var id = root.getAttribute('data-page');
    if (global.DmaInner && typeof DmaInner.mountPage === 'function' && DmaInner.mountPage(id)) return;
    var run = {
      home: home, appointments: appointments, patients: patients, patient: patientDetail,
      messages: messages, ai: ai, analytics: analytics, reviews: reviews,
      staff: staff, billing: billing, settings: settings, updates: notifications, notifications: notifications,
    }[id];
    if (run) run();
  }

  global.DmaPages = {
    mount: mount,
    home: home,
    appointments: appointments,
    patients: patients,
    patientDetail: patientDetail,
    messages: messages,
    ai: ai,
    analytics: analytics,
    reviews: reviews,
    staff: staff,
    billing: billing,
    settings: settings,
    notifications: notifications,
    openPatientDrawer: openPatientDrawer,
  };
})(window);
