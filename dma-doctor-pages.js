/**
 * Doctors My Agency — connected clinic pages.
 * Each screen reads/writes the same APIs and deep-links the others.
 */
(function (global) {
  var A = function () { return global.DmaApp; };

  function el(id) { return document.getElementById(id); }
  function page() { return el('doc-page'); }
  function esc(s) { return A().esc(s); }

  function greeting() {
    var h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function firstName() {
    var u = A().user();
    var n = (u.ownerName || u.name || 'Doctor').trim().split(/\s+/)[0];
    return n;
  }

  function statusSelect(current, onchangeAttr) {
    var opts = ['PENDING', 'CONFIRMED', 'ARRIVED', 'COMPLETED', 'NO_SHOW', 'CANCELLED'];
    return '<select class="dma-status-sel" ' + (onchangeAttr || '') + '>' +
      opts.map(function (s) {
        return '<option value="' + s + '"' + (s === current ? ' selected' : '') + '>' + s.replace('_', ' ') + '</option>';
      }).join('') + '</select>';
  }

  /* ── HOME ─────────────────────────────────────────────────────────────── */
  function home() {
    var root = page();
    var u = A().user();
    root.innerHTML =
      '<div class="dma-head"><div><h1>' + greeting() + ', ' + esc(firstName()) + '</h1>' +
      '<p>Your clinic today — appointments, leads, and WhatsApp in one place.</p></div>' +
      '<div class="dma-head-actions">' +
        '<a class="dma-btn dma-btn-ghost" href="/dashboard/whatsapp/">WhatsApp</a>' +
        '<a class="dma-btn dma-btn-primary" href="/dashboard/appointments/?action=book">New appointment</a>' +
      '</div></div>' +
      '<div id="home-wa"></div>' +
      '<div class="dma-kpis" id="home-kpis">' + A().spinner() + '</div>' +
      '<div class="dma-grid-2">' +
        '<section class="dma-panel"><div class="dma-panel-h"><h2>Today’s appointments</h2><a href="/dashboard/appointments/?filter=today">View all</a></div><div class="dma-panel-b" id="home-appts"></div></section>' +
        '<div class="dma-stack">' +
          '<section class="dma-panel"><div class="dma-panel-h"><h2>Hot leads</h2><a href="/dashboard/leads/">Pipeline</a></div><div class="dma-panel-b" id="home-leads"></div></section>' +
          '<section class="dma-panel"><div class="dma-panel-h"><h2>Updates</h2><a href="/dashboard/notifications/">Inbox</a></div><div class="dma-panel-b" id="home-notes"></div></section>' +
        '</div>' +
      '</div>' +
      '<section class="dma-panel" style="margin-top:16px"><div class="dma-panel-h"><h2>Quick actions</h2></div>' +
        '<div class="dma-panel-b" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">' +
          '<a class="dma-btn dma-btn-ghost" href="/dashboard/patients/?action=new">Add patient</a>' +
          '<a class="dma-btn dma-btn-ghost" href="/dashboard/messages/">Open inbox</a>' +
          '<a class="dma-btn dma-btn-ghost" href="/dashboard/broadcasts/">Send broadcast</a>' +
          '<a class="dma-btn dma-btn-ghost" href="/dashboard/ai/?tab=test">Test AI receptionist</a>' +
          '<a class="dma-btn dma-btn-ghost" href="/dashboard/settings/?tab=treatments">Edit treatments</a>' +
          '<a class="dma-btn dma-btn-ghost" href="/dashboard/reviews/">Request reviews</a>' +
        '</div></section>';

    Promise.all([
      A().get('/api/analytics/overview').catch(function () { return {}; }),
      A().get('/api/appointments?filter=today&limit=8').catch(function () { return { data: [] }; }),
      A().get('/api/leads?limit=20').catch(function () { return { leads: [] }; }),
      A().get('/api/notifications').catch(function () { return []; }),
      A().waStatus().catch(function () { return {}; }),
      A().get('/api/messages/stats').catch(function () { return {}; }),
    ]).then(function (parts) {
      var ov = parts[0] || {};
      var appts = parts[1].data || parts[1].appointments || [];
      var leads = (parts[2].leads || []).filter(function (l) { return (l.leadScore || '').toUpperCase() === 'HOT'; }).slice(0, 5);
      var notes = Array.isArray(parts[3]) ? parts[3].slice(0, 5) : (parts[3].notifications || []).slice(0, 5);
      var wa = parts[4] || {};
      var ms = parts[5] || {};
      var connected = !!(wa.connected || wa.status === 'connected' || wa.status === 'CONNECTED');

      el('home-wa').innerHTML = connected
        ? '<div class="dma-banner ok">WhatsApp is connected' + (wa.phoneNumber ? ' · ' + esc(wa.phoneNumber) : '') + '. <a href="/dashboard/messages/">Open inbox</a> · <a href="/dashboard/ai/">Train AI</a></div>'
        : '<div class="dma-banner warn">WhatsApp is not connected. Patients cannot message your clinic until you finish Meta Embedded Signup. <a href="/dashboard/whatsapp/">Connect WhatsApp</a></div>';

      var kpis = [
        { label: 'Appointments', val: (ov.appointments && ov.appointments.value) != null ? ov.appointments.value : appts.length, sub: 'this month', bg: '#DBEAFE', c: '#2563EB', icon: ICONS.cal },
        { label: 'Patients', val: ov.totalPatients != null ? ov.totalPatients : '—', sub: 'active', bg: '#EDE9FE', c: '#7C3AED', icon: ICONS.users },
        { label: 'Needs reply', val: ms.needsManualReply != null ? ms.needsManualReply : '—', sub: 'inbox', bg: '#FFEDD5', c: '#EA580C', icon: ICONS.msg },
        { label: 'Revenue', val: ov.revenue ? A().money(ov.revenue.value) : '—', sub: 'this month', bg: '#DCFCE7', c: '#16A34A', icon: ICONS.bill },
      ];
      el('home-kpis').innerHTML = kpis.map(function (k) {
        return '<div class="dma-kpi"><div class="dma-kpi-icon" style="background:' + k.bg + ';color:' + k.c + '">' + k.icon + '</div><div><label>' + k.label + '</label><strong>' + esc(k.val) + '</strong><span class="sub">' + k.sub + '</span></div></div>';
      }).join('');

      el('home-appts').innerHTML = appts.length
        ? appts.map(function (a) {
            var p = a.patient || {};
            return '<a class="dma-row-item" href="/dashboard/patients/detail/?id=' + esc(a.patientId || p.id) + '">' +
              '<div class="dma-avatar">' + A().initials(p.fullName) + '</div>' +
              '<div><div class="name">' + esc(p.fullName || 'Patient') + '</div><div class="sub">' + esc(a.treatment || 'Visit') + ' · ' + A().chip(a.status) + '</div></div>' +
              '<div class="meta">' + A().fmtTime(a.dateTime) + '</div></a>';
          }).join('')
        : A().empty('No appointments today', 'Book a visit or wait for WhatsApp bookings.', '/dashboard/appointments/?action=book', 'Book now');

      el('home-leads').innerHTML = leads.length
        ? leads.map(function (l) {
            return '<a class="dma-row-item" href="/dashboard/leads/?id=' + esc(l.id) + '">' +
              '<div class="dma-avatar">' + A().initials(l.fullName || l.phone) + '</div>' +
              '<div><div class="name">' + esc(l.fullName || l.phone || 'Lead') + '</div><div class="sub">' + esc(l.treatmentInterest || 'General') + '</div></div>' +
              '<div class="meta">' + A().chip(l.leadScore || 'HOT') + '</div></a>';
          }).join('')
        : '<p class="dma-hint">No hot leads yet. They appear when WhatsApp conversations show booking intent.</p>';

      el('home-notes').innerHTML = notes.length
        ? notes.map(function (n) {
            return '<a class="dma-row-item" href="/dashboard/notifications/"><div><div class="name">' + esc(n.title || 'Update') + '</div><div class="sub">' + esc(n.body || '') + '</div></div><div class="meta">' + A().ago(n.createdAt) + '</div></a>';
          }).join('')
        : '<p class="dma-hint">You’re all caught up.</p>';
    });
  }

  var ICONS = {
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
    msg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    bill: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/></svg>',
  };

  /* ── APPOINTMENTS ─────────────────────────────────────────────────────── */
  function appointments() {
    var root = page();
    root.innerHTML =
      '<div class="dma-head"><div><h1>Appointments</h1><p>Schedule, confirm, and follow up from WhatsApp or the front desk.</p></div>' +
      '<div class="dma-head-actions"><button class="dma-btn dma-btn-primary" id="btn-book">New appointment</button></div></div>' +
      '<div class="dma-filters" id="appt-filters"></div>' +
      '<section class="dma-panel"><div class="dma-panel-b" id="appt-list">' + A().spinner() + '</div></section>';

    var filter = A().qs('filter', 'today');
    var filters = [['today', 'Today'], ['tomorrow', 'Tomorrow'], ['week', 'This week'], ['month', 'This month'], ['', 'All']];
    el('appt-filters').innerHTML = filters.map(function (f) {
      return '<button data-f="' + f[0] + '" class="' + (filter === f[0] ? 'on' : '') + '">' + f[1] + '</button>';
    }).join('');
    el('appt-filters').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      filter = b.getAttribute('data-f');
      A().setQs({ filter: filter, action: null }, true);
      [].forEach.call(el('appt-filters').querySelectorAll('button'), function (x) { x.classList.toggle('on', x === b); });
      load();
    };
    el('btn-book').onclick = function () { openBookModal(A().qs('patient')); };

    function load() {
      var q = '/api/appointments?limit=50' + (filter ? '&filter=' + encodeURIComponent(filter) : '');
      A().get(q).then(function (d) {
        var rows = d.data || [];
        if (!rows.length) {
          el('appt-list').innerHTML = A().empty('No appointments', 'Book the first visit or wait for the AI receptionist.', '#', 'Book appointment');
          var cta = el('appt-list').querySelector('a');
          if (cta) cta.onclick = function (ev) { ev.preventDefault(); openBookModal(); };
          return;
        }
        el('appt-list').innerHTML = rows.map(function (a) {
          var p = a.patient || {};
          var pid = a.patientId || p.id || '';
          return '<div class="dma-appt">' +
            '<div class="dma-appt-time">' + A().fmtTime(a.dateTime) + '<div class="dma-hint">' + A().fmtDate(a.dateTime) + '</div></div>' +
            '<div style="flex:1;min-width:0">' +
              '<div style="font-weight:800">' + esc(p.fullName || 'Patient') + ' ' + A().chip(a.status) + '</div>' +
              '<div class="dma-hint">' + esc(a.treatment || 'Visit') + (a.durationMin ? ' · ' + a.durationMin + ' min' : '') + (p.phone ? ' · ' + esc(p.phone) : '') + '</div>' +
            '</div>' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
              '<a class="dma-btn dma-btn-ghost dma-btn-sm" href="/dashboard/patients/detail/?id=' + esc(pid) + '">Chart</a>' +
              '<a class="dma-btn dma-btn-ghost dma-btn-sm" href="/dashboard/messages/?patient=' + esc(pid) + '">Message</a>' +
              '<select data-id="' + esc(a.id) + '" class="dma-btn dma-btn-ghost dma-btn-sm">' +
                ['PENDING','CONFIRMED','ARRIVED','COMPLETED','NO_SHOW','CANCELLED'].map(function (s) {
                  return '<option' + (a.status === s ? ' selected' : '') + '>' + s + '</option>';
                }).join('') +
              '</select>' +
            '</div></div>';
        }).join('');
        el('appt-list').querySelectorAll('select[data-id]').forEach(function (sel) {
          sel.onchange = function () {
            A().patch('/api/appointments/' + sel.getAttribute('data-id'), { status: sel.value }).then(function (r) {
              if (r.ok) A().toast('Appointment updated', 'ok');
              else A().toast((r.d && r.d.error) || 'Update failed', 'err');
              load();
            });
          };
        });
      }).catch(function () {
        el('appt-list').innerHTML = A().empty('Could not load appointments', 'Check your connection and try again.');
      });
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
            if (!r.ok) { A().toast((r.d && r.d.error) || 'Could not book', 'err'); return; }
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
        if (!r.ok) { A().toast((r.d && r.d.error) || 'Could not save', 'err'); return; }
        A().closeModal();
        A().toast('Patient added', 'ok');
        if (onSaved) onSaved(r.d);
      });
    };
  }

  /* ── PATIENTS ─────────────────────────────────────────────────────────── */
  function patients() {
    var root = page();
    root.innerHTML =
      '<div class="dma-head"><div><h1>Patients</h1><p>Charts, WhatsApp threads, and appointments for every patient.</p></div>' +
      '<div class="dma-head-actions"><input class="dma-search" id="pt-search" placeholder="Search name or phone"><button class="dma-btn dma-btn-primary" id="pt-add">Add patient</button></div></div>' +
      '<section class="dma-panel"><div class="dma-table-wrap"><table class="dma-table"><thead><tr><th>Patient</th><th>Phone</th><th>Visits</th><th>Last visit</th><th></th></tr></thead><tbody id="pt-body"><tr><td colspan="5">' + A().spinner() + '</td></tr></tbody></table></div></section>';

    function load(q) {
      A().get('/api/patients?limit=50' + (q ? '&search=' + encodeURIComponent(q) : '')).then(function (d) {
        var rows = d.data || [];
        if (!rows.length) {
          el('pt-body').innerHTML = '<tr><td colspan="5">' + A().empty('No patients yet', 'Add a chart, or they will appear from WhatsApp leads.', '#', 'Add patient') + '</td></tr>';
          return;
        }
        el('pt-body').innerHTML = rows.map(function (p) {
          var last = (p.appointments && p.appointments[0]) || {};
          return '<tr>' +
            '<td><a href="/dashboard/patients/detail/?id=' + esc(p.id) + '"><strong>' + esc(p.fullName) + '</strong></a></td>' +
            '<td>' + esc(p.phone) + '</td>' +
            '<td>' + esc((p._count && p._count.appointments) || 0) + '</td>' +
            '<td>' + (last.dateTime ? A().fmtDate(last.dateTime) + ' ' + A().chip(last.status) : '—') + '</td>' +
            '<td style="white-space:nowrap">' +
              '<a class="dma-btn dma-btn-ghost dma-btn-sm" href="/dashboard/messages/?patient=' + esc(p.id) + '">Message</a> ' +
              '<a class="dma-btn dma-btn-ghost dma-btn-sm" href="/dashboard/appointments/?action=book&patient=' + esc(p.id) + '">Book</a>' +
            '</td></tr>';
        }).join('');
      });
    }
    var t;
    el('pt-search').oninput = function () {
      clearTimeout(t);
      var v = el('pt-search').value;
      t = setTimeout(function () { load(v); }, 250);
    };
    el('pt-add').onclick = function () {
      openPatientModal(function (p) { A().patient(p.id); });
    };
    load();
    if (A().qs('action') === 'new') openPatientModal(function (p) { A().patient(p.id); });
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
      root.innerHTML =
        '<div class="dma-head"><div><a href="/dashboard/patients/" class="dma-hint">← Patients</a>' +
        '<h1>' + esc(p.fullName) + '</h1><p>' + esc(p.phone || '') + (p.email ? ' · ' + esc(p.email) : '') + '</p></div>' +
        '<div class="dma-head-actions">' +
          '<a class="dma-btn dma-btn-ghost" href="/dashboard/messages/?patient=' + esc(p.id) + '">WhatsApp thread</a>' +
          '<a class="dma-btn dma-btn-primary" href="/dashboard/appointments/?action=book&patient=' + esc(p.id) + '">Book visit</a>' +
        '</div></div>' +
        '<div class="dma-grid-2">' +
          '<section class="dma-panel"><div class="dma-panel-h"><h2>Chart</h2></div><div class="dma-panel-b">' +
            [['Phone', p.phone], ['Email', p.email], ['Gender', p.gender], ['Blood group', p.bloodGroup], ['Allergies', p.allergies], ['Notes', p.medicalNotes]].map(function (row) {
              return '<div class="dma-field"><label>' + row[0] + '</label><div>' + esc(row[1] || '—') + '</div></div>';
            }).join('') +
          '</div></section>' +
          '<div class="dma-stack">' +
            '<section class="dma-panel"><div class="dma-panel-h"><h2>Appointments</h2><a href="/dashboard/appointments/?patient=' + esc(p.id) + '">All</a></div><div class="dma-panel-b">' +
              (appts.slice(0, 8).map(function (a) {
                return '<div class="dma-row-item"><div><div class="name">' + esc(a.treatment || 'Visit') + '</div><div class="sub">' + A().fmtDate(a.dateTime) + ' ' + A().fmtTime(a.dateTime) + '</div></div>' + A().chip(a.status) + '</div>';
              }).join('') || '<p class="dma-hint">No visits yet.</p>') +
            '</div></section>' +
            '<section class="dma-panel"><div class="dma-panel-h"><h2>Recent messages</h2><a href="/dashboard/messages/?patient=' + esc(p.id) + '">Open</a></div><div class="dma-panel-b">' +
              (msgs.slice(0, 6).map(function (m) {
                return '<div class="dma-hint" style="margin-bottom:8px"><strong>' + (m.direction === 'INBOUND' ? 'Patient' : 'Clinic') + ':</strong> ' + esc((m.body || '').slice(0, 140)) + '</div>';
              }).join('') || '<p class="dma-hint">No messages yet. Connect WhatsApp to start.</p>') +
            '</div></section>' +
          '</div></div>';
    }).catch(function () {
      root.innerHTML = A().empty('Patient not found', 'They may have been removed.', '/dashboard/patients/', 'Back to patients');
    });
  }

  /* ── MESSAGES ─────────────────────────────────────────────────────────── */
  function messages() {
    var root = page();
    root.innerHTML =
      '<div class="dma-head"><div><h1>Messages</h1><p>WhatsApp inbox — reply, escalate, or jump to the patient chart.</p></div>' +
      '<div class="dma-head-actions"><a class="dma-btn dma-btn-ghost" href="/dashboard/whatsapp/">Connection</a><a class="dma-btn dma-btn-primary" href="/dashboard/broadcasts/">Broadcast</a></div></div>' +
      '<div id="msg-wa"></div>' +
      '<div class="dma-inbox"><div class="dma-inbox-list" id="msg-list">' + A().spinner() + '</div><div class="dma-thread" id="msg-thread"></div></div>';

    A().waStatus().then(function (wa) {
      var on = !!(wa.connected || wa.status === 'connected' || wa.status === 'CONNECTED');
      el('msg-wa').innerHTML = on ? '' : '<div class="dma-banner warn">Inbox is empty until WhatsApp is connected. <a href="/dashboard/whatsapp/">Connect with Meta</a></div>';
    });

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
          return '<div class="dma-inbox-item' + (pid === selected ? ' on' : '') + '" data-id="' + esc(pid) + '">' +
            '<div class="name">' + esc((t.patient && t.patient.fullName) || 'Patient') + (t.unread ? ' <span class="dma-chip dma-chip-blue">' + t.unread + '</span>' : '') + '</div>' +
            '<div class="sub">' + esc((t.last.body || '').slice(0, 70)) + '</div>' +
            '<div class="dma-hint">' + A().ago(t.last.createdAt) + '</div></div>';
        }).join('');
        el('msg-list').querySelectorAll('.dma-inbox-item').forEach(function (n) {
          n.onclick = function () { selected = n.getAttribute('data-id'); A().setQs({ patient: selected }, true); renderList(); openThread(); };
        });
      }
      function openThread() {
        var t = threads[selected] || {};
        var p = t.patient || {};
        el('msg-thread').innerHTML =
          '<div class="dma-thread-h">' +
            '<div class="dma-avatar">' + A().initials(p.fullName) + '</div>' +
            '<div style="flex:1"><div class="name" style="font-weight:800">' + esc(p.fullName || 'Patient') + '</div><div class="dma-hint">' + esc(p.phone || '') + '</div></div>' +
            '<a class="dma-btn dma-btn-ghost dma-btn-sm" href="/dashboard/patients/detail/?id=' + esc(selected) + '">Chart</a>' +
            '<a class="dma-btn dma-btn-ghost dma-btn-sm" href="/dashboard/appointments/?action=book&patient=' + esc(selected) + '">Book</a>' +
          '</div>' +
          '<div class="dma-thread-m" id="msg-bubbles">' + A().spinner() + '</div>' +
          '<form class="dma-thread-c" id="msg-form"><input id="msg-input" placeholder="Reply on WhatsApp…" style="flex:1;height:40px;border:1.5px solid #E2E8F0;border-radius:8px;padding:0 12px"><button class="dma-btn dma-btn-primary" type="submit">Send</button></form>';
        A().get('/api/messages/threads/' + selected).then(function (thread) {
          var items = Array.isArray(thread) ? thread : (thread.messages || thread.data || []);
          el('msg-bubbles').innerHTML = items.length
            ? items.map(function (m) {
                return '<div class="dma-bubble ' + (m.direction === 'OUTBOUND' ? 'out' : 'in') + '">' + esc(m.body || '') +
                  '<div class="dma-hint">' + A().ago(m.createdAt) + (m.isHandledByAI ? ' · AI' : '') + '</div></div>';
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
            if (!r.ok) { A().toast((r.d && r.d.error) || 'Send failed — is WhatsApp connected?', 'err'); return; }
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
    var tab = A().qs('tab', 'personality');
    root.innerHTML =
      '<div class="dma-head"><div><h1>Train AI receptionist</h1><p>Same training architecture as a dedicated assistant — for this clinic only. No shop or catalog.</p></div>' +
      '<div class="dma-head-actions"><a class="dma-btn dma-btn-ghost" href="/dashboard/whatsapp/">WhatsApp</a><a class="dma-btn dma-btn-primary" href="/dashboard/ai/?tab=test">Test chat</a></div></div>' +
      '<div class="dma-tabs" id="ai-tabs"></div><div id="ai-body">' + A().spinner() + '</div>';

    var tabs = [['personality', 'Personality'], ['knowledge', 'Clinic knowledge'], ['test', 'Test & publish'], ['logs', 'Activity']];
    function drawTabs() {
      el('ai-tabs').innerHTML = tabs.map(function (t) {
        return '<button data-t="' + t[0] + '" class="' + (tab === t[0] ? 'active' : '') + '">' + t[1] + '</button>';
      }).join('');
    }
    drawTabs();
    el('ai-tabs').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      tab = b.getAttribute('data-t');
      A().setQs({ tab: tab }, true);
      drawTabs();
      renderTab();
    };

    function renderTab() {
      if (tab === 'personality') {
        Promise.all([A().get('/api/ai/config'), A().get('/api/ai/stats')]).then(function (parts) {
          var c = parts[0] || {};
          var s = parts[1] || {};
          el('ai-body').innerHTML =
            '<div class="dma-kpis">' +
              kpi('Calls handled', s.callsHandled, '#EDE9FE', '#7C3AED') +
              kpi('Booked by AI', s.appointmentsBooked, '#DCFCE7', '#16A34A') +
              kpi('Avg response', (s.avgResponseTimeMs || 0) + ' ms', '#DBEAFE', '#2563EB') +
            '</div>' +
            '<section class="dma-panel"><div class="dma-panel-h"><h2>Receptionist behaviour</h2>' +
              '<label class="dma-switch"><input type="checkbox" id="ai-on"' + (c.aiEnabled ? ' checked' : '') + '><span></span></label></div>' +
            '<div class="dma-panel-b">' +
              '<div class="dma-row"><div class="dma-field"><label>Language</label><select id="ai-lang"><option value="english">English</option><option value="urdu">Urdu</option><option value="arabic">Arabic</option><option value="hindi">Hindi</option></select></div>' +
              '<div class="dma-field"><label>Personality</label><select id="ai-per"><option value="professional">Professional</option><option value="friendly">Friendly</option><option value="formal">Formal</option></select></div></div>' +
              '<div class="dma-field"><label>Intro message</label><textarea id="ai-intro" rows="4" placeholder="Hello, thanks for contacting our clinic…"></textarea></div>' +
              '<div class="dma-row"><div class="dma-field"><label>Auto-confirm bookings</label><select id="ai-auto"><option value="true">Yes</option><option value="false">No — doctor confirms</option></select></div>' +
              '<div class="dma-field"><label>Reminder timing</label><select id="ai-rem"><option value="24h">24 hours before</option><option value="2h">2 hours before</option><option value="both">Both</option></select></div></div>' +
              '<button class="dma-btn dma-btn-primary" id="ai-save">Save training</button>' +
              '<p class="dma-hint" style="margin-top:10px">Treatments and working hours live in <a href="/dashboard/settings/?tab=treatments">Settings</a> — the receptionist reads them automatically.</p>' +
            '</div></section>';
          el('ai-lang').value = c.aiLanguage || 'english';
          el('ai-per').value = c.aiPersonality || 'professional';
          el('ai-intro').value = c.customIntroMsg || '';
          el('ai-auto').value = String(c.autoConfirm !== false);
          el('ai-rem').value = c.reminderTiming || 'both';
          el('ai-on').onchange = saveAi;
          el('ai-save').onclick = saveAi;
          function saveAi() {
            A().patch('/api/ai/config', {
              aiEnabled: el('ai-on').checked,
              aiLanguage: el('ai-lang').value,
              aiPersonality: el('ai-per').value,
              customIntroMsg: el('ai-intro').value,
              autoConfirm: el('ai-auto').value === 'true',
              reminderTiming: el('ai-rem').value || 'both',
            }).then(function (r) {
              if (r.ok) A().toast('AI training saved', 'ok');
              else A().toast((r.d && r.d.error) || 'Save failed', 'err');
            });
          }
        });
      } else if (tab === 'knowledge') {
        A().get('/api/settings').then(function (s) {
          var txs = A().parseJson(s.treatments, []) || [];
          if (!Array.isArray(txs)) txs = [];
          el('ai-body').innerHTML =
            '<div class="dma-banner">The receptionist answers from clinic profile, hours, and treatments — not a generic shop catalog.</div>' +
            '<div class="dma-grid-2">' +
              '<section class="dma-panel"><div class="dma-panel-h"><h2>Treatments the AI can book</h2><a href="/dashboard/settings/?tab=treatments">Edit</a></div><div class="dma-panel-b">' +
                (txs.map(function (t) {
                  var name = typeof t === 'string' ? t : (t.name || '');
                  var fee = typeof t === 'object' ? t.fee || t.price : '';
                  return '<div class="dma-row-item"><div class="name">' + esc(name) + '</div><div class="meta">' + (fee ? A().money(fee) : '') + '</div></div>';
                }).join('') || A().empty('No treatments', 'Add them so WhatsApp booking knows what you offer.', '/dashboard/settings/?tab=treatments', 'Add treatments')) +
              '</div></section>' +
              '<section class="dma-panel"><div class="dma-panel-h"><h2>Hours & profile</h2><a href="/dashboard/settings/?tab=hours">Edit hours</a></div><div class="dma-panel-b">' +
                '<p><strong>' + esc(s.name || 'Clinic') + '</strong></p><p class="dma-hint">' + esc(s.phone || '') + '<br>' + esc(s.address || '') + '</p>' +
                '<a class="dma-btn dma-btn-ghost" href="/dashboard/settings/">Open settings</a>' +
              '</div></section></div>';
        });
      } else if (tab === 'test') {
        el('ai-body').innerHTML =
          '<section class="dma-panel"><div class="dma-panel-h"><h2>Test the receptionist</h2></div><div class="dma-panel-b">' +
            '<div id="ai-chat" class="dma-thread-m" style="min-height:280px;border:1px solid #E2E8F0;border-radius:10px;margin-bottom:10px"></div>' +
            '<form id="ai-form" style="display:flex;gap:8px"><input id="ai-q" placeholder="e.g. I need a cleaning tomorrow at 4" style="flex:1;height:40px;border:1.5px solid #E2E8F0;border-radius:8px;padding:0 12px"><button class="dma-btn dma-btn-primary">Send</button></form>' +
            '<p class="dma-hint" style="margin-top:10px">This does not send WhatsApp. Publish by keeping AI enabled and <a href="/dashboard/whatsapp/">WhatsApp connected</a>.</p>' +
          '</div></section>';
        var log = el('ai-chat');
        function add(who, text) {
          log.innerHTML += '<div class="dma-bubble ' + (who === 'you' ? 'out' : 'in') + '">' + esc(text) + '</div>';
          log.scrollTop = log.scrollHeight;
        }
        add('ai', 'Hello — I am the clinic receptionist. Ask me about hours, treatments, or booking.');
        el('ai-form').onsubmit = function (e) {
          e.preventDefault();
          var q = el('ai-q').value.trim();
          if (!q) return;
          el('ai-q').value = '';
          add('you', q);
          A().post('/api/ai/test-chat', { message: q }).then(function (r) {
            var d = r.d || {};
            add('ai', d.reply || d.message || d.response || (r.ok ? 'No reply returned.' : (d.error || 'AI test failed')));
          });
        };
      } else {
        A().get('/api/ai/logs?limit=40').then(function (logs) {
          var rows = Array.isArray(logs) ? logs : (logs.data || []);
          el('ai-body').innerHTML = '<section class="dma-panel"><div class="dma-table-wrap"><table class="dma-table"><thead><tr><th>When</th><th>Action</th><th>Detail</th></tr></thead><tbody>' +
            (rows.map(function (l) {
              return '<tr><td>' + A().ago(l.createdAt) + '</td><td>' + A().chip(l.action || 'event') + '</td><td>' + esc((l.summary || l.input || l.output || '').toString().slice(0, 140)) + '</td></tr>';
            }).join('') || '<tr><td colspan="3">' + A().empty('No AI activity yet', 'Connect WhatsApp and send a test message.') + '</td></tr>') +
            '</tbody></table></div></section>';
        });
      }
    }
    function kpi(label, val, bg, c) {
      return '<div class="dma-kpi"><div class="dma-kpi-icon" style="background:' + bg + ';color:' + c + '"></div><div><label>' + label + '</label><strong>' + esc(val != null ? val : '—') + '</strong></div></div>';
    }
    renderTab();
  }

  /* ── ANALYTICS ────────────────────────────────────────────────────────── */
  function analytics() {
    var root = page();
    root.innerHTML =
      '<div class="dma-head"><div><h1>Analytics</h1><p>Appointments, revenue, and WhatsApp volume for this clinic.</p></div>' +
      '<a class="dma-btn dma-btn-ghost" href="/dashboard/leads/">Lead conversion</a></div>' +
      '<div class="dma-kpis" id="an-kpis">' + A().spinner() + '</div>' +
      '<div class="dma-grid-2"><section class="dma-panel"><div class="dma-panel-h"><h2>Appointments (7 days)</h2></div><div class="dma-panel-b" id="an-week"></div></section>' +
      '<section class="dma-panel"><div class="dma-panel-h"><h2>Top treatments</h2></div><div class="dma-panel-b" id="an-tx"></div></section></div>' +
      '<section class="dma-panel" style="margin-top:16px"><div class="dma-panel-h"><h2>Messages by channel</h2></div><div class="dma-panel-b" id="an-ch"></div></section>';
    Promise.all([
      A().get('/api/analytics/overview'),
      A().get('/api/analytics/weekly-appointments'),
      A().get('/api/analytics/top-treatments'),
      A().get('/api/analytics/messages-by-channel'),
    ]).then(function (p) {
      var ov = p[0] || {};
      el('an-kpis').innerHTML = [
        ['Revenue', ov.revenue && A().money(ov.revenue.value), ov.revenue && ((ov.revenue.change >= 0 ? 'up' : 'down') + ' ' + ov.revenue.change + '% vs last month')],
        ['Appointments', ov.appointments && ov.appointments.value, ov.appointments && (ov.appointments.change + '% vs last month')],
        ['Return rate', ov.returnRate && ov.returnRate.value + '%', 'completed patients returning'],
        ['No-show rate', ov.noShowRate && ov.noShowRate.value + '%', 'this month'],
      ].map(function (k) {
        return '<div class="dma-kpi"><div><label>' + k[0] + '</label><strong>' + esc(k[1] != null ? k[1] : '—') + '</strong><span class="sub">' + esc(k[2] || '') + '</span></div></div>';
      }).join('');
      var week = Array.isArray(p[1]) ? p[1] : [];
      var max = Math.max.apply(null, week.map(function (d) { return d.count || 0; }).concat([1]));
      el('an-week').innerHTML = '<div style="display:flex;align-items:flex-end;gap:8px;height:140px">' + week.map(function (d) {
        var h = Math.round(((d.count || 0) / max) * 120);
        return '<div style="flex:1;text-align:center"><div style="height:' + h + 'px;background:#2563EB;border-radius:6px 6px 0 0"></div><div class="dma-hint">' + esc(d.date) + '<br>' + (d.count || 0) + '</div></div>';
      }).join('') + '</div>';
      var txs = Array.isArray(p[2]) ? p[2] : (p[2].data || []);
      el('an-tx').innerHTML = txs.length ? txs.map(function (t) {
        return '<div class="dma-row-item"><div class="name">' + esc(t.treatment || t.name) + '</div><div class="meta">' + esc(t.count || t._count || 0) + '</div></div>';
      }).join('') : '<p class="dma-hint">No completed treatments yet.</p>';
      var ch = Array.isArray(p[3]) ? p[3] : [];
      el('an-ch').innerHTML = ch.length ? ch.map(function (c) {
        return '<div class="dma-row-item"><div class="name">' + esc(c.channel || c.name) + '</div><div class="meta">' + esc(c.count || 0) + '</div></div>';
      }).join('') : '<p class="dma-hint">No messages yet. <a href="/dashboard/whatsapp/">Connect WhatsApp</a>.</p>';
    });
  }

  /* ── REVIEWS ──────────────────────────────────────────────────────────── */
  function reviews() {
    var root = page();
    root.innerHTML =
      '<div class="dma-head"><div><h1>Reviews</h1><p>Request Google reviews from completed visits over WhatsApp.</p></div>' +
      '<button class="dma-btn dma-btn-primary" id="rv-req">Request reviews</button></div>' +
      '<div id="rv-body">' + A().spinner() + '</div>';
    A().get('/api/reviews').then(function (d) {
      if (!d.configured) {
        el('rv-body').innerHTML = A().empty('Google reviews not connected', 'Add a Place ID in Settings, then request reviews after completed appointments.', '/dashboard/settings/?tab=clinic', 'Open settings');
        return;
      }
      var rows = d.reviews || [];
      el('rv-body').innerHTML =
        '<div class="dma-kpis"><div class="dma-kpi"><div><label>Rating</label><strong>' + esc(d.rating || '—') + '</strong></div></div>' +
        '<div class="dma-kpi"><div><label>Reviews</label><strong>' + esc(d.totalReviews || rows.length) + '</strong></div></div></div>' +
        '<section class="dma-panel"><div class="dma-panel-b">' +
        (rows.map(function (r) {
          return '<div class="dma-row-item"><div><div class="name">' + esc(r.author_name || 'Patient') + ' · ' + esc(r.rating) + '/5</div><div class="sub">' + esc(r.text || '') + '</div></div></div>';
        }).join('') || '<p class="dma-hint">No Google reviews returned yet.</p>') +
        '</div></section>';
    });
    el('rv-req').onclick = function () {
      A().get('/api/appointments?filter=month&limit=50').then(function (d) {
        var done = (d.data || []).filter(function (a) { return a.status === 'COMPLETED'; });
        var ids = done.map(function (a) { return a.patientId; }).filter(Boolean);
        if (!ids.length) { A().toast('No completed visits this month to request reviews from', 'err'); return; }
        A().post('/api/reviews/request', { patientIds: ids, channel: 'WHATSAPP' }).then(function (r) {
          if (r.ok) A().toast('Review requests queued on WhatsApp', 'ok');
          else A().toast((r.d && r.d.error) || 'Could not send. Connect WhatsApp first.', 'err');
        });
      });
    };
  }

  /* ── STAFF ────────────────────────────────────────────────────────────── */
  function staff() {
    var root = page();
    root.innerHTML =
      '<div class="dma-head"><div><h1>Team</h1><p>Invite reception and doctors. Permissions stay on this clinic.</p></div>' +
      '<button class="dma-btn dma-btn-primary" id="st-add">Invite staff</button></div>' +
      '<section class="dma-panel"><div class="dma-table-wrap"><table class="dma-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody id="st-body"></tbody></table></div></section>';
    function load() {
      A().get('/api/staff').then(function (rows) {
        var list = Array.isArray(rows) ? rows : [];
        el('st-body').innerHTML = list.length ? list.map(function (s) {
          return '<tr><td><strong>' + esc(s.name) + '</strong></td><td>' + esc(s.email) + '</td><td>' + esc(s.role) + '</td><td>' + A().chip(s.status) + '</td>' +
            '<td><button class="dma-btn dma-btn-danger dma-btn-sm" data-id="' + esc(s.id) + '">Deactivate</button></td></tr>';
        }).join('') : '<tr><td colspan="5">' + A().empty('No staff yet', 'Invite a receptionist to share the inbox.') + '</td></tr>';
        el('st-body').querySelectorAll('button[data-id]').forEach(function (b) {
          b.onclick = function () {
            A().del('/api/staff/' + b.getAttribute('data-id')).then(function (r) {
              if (r.ok) { A().toast('Staff updated', 'ok'); load(); }
              else A().toast((r.d && r.d.error) || 'Failed', 'err');
            });
          };
        });
      });
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
          if (!r.ok) { A().toast((r.d && r.d.error) || 'Invite failed', 'err'); return; }
          A().closeModal(); A().toast('Invite sent', 'ok'); load();
        });
      };
    };
  }

  /* ── BILLING ──────────────────────────────────────────────────────────── */
  function billing() {
    var root = page();
    root.innerHTML =
      '<div class="dma-head"><div><h1>Billing</h1><p>Plan, invoices, and WhatsApp messaging allowance for this clinic.</p></div></div>' +
      '<div id="bl-body">' + A().spinner() + '</div>';
    Promise.all([A().get('/api/billing/subscription'), A().get('/api/billing/invoices').catch(function () { return []; })]).then(function (p) {
      var s = p[0] || {};
      var inv = Array.isArray(p[1]) ? p[1] : [];
      var d = s.planDetails || {};
      el('bl-body').innerHTML =
        '<div class="dma-grid-2"><section class="dma-panel"><div class="dma-panel-h"><h2>' + esc(d.name || s.plan || 'Plan') + '</h2>' + A().chip(s.planStatus || s.plan) + '</div>' +
        '<div class="dma-panel-b"><p class="dma-hint">Staff seats: ' + esc(d.staff) + ' · Patients: ' + esc(d.patients) + ' · AI messages: ' + esc(d.aiMessages) + '</p>' +
        (s.trialEndsAt ? '<p class="dma-hint">Trial ends ' + A().fmtDate(s.trialEndsAt) + '</p>' : '') +
        (s.currentPeriodEnd ? '<p class="dma-hint">Renews ' + A().fmtDate(s.currentPeriodEnd) + '</p>' : '') +
        '<div style="display:flex;gap:8px;margin-top:12px"><button class="dma-btn dma-btn-primary" id="bl-up">Upgrade</button><button class="dma-btn dma-btn-ghost" id="bl-portal">Manage payment</button></div>' +
        '</div></section>' +
        '<section class="dma-panel"><div class="dma-panel-h"><h2>Need WhatsApp?</h2></div><div class="dma-panel-b"><p class="dma-hint">Connection is included with the clinic workspace. Finish Meta Embedded Signup on the WhatsApp page.</p><a class="dma-btn dma-btn-wa" href="/dashboard/whatsapp/">Open WhatsApp</a></div></section></div>' +
        '<section class="dma-panel" style="margin-top:16px"><div class="dma-panel-h"><h2>Invoices</h2></div><div class="dma-panel-b">' +
        (inv.map(function (i) {
          return '<div class="dma-row-item"><div class="name">' + esc(i.number || i.id) + '</div><div class="meta">' + esc(i.status) + ' · ' + A().fmtDate(i.created || i.date) + '</div></div>';
        }).join('') || '<p class="dma-hint">No invoices yet.</p>') +
        '</div></section>';
      el('bl-up').onclick = function () {
        A().post('/api/billing/checkout', { plan: 'PRO' }).then(function (r) {
          if (r.d && r.d.url) location.href = r.d.url;
          else A().toast((r.d && r.d.error) || 'Checkout unavailable', 'err');
        });
      };
      el('bl-portal').onclick = function () {
        A().post('/api/billing/portal', {}).then(function (r) {
          if (r.d && r.d.url) location.href = r.d.url;
          else A().toast((r.d && r.d.error) || 'Portal unavailable', 'err');
        });
      };
    });
  }

  /* ── SETTINGS ─────────────────────────────────────────────────────────── */
  function settings() {
    var root = page();
    var tab = A().qs('tab', 'clinic');
    root.innerHTML =
      '<div class="dma-head"><div><h1>Settings</h1><p>Clinic profile, hours, treatments — everything the receptionist and booking page use.</p></div></div>' +
      '<div class="dma-tabs" id="st-tabs"></div><div id="st-body"></div>';
    var tabs = [['clinic', 'Clinic'], ['hours', 'Hours'], ['treatments', 'Treatments'], ['booking', 'Booking page']];
    function draw() {
      el('st-tabs').innerHTML = tabs.map(function (t) {
        return '<button data-t="' + t[0] + '" class="' + (tab === t[0] ? 'active' : '') + '">' + t[1] + '</button>';
      }).join('');
    }
    draw();
    el('st-tabs').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      tab = b.getAttribute('data-t'); A().setQs({ tab: tab }, true); draw(); render();
    };
    function render() {
      A().get('/api/settings').then(function (s) {
        if (tab === 'clinic') {
          el('st-body').innerHTML =
            '<div class="dma-banner">WhatsApp uses this profile in greetings. <a href="/dashboard/whatsapp/">Manage connection</a> · <a href="/dashboard/ai/">Train AI</a></div>' +
            '<section class="dma-panel"><div class="dma-panel-b">' +
            '<div class="dma-row"><div class="dma-field"><label>Clinic name</label><input id="s-name" value="' + esc(s.name || '') + '"></div>' +
            '<div class="dma-field"><label>Owner</label><input id="s-owner" value="' + esc(s.ownerName || '') + '"></div></div>' +
            '<div class="dma-row"><div class="dma-field"><label>Phone</label><input id="s-phone" value="' + esc(s.phone || '') + '"></div>' +
            '<div class="dma-field"><label>Email</label><input id="s-email" value="' + esc(s.email || '') + '"></div></div>' +
            '<div class="dma-field"><label>Specialty</label><input id="s-spec" value="' + esc(s.specialty || '') + '"></div>' +
            '<div class="dma-field"><label>Address</label><input id="s-addr" value="' + esc(s.address || '') + '"></div>' +
            '<div class="dma-field"><label>Google Place ID</label><input id="s-place" value="' + esc(s.googlePlaceId || '') + '"><p class="dma-hint">Used on the Reviews page.</p></div>' +
            '<button class="dma-btn dma-btn-primary" id="s-save">Save clinic</button></div></section>';
          el('s-save').onclick = function () {
            A().patch('/api/settings/clinic', {
              name: el('s-name').value, ownerName: el('s-owner').value, phone: el('s-phone').value,
              email: el('s-email').value, specialty: el('s-spec').value, address: el('s-addr').value,
              googlePlaceId: el('s-place').value || undefined,
            }).then(function (r) {
              if (r.ok) A().toast('Clinic saved — AI and booking will use the new details', 'ok');
              else A().toast((r.d && r.d.error) || 'Save failed', 'err');
            });
          };
        } else if (tab === 'hours') {
          var days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
          var wh = A().parseJson(s.workingHours, {}) || {};
          if (typeof wh !== 'object' || Array.isArray(wh)) wh = {};
          el('st-body').innerHTML = '<section class="dma-panel"><div class="dma-panel-b" id="hrs">' +
            days.map(function (d) {
              var row = wh[d] || { open: '09:00', close: '17:00', closed: false };
              if (typeof row === 'string') row = { open: '09:00', close: '17:00', closed: false };
              return '<div class="dma-row" style="align-items:center;margin-bottom:8px"><strong style="text-transform:capitalize">' + d + '</strong>' +
                '<input type="time" data-d="' + d + '" data-k="open" value="' + esc(row.open || '09:00') + '">' +
                '<input type="time" data-d="' + d + '" data-k="close" value="' + esc(row.close || '17:00') + '">' +
                '<label style="display:flex;gap:6px;align-items:center;font-size:12px"><input type="checkbox" data-d="' + d + '" data-k="closed"' + (row.closed ? ' checked' : '') + '> Closed</label></div>';
            }).join('') + '<button class="dma-btn dma-btn-primary" id="hrs-save">Save hours</button></div></section>';
          el('hrs-save').onclick = function () {
            var out = {};
            days.forEach(function (d) {
              out[d] = {
                open: document.querySelector('input[data-d="' + d + '"][data-k="open"]').value,
                close: document.querySelector('input[data-d="' + d + '"][data-k="close"]').value,
                closed: document.querySelector('input[data-d="' + d + '"][data-k="closed"]').checked,
              };
            });
            A().patch('/api/settings/hours', { workingHours: JSON.stringify(out) }).then(function (r) {
              if (r.ok) A().toast('Hours saved — receptionist will offer these slots', 'ok');
              else A().toast((r.d && r.d.error) || 'Save failed', 'err');
            });
          };
        } else if (tab === 'treatments') {
          var txs = A().parseJson(s.treatments, []) || [];
          if (!Array.isArray(txs)) txs = [];
          function drawTx() {
            el('st-body').innerHTML = '<section class="dma-panel"><div class="dma-panel-b">' +
              '<p class="dma-hint">These treatments appear in booking, WhatsApp, broadcasts, and the AI knowledge tab.</p>' +
              '<div id="tx-list"></div><button class="dma-btn dma-btn-ghost" id="tx-add">Add treatment</button> ' +
              '<button class="dma-btn dma-btn-primary" id="tx-save">Save treatments</button></div></section>';
            el('tx-list').innerHTML = (txs.length ? txs : [{ name: '', fee: '' }]).map(function (t, i) {
              var name = typeof t === 'string' ? t : (t.name || '');
              var fee = typeof t === 'object' ? (t.fee || t.price || '') : '';
              return '<div class="dma-row" style="margin-bottom:8px"><input data-i="' + i + '" data-k="name" placeholder="Cleaning" value="' + esc(name) + '">' +
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
              el('tx-list').querySelectorAll('.dma-row').forEach(function (row) {
                var name = row.querySelector('[data-k="name"]').value.trim();
                var fee = Number(row.querySelector('[data-k="fee"]').value || 0);
                if (name) next.push({ name: name, fee: fee || undefined });
              });
              A().patch('/api/settings/treatments', { treatments: JSON.stringify(next) }).then(function (r) {
                if (r.ok) { A().toast('Treatments saved — AI and booking are in sync', 'ok'); txs = next; }
                else A().toast((r.d && r.d.error) || 'Save failed', 'err');
              });
            };
          }
          drawTx();
        } else {
          var slug = s.bookingSlug || '';
          var url = location.origin + '/patients/clinic/' + slug;
          el('st-body').innerHTML =
            '<section class="dma-panel"><div class="dma-panel-b">' +
            '<div class="dma-field"><label>Booking slug</label><input id="bk-slug" value="' + esc(slug) + '"></div>' +
            '<p class="dma-hint">Public page: <a href="' + esc(url) + '" target="_blank">' + esc(url) + '</a></p>' +
            '<div class="dma-field"><label>Default fee</label><input id="bk-fee" type="number" value="' + esc(s.defaultFee || '') + '"></div>' +
            '<button class="dma-btn dma-btn-primary" id="bk-save">Save booking</button></div></section>';
          el('bk-save').onclick = function () {
            A().patch('/api/settings/clinic', { bookingSlug: el('bk-slug').value, defaultFee: Number(el('bk-fee').value || 0) || undefined }).then(function (r) {
              if (r.ok) A().toast('Booking page updated', 'ok');
              else A().toast((r.d && r.d.error) || 'Save failed', 'err');
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
      '<div class="dma-head"><div><h1>Updates</h1><p>Bookings, WhatsApp escalations, and system notices.</p></div>' +
      '<button class="dma-btn dma-btn-ghost" id="n-read">Mark all read</button></div>' +
      '<section class="dma-panel"><div class="dma-panel-b" id="n-list">' + A().spinner() + '</div></section>';
    function load() {
      A().get('/api/notifications').then(function (rows) {
        var list = Array.isArray(rows) ? rows : [];
        el('n-list').innerHTML = list.length ? list.map(function (n) {
          var href = /whatsapp|message/i.test(n.type || n.title || '') ? '/dashboard/messages/'
            : /lead/i.test(n.type || n.title || '') ? '/dashboard/leads/'
            : /appoint/i.test(n.type || n.title || '') ? '/dashboard/appointments/'
            : '/dashboard/';
          return '<a class="dma-row-item" href="' + href + '"><div><div class="name">' + esc(n.title || 'Update') + '</div><div class="sub">' + esc(n.body || '') + '</div></div><div class="meta">' + A().ago(n.createdAt) + (n.isRead ? '' : ' · new') + '</div></a>';
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
  };
})(window);
