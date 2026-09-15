/**
 * ClinicOS inner product — appointments, calendar, waiting room, patients,
 * clinical chart (notes-backed), and honest unavailable modules.
 */
(function (global) {
  function A() { return global.DmaApp; }
  function el(id) { return document.getElementById(id); }
  function page() { return el('doc-page'); }
  function esc(s) { return A().esc(s); }

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

  function Clin() { return global.DmaClinical; }

  function ownerName() {
    var c = Clin();
    return (c && c.primaryPractitioner().name) || A().user().ownerName || A().user().name || 'Practitioner';
  }

  function clinicName() {
    var c = Clin();
    return (c && c.clinicOrg().name) || A().user().clinicName || A().user().name || 'Clinic';
  }

  function practName(a) {
    var c = Clin();
    if (c) return c.assignedClinician(a).name;
    return ownerName();
  }

  function pageHead(title, desc, actionsHtml, kicker) {
    return '<div class="dma-head dma-head-page ds-page-enter"><div>' +
      (kicker ? '<div class="dma-head-kicker"><span class="ds-pill">' + kicker + '</span></div>' : '') +
      '<h1>' + title + '</h1>' +
      (desc ? '<p class="dma-prose">' + desc + '</p>' : '') +
      '</div>' + (actionsHtml ? '<div class="dma-head-actions">' + actionsHtml + '</div>' : '') + '</div>';
  }

  function emptyMark() {
    return '<div class="cos-empty-mark" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg></div>';
  }

  function empty(title, body, href, cta, kind) {
    return '<div class="cos-empty"' + (kind ? ' data-kind="' + kind + '"' : '') + '>' + emptyMark() +
      '<span class="ds-pill">Nothing here yet</span><h2>' + esc(title) + '</h2><p>' + esc(body) + '</p>' +
      (href ? '<a class="dma-btn dma-btn-primary" href="' + href + '">' + esc(cta || 'Continue') + '<svg class="arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>' : '') + '</div>';
  }

  function unavailable(title, why, nextHref, nextLabel, configHref) {
    return '<div class="cos-unavail"><span class="ds-pill">Module unavailable</span><h2>' + esc(title) + '</h2><p>' + esc(why) + '</p>' +
      '<div class="dma-head-actions">' +
      (configHref && identity() === 'OWNER' ? '<a class="dma-btn dma-btn-ghost" href="' + configHref + '">Configure integration</a>' : '') +
      (nextHref ? '<a class="dma-btn dma-btn-primary" href="' + nextHref + '">' + esc(nextLabel || 'Back to work') + '</a>' : '') +
      '</div></div>';
  }

  function errBox(msg, retryId) {
    return '<div class="cos-empty" data-kind="error">' + emptyMark() +
      '<h2>' + esc(msg || "Couldn't load this page.") + '</h2><p>Check your connection, then try again.</p>' +
      '<button type="button" class="dma-btn dma-btn-primary" id="' + (retryId || 'retry') + '">Try again</button>' +
      '<a class="dma-btn dma-btn-ghost" href="/dashboard/">Back</a></div>';
  }

  function skel() {
    return '<div class="cos-skel-page" aria-hidden="true"><div class="cos-skel lg"></div><div class="cos-skel"></div><div class="cos-skel"></div><div class="cos-skel"></div></div>';
  }

  function disabledFilter(kind) {
    var c = Clin();
    var st = kind === 'doctor' ? (c && c.clinicianFilterState()) : kind === 'location' ? (c && c.locationFilterState()) : (c && c.roomFilterState());
    st = st || { available: false, hint: 'This filter is not configured.' };
    if (st.available) return '';
    return '<span class="cos-filter-hint" title="' + esc(st.hint) + '">' + esc(st.hint) + '</span>';
  }

  function statusOf(a) { return String(a.status || '').toUpperCase(); }

  function feeLabel(a) {
    if (a.fee == null || a.fee === '') return 'No fee recorded';
    return A().money(a.fee);
  }

  function apptList(d) { return (d && (d.data || d.appointments)) || []; }

  function encounterOf(a) {
    return Clin() ? Clin().fromAppointment(a) : { id: a.id, patient: a.patient || {}, appointment: a, vitals: {}, clinicalNote: {}, prescriptions: [], labOrders: [], followUp: null };
  }

  function visitOf(a) {
    return Clin() && Clin().visitState ? Clin().visitState(a) : { code: statusOf(a), persist: statusOf(a), persistable: true, label: statusOf(a) };
  }

  function failMsg(r, fallback) {
    return (A().friendlyError && A().friendlyError(r, fallback)) || fallback || "Couldn't complete that request.";
  }

  function patchAppt(id, body, okMsg, thenFn) {
    if (body && body.status && Clin() && !Clin().canPersistStatus(body.status)) {
      A().toast("That visit state isn't stored on the server yet.", 'err');
      return Promise.resolve({ ok: false, status: 0, d: {} });
    }
    return A().patch('/api/appointments/' + id, body).then(function (r) {
      if (r.ok) {
        if (body && body.status === 'IN_PROGRESS' && Clin()) Clin().clearCalled(id);
        A().toast(okMsg || 'Updated', 'ok');
        if (thenFn) thenFn(r.d);
      } else A().toast(failMsg(r, "Couldn't update this visit."), 'err');
      return r;
    });
  }

  function isoLocal(d) {
    var dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return '';
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()) + 'T' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':00';
  }

  function ageOf(dob) {
    if (!dob) return '—';
    var t = new Date(dob);
    if (isNaN(t.getTime())) return '—';
    var a = Math.floor((Date.now() - t.getTime()) / 31557600000);
    return a >= 0 ? String(a) : '—';
  }

  /* ── Appointment detail ─────────────────────────────────────────────── */
  function apptDrawer(a, onChanged) {
    var p = a.patient || {};
    var pid = a.patientId || p.id || '';
    var enc = encounterOf(a);
    var vis = visitOf(a);
    var st = vis.persist;
    var note = enc.clinicalNote || {};
    var loc = enc.location || { name: clinicName() };
    var steps = [
      ['Created', true],
      ['Confirmed', ['CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'WAITING', 'CALLED'].indexOf(vis.code) >= 0 || ['CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'].indexOf(st) >= 0],
      ['Checked in', ['WAITING', 'CALLED', 'IN_PROGRESS', 'COMPLETED'].indexOf(vis.code) >= 0 || ['ARRIVED', 'IN_PROGRESS', 'COMPLETED'].indexOf(st) >= 0],
      ['Called', vis.code === 'CALLED' || st === 'IN_PROGRESS' || st === 'COMPLETED'],
      ['Started', st === 'IN_PROGRESS' || st === 'COMPLETED'],
      ['Completed', st === 'COMPLETED']
    ];
    var sec = function (h, body) {
      return '<div class="cos-drawer-sec"><h3>' + h + '</h3>' + body + '</div>';
    };
    var d = (global.DmaUI && DmaUI.drawer) ? DmaUI.drawer({
      title: p.fullName || 'Appointment',
      subtitle: (a.treatment || 'Visit') + ' · ' + vis.label,
      wide: true,
      tabs: [
        { id: 'overview', label: 'Overview' },
        { id: 'patient', label: 'Patient' },
        { id: 'clinical', label: 'Clinical' },
        { id: 'activity', label: 'Activity' }
      ],
      html:
        '<div class="cos-drawer-hero"><div class="cos-avatar dma-avatar">' + A().initials(p.fullName) + '</div>' +
        '<div><strong>' + esc(p.fullName || 'Patient') + '</strong><div class="dma-hint">' + A().fmtDate(a.dateTime) + ' · ' + A().fmtTime(a.dateTime) + '</div></div>' +
        A().chip(vis.label) + '</div>' +
        sec('Appointment', kv([['Type', a.treatment || 'Visit'], ['Date', A().fmtDate(a.dateTime)], ['Time', A().fmtTime(a.dateTime)], ['Location', loc.name]])) +
        sec('Payment', '<p>' + esc(feeLabel(a)) + ' <span class="dma-hint">Visit fee — not a patient invoice.</span></p>') +
        sec('Booking source', kv([['Channel', a.channel || 'MANUAL'], ['Booked by', a.bookedByAI ? 'AI receptionist' : (a.bookedByStaffId ? 'Staff' : practName(a))]])),
      footer:
        '<button type="button" class="dma-btn dma-btn-ghost" data-close="1">Close</button>' +
        (pid ? '<a class="dma-btn dma-btn-ghost" href="/dashboard/patients/detail/?id=' + esc(pid) + '">Chart</a>' : '') +
        ((Clin() && Clin().canChart()) ? '<a class="dma-btn dma-btn-ghost" href="/dashboard/clinical/?id=' + esc(a.id) + '">Consult</a>' : '') +
        actionButtons(a),
      onTab: function (tab, api) {
        if (tab === 'overview') {
          api.setBody(
            '<div class="cos-drawer-hero"><div class="cos-avatar dma-avatar">' + A().initials(p.fullName) + '</div>' +
            '<div><strong>' + esc(p.fullName || 'Patient') + '</strong><div class="dma-hint">' + A().fmtDate(a.dateTime) + ' · ' + A().fmtTime(a.dateTime) + '</div></div>' +
            A().chip(vis.label) + '</div>' +
            sec('Appointment', kv([['Type', a.treatment || 'Visit'], ['Date', A().fmtDate(a.dateTime)], ['Time', A().fmtTime(a.dateTime)], ['Location', loc.name]])) +
            sec('Payment', '<p>' + esc(feeLabel(a)) + ' <span class="dma-hint">Visit fee — not a patient invoice.</span></p>') +
            sec('Booking source', kv([['Channel', a.channel || 'MANUAL'], ['Booked by', a.bookedByAI ? 'AI receptionist' : (a.bookedByStaffId ? 'Staff' : practName(a))]]))
          );
        } else if (tab === 'patient') {
          api.setBody(sec('Patient', kv([['Name', p.fullName], ['Phone', p.phone]])) + (pid ? '<a class="dma-btn dma-btn-primary" href="/dashboard/patients/detail/?id=' + esc(pid) + '">Open chart</a>' : ''));
        } else if (tab === 'clinical') {
          api.setBody(sec('Doctor', kv([['Assigned clinician', practName(a)]])) + sec('Visit reason', '<p>' + esc(note.complaint || note.freeText || '—') + '</p>') +
            ((Clin() && Clin().canChart()) ? '<a class="dma-btn dma-btn-primary" href="/dashboard/clinical/?id=' + esc(a.id) + '">Open consultation</a>' : ''));
        } else {
          api.setBody(sec('Activity', '<div class="cos-timeline-med">' + steps.map(function (s) {
            return '<article><strong>' + s[0] + '</strong> · ' + (s[1] ? 'Done' : 'Pending') + '</article>';
          }).join('') + '</div>'));
        }
      }
    }) : null;
    bindActions(d && d.el ? d.el : document, a, function () { if (d && d.close) d.close(); if (onChanged) onChanged(); });
    return d;
  }

  function actionButtons(a) {
    var vis = visitOf(a);
    var st = vis.persist;
    var out = '';
    var role = identity();
    var desk = role === 'OWNER' || role === 'RECEPTIONIST' || role === 'MANAGER';
    if (desk && st === 'PENDING') out += '<button type="button" class="dma-btn dma-btn-ghost dma-btn-sm" data-st="CONFIRMED" data-id="' + esc(a.id) + '">Confirm</button>';
    if (desk && (st === 'PENDING' || st === 'CONFIRMED')) out += '<button type="button" class="dma-btn dma-btn-primary dma-btn-sm" data-st="ARRIVED" data-id="' + esc(a.id) + '">Check in</button>';
    if (desk && vis.code === 'WAITING') out += '<button type="button" class="dma-btn dma-btn-ghost dma-btn-sm" data-call="' + esc(a.id) + '">Call patient</button>';
    if ((Clin() && Clin().canChart()) && (vis.code === 'WAITING' || vis.code === 'CALLED' || st === 'CONFIRMED' || st === 'ARRIVED')) {
      out += '<button type="button" class="dma-btn dma-btn-primary dma-btn-sm" data-st="IN_PROGRESS" data-id="' + esc(a.id) + '">Start</button>';
    }
    if ((Clin() && Clin().canChart()) && st === 'IN_PROGRESS') out += '<button type="button" class="dma-btn dma-btn-primary dma-btn-sm" data-st="COMPLETED" data-id="' + esc(a.id) + '">Complete</button>';
    if (desk && st !== 'COMPLETED' && st !== 'CANCELLED') {
      out += '<button type="button" class="dma-btn dma-btn-ghost dma-btn-sm" data-reschedule="' + esc(a.id) + '">Reschedule</button>';
      out += '<button type="button" class="dma-btn dma-btn-ghost dma-btn-sm" data-st="NO_SHOW" data-id="' + esc(a.id) + '">No show</button>';
      out += '<button type="button" class="dma-btn dma-btn-danger dma-btn-sm" data-st="CANCELLED" data-id="' + esc(a.id) + '">Cancel</button>';
    }
    return out;
  }

  function bindActions(root, a, done) {
    if (!root) return;
    root.querySelectorAll('[data-st]').forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        patchAppt(b.getAttribute('data-id') || a.id, { status: b.getAttribute('data-st') }, 'Status updated', done);
      };
    });
    root.querySelectorAll('[data-call]').forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        var id = b.getAttribute('data-call') || a.id;
        var result = Clin() && Clin().markCalled(id);
        if (result && result.ok) {
          A().toast(result.persistable ? 'Patient called.' : 'Patient called on this board. This isn’t stored on the server yet.', 'ok');
          if (done) done();
        }
      };
    });
    root.querySelectorAll('[data-reschedule]').forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        var nxt = window.prompt('New date and time (YYYY-MM-DD HH:MM)', A().fmtDate(a.dateTime) + ' ' + A().fmtTime(a.dateTime));
        if (!nxt) return;
        var iso = new Date(nxt.replace(' ', 'T')).toISOString();
        patchAppt(b.getAttribute('data-reschedule'), { dateTime: iso, status: 'RESCHEDULED' }, 'Rescheduled', done);
      };
    });
  }

  function apptCard(a) {
    var p = a.patient || {};
    var vis = visitOf(a);
    return '<article class="cos-appt-card cos-card cos-card--appt" data-appt="' + esc(a.id) + '" draggable="true">' +
      '<div class="cos-avatar" aria-hidden="true">' + A().initials(p.fullName) + '</div>' +
      '<div><div class="who">' + esc(p.fullName || 'Patient') + '</div>' +
      '<div class="meta">' + A().fmtTime(a.dateTime) + ' · ' + A().fmtDate(a.dateTime) + ' · ' + esc(a.treatment || 'Visit') + (a.fee ? ' · ' + feeLabel(a) : '') + '</div></div>' +
      A().chip(vis.label) +
      '<div class="cos-appt-actions">' +
        '<button type="button" class="dma-btn dma-btn-ghost dma-btn-sm" data-open="' + esc(a.id) + '">Open</button>' +
        actionButtons(a) +
      '</div></article>';
  }

  /* ── Book wizard ────────────────────────────────────────────────────── */
  function bookWizard(presetPatient) {
    var step = 1;
    var state = { patientId: presetPatient || '', treatment: '', date: '', time: '', durationMin: 30, notes: '', fee: '', patientName: '' };
    var treatments = [];
    var patients = [];
    var slots = [];
    var wrap = document.createElement('div');
    wrap.className = 'dma-modal-bg';
    wrap.innerHTML = '<div class="dma-modal dma-modal--wizard" role="dialog" aria-modal="true" aria-labelledby="wiz-title"><div class="dma-modal-h"><h3 id="wiz-title">New appointment</h3><button type="button" class="dma-btn dma-btn-ghost" data-x aria-label="Close">Close</button></div><div class="dma-modal-b" id="wiz-b">' + skel() + '</div><div class="dma-modal-f" id="wiz-f"></div></div>';
    document.body.appendChild(wrap);
    function closeWiz() {
      if (wrap._release) wrap._release();
      wrap.remove();
    }
    wrap.querySelector('[data-x]').onclick = closeWiz;
    wrap.addEventListener('click', function (e) { if (e.target === wrap) closeWiz(); });
    if (global.DmaUI && DmaUI.trapFocus) wrap._release = DmaUI.trapFocus(wrap, closeWiz);

    function patientPickLabel(p) {
      var name = String(p.fullName || '').trim();
      var phone = String(p.phone || '').trim();
      var looksPhone = function (s) { return /^\+?\d[\d\s\-()]{6,}$/.test(String(s).replace(/\s/g, '')); };
      var looksWeb = function (s) { return /^web:/i.test(s) || /^web\s*visitor$/i.test(s); };
      var title;
      if (name && !looksPhone(name) && !looksWeb(name)) title = name;
      else if (looksWeb(name) || looksWeb(phone)) title = 'Web visitor';
      else title = (looksPhone(name) || looksPhone(phone)) ? 'Phone contact' : (name || 'Unnamed patient');
      var sub = '';
      if (looksPhone(phone) && phone !== title) sub = phone;
      else if (looksPhone(name) && name !== title) sub = name;
      return { title: title, sub: sub };
    }
    function patientPickHtml(p) {
      var lab = patientPickLabel(p);
      return '<button type="button" class="cos-pick-item' + (state.patientId === p.id ? ' on' : '') + '" data-pid="' + esc(p.id) + '" data-pn="' + esc(lab.title) + '">' +
        '<span class="dma-avatar" aria-hidden="true">' + A().initials(lab.title) + '</span>' +
        '<span class="cos-pick-copy"><strong>' + esc(lab.title) + '</strong>' + (lab.sub ? '<span>' + esc(lab.sub) + '</span>' : '') + '</span></button>';
    }

    function paint() {
      var labels = ['Patient', 'Doctor', 'Type', 'Date', 'Details', 'Payment', 'Confirm'];
      var steps = '<div class="cos-stepper">' +
        '<div class="cos-stepper-meta">Step ' + step + ' of ' + labels.length + ' · ' + labels[step - 1] + '</div>' +
        '<div class="cos-stepper-bar" role="progressbar" aria-valuemin="1" aria-valuemax="' + labels.length + '" aria-valuenow="' + step + '"><i style="width:' + Math.round((step / labels.length) * 100) + '%"></i></div></div>';
      var body = '';
      if (step === 1) {
        body = '<div class="dma-field"><label for="w-q">Search patients</label><input id="w-q" class="dma-search" placeholder="Name or phone" autocomplete="off"></div>' +
          '<div id="w-pts" class="cos-pick-list">' + (patients.length ? patients.slice(0, 12).map(patientPickHtml).join('') : '<p class="dma-hint">No patients yet. Add a chart first.</p>') + '</div>' +
          '<p class="dma-hint">Need a new chart? <a href="/dashboard/patients/?action=new">Add patient</a></p>';
      } else if (step === 2) {
        var practs = Clin() ? Clin().listPractitioners() : [{ name: ownerName() }];
        body = '<div class="cos-pick-list">' + practs.map(function (pr) {
          return '<button type="button" class="cos-pick-item" data-pr="' + esc(pr.id || '') + '"><span class="dma-avatar">' + A().initials(pr.name) + '</span><span class="cos-pick-copy"><strong>' + esc(pr.name) + '</strong><span>' + esc(pr.specialty || clinicName()) + '</span></span></button>';
        }).join('') + '</div>' + (practs.length < 2 ? '<p class="dma-hint">Additional clinicians can be assigned when they are added to this clinic.</p>' : '');
      } else if (step === 3) {
        body = treatments.length
          ? '<div class="cos-slot-wrap">' + treatments.map(function (t) {
              var name = typeof t === 'string' ? t : (t.name || '');
              return '<button type="button" class="cos-slot' + (state.treatment === name ? ' on' : '') + '" data-tx="' + esc(name) + '">' + esc(name) + '</button>';
            }).join('') + '</div>'
          : '<div class="dma-field"><label for="w-tx">Appointment type</label><input id="w-tx" value="' + esc(state.treatment) + '" placeholder="Consultation"></div>';
      } else if (step === 4) {
        body = '<div class="dma-field"><label for="w-date">Date</label><input id="w-date" type="date" value="' + esc(state.date) + '"></div><div id="w-slots" class="cos-slot-wrap">' + (slots.length ? slots.map(function (s) {
          var val = s.value || s.time || s;
          var lab = s.label || s.time || s;
          return '<button type="button" class="cos-slot' + (state.time === val ? ' on' : '') + '" data-tm="' + esc(val) + '">' + esc(lab) + '</button>';
        }).join('') : '<p class="dma-hint">Pick a date to see open slots.</p>') + '</div>';
      } else if (step === 5) {
        body = '<div class="dma-field"><label>Duration (minutes)</label><input id="w-dur" type="number" min="15" max="120" value="' + esc(state.durationMin) + '"></div>' +
          '<div class="dma-field"><label>Reason / notes</label><textarea id="w-notes" rows="3">' + esc(state.notes) + '</textarea></div>';
      } else if (step === 6) {
        body = '<p class="dma-hint">Optional visit fee. Leave empty if there is no charge.</p><div class="dma-field"><label for="w-fee">Visit fee</label><input id="w-fee" type="number" min="0" step="1" value="' + esc(state.fee) + '" placeholder="Leave empty if none"></div>';
      } else {
        body = '<div class="cos-pick-item on" style="cursor:default"><span class="cos-pick-copy"><strong>Ready to book</strong><span>' +
          esc(state.patientName || 'Patient') + ' · ' + esc(state.treatment || 'Visit') + '<br>' +
          esc(state.date) + (state.time ? ' · ' + esc(String(state.time).slice(11, 16) || state.time) : '') +
          '</span></span></div>';
      }
      var footer = (step > 1 ? '<button type="button" class="dma-btn dma-btn-ghost" id="w-back">Back</button>' : '') +
        (step < 7 ? '<button type="button" class="dma-btn dma-btn-primary" id="w-next">Continue</button>' : '<button type="button" class="dma-btn dma-btn-primary" id="w-save">Confirm booking</button>');
      el('wiz-b').innerHTML = '<div class="cos-wizard">' + steps + body + '</div>';
      if (el('wiz-f')) el('wiz-f').innerHTML = footer;
      wire();
    }

    function loadSlots() {
      if (!state.date) return;
      A().get('/api/appointments/slots?date=' + encodeURIComponent(state.date) + '&duration=' + state.durationMin).then(function (d) {
        slots = ((d && d.slots) || []).map(function (s) {
          var dt = new Date(s);
          return isNaN(dt.getTime()) ? { value: s, label: String(s) } : { value: dt.toISOString(), label: dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
        });
        paint();
      }).catch(function () { slots = []; paint(); });
    }

    function wire() {
      if (el('w-back')) el('w-back').onclick = function () { step -= 1; paint(); };
      if (el('w-next')) el('w-next').onclick = function () {
        if (step === 1 && !state.patientId) { A().toast('Select a patient', 'err'); return; }
        if (step === 3) {
          var tx = el('w-tx');
          if (tx) state.treatment = tx.value;
          if (!state.treatment) { A().toast('Choose a type', 'err'); return; }
        }
        if (step === 4 && (!state.date || !state.time)) { A().toast('Pick date and a slot', 'err'); return; }
        if (step === 5) {
          state.durationMin = Number(el('w-dur').value) || 30;
          state.notes = el('w-notes').value;
        }
        if (step === 6) state.fee = el('w-fee').value;
        step += 1; paint();
      };
      if (el('w-save')) el('w-save').onclick = save;
      el('wiz-b').querySelectorAll('[data-pid]').forEach(function (b) {
        b.onclick = function () { state.patientId = b.getAttribute('data-pid'); state.patientName = b.getAttribute('data-pn'); step = 2; paint(); };
      });
      el('wiz-b').querySelectorAll('[data-tx]').forEach(function (b) {
        b.onclick = function () { state.treatment = b.getAttribute('data-tx'); paint(); };
      });
      el('wiz-b').querySelectorAll('[data-tm]').forEach(function (b) {
        b.onclick = function () { state.time = b.getAttribute('data-tm'); paint(); };
      });
      var date = el('w-date');
      if (date) date.onchange = function () { state.date = date.value; loadSlots(); };
      var q = el('w-q');
      if (q) q.oninput = function () {
        var v = q.value.toLowerCase();
        el('w-pts').innerHTML = patients.filter(function (p) {
          var lab = patientPickLabel(p);
          return !v || lab.title.toLowerCase().indexOf(v) >= 0 || (p.fullName || '').toLowerCase().indexOf(v) >= 0 || (p.phone || '').indexOf(v) >= 0;
        }).slice(0, 12).map(patientPickHtml).join('') || '<p class="dma-hint">No matching patients.</p>';
        wrap.querySelectorAll('[data-pid]').forEach(function (b) {
          b.onclick = function () { state.patientId = b.getAttribute('data-pid'); state.patientName = b.getAttribute('data-pn'); step = 2; paint(); };
        });
      };
    }

    function save() {
      var when = state.time.indexOf('T') >= 0 ? state.time : (state.date + 'T' + (state.time.length === 5 ? state.time + ':00' : state.time));
      var body = {
        patientId: state.patientId,
        treatment: state.treatment || 'Consultation',
        dateTime: new Date(when).toISOString(),
        durationMin: state.durationMin || 30,
        notes: state.notes || undefined,
        channel: identity() === 'OWNER' ? 'MANUAL' : 'STAFF_PORTAL',
        sendConfirmation: true
      };
      if (state.fee) body.fee = Number(state.fee);
      A().post('/api/appointments', body).then(function (r) {
        if (!r.ok) { A().toast(failMsg(r, "Couldn't book this visit."), 'err'); return; }
        A().toast('Appointment booked', 'ok');
        closeWiz();
        location.href = '/dashboard/appointments/';
      });
    }

    Promise.all([
      A().get('/api/patients?limit=100').catch(function () { return { data: [] }; }),
      A().get('/api/settings').catch(function () { return {}; })
    ]).then(function (p) {
      patients = p[0].data || [];
      treatments = A().parseJson(p[1].treatments, []) || [];
      if (!Array.isArray(treatments)) treatments = [];
      if (state.patientId) {
        var found = patients.filter(function (x) { return x.id === state.patientId; })[0];
        if (found) state.patientName = patientPickLabel(found).title;
      }
      paint();
    });
  }

  /* ── Appointments ───────────────────────────────────────────────────── */
  function appointments() {
    var root = page();
    var view = A().qs('view') || 'today';
    if (view === 'day' || view === 'agenda') view = 'today';
    if (view === 'week' || view === 'calendar') view = 'upcoming';
    if (view === 'month' || view === 'list') view = 'past';
    if (view !== 'today' && view !== 'upcoming' && view !== 'past') view = 'today';
    root.innerHTML =
      pageHead('Appointments', 'The list companion to Calendar — confirm, follow up and open a visit without leaving the page.',
        '<button type="button" class="dma-btn dma-btn-ghost cos-filter-toggle" id="ap-filter-btn" aria-label="Filters" aria-expanded="false">Filters</button>' +
        '<button type="button" class="dma-btn dma-btn-primary" id="ap-new">+ New appointment</button>',
        'Appointments') +
      '<div class="dma-tabs" id="ap-views"></div>' +
      '<div class="cos-filter-sheet-bg" id="ap-filter-bg"></div>' +
      '<div class="cos-filterbar" id="ap-filters">' +
        '<select id="f-st" aria-label="Status"><option value="">All statuses</option><option>PENDING</option><option>CONFIRMED</option><option>ARRIVED</option><option value="WAITING">WAITING</option><option value="CALLED">CALLED</option><option>IN_PROGRESS</option><option>COMPLETED</option><option>CANCELLED</option><option>NO_SHOW</option><option>RESCHEDULED</option></select>' +
        '<select id="f-pay" aria-label="Payment"><option value="">Payment</option><option value="fee">Fee recorded</option><option value="none">No fee</option></select>' +
        '<input type="date" id="f-date" aria-label="Date">' +
        disabledFilter('doctor') + disabledFilter('location') +
      '</div>' +
      '<div id="ap-body">' + skel() + '</div>';

    var views = [['today', 'Today'], ['upcoming', 'Upcoming'], ['past', 'Past']];
    function drawTabs() {
      el('ap-views').innerHTML = views.map(function (v) {
        return '<button type="button" role="tab" aria-selected="' + (view === v[0] ? 'true' : 'false') + '" data-v="' + v[0] + '" class="' + (view === v[0] ? 'active' : '') + '">' + v[1] + '</button>';
      }).join('');
    }
    drawTabs();
    if (global.DmaUI && DmaUI.bindTablist) DmaUI.bindTablist(el('ap-views'));
    el('ap-views').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      view = b.getAttribute('data-v');
      A().setQs({ view: view }, true);
      drawTabs(); load();
    };
    el('ap-new').onclick = function () { bookWizard(A().qs('patient')); };
    if (el('ap-filter-btn')) {
      el('ap-filter-btn').onclick = function () {
        var open = el('ap-filters').classList.toggle('is-open');
        el('ap-filter-bg').classList.toggle('is-open', open);
        el('ap-filter-btn').setAttribute('aria-expanded', open ? 'true' : 'false');
      };
      el('ap-filter-bg').onclick = function () {
        el('ap-filters').classList.remove('is-open');
        el('ap-filter-bg').classList.remove('is-open');
      };
    }
    if (A().qs('action') === 'book') bookWizard(A().qs('patient'));

    var cache = [];
    function filtered() {
      var st = el('f-st').value;
      var pay = el('f-pay').value;
      var day = el('f-date').value;
      return cache.filter(function (a) {
        if (st === 'WAITING' || st === 'CALLED') { if (visitOf(a).code !== st) return false; }
        else if (st && statusOf(a) !== st) return false;
        if (pay === 'fee' && !(a.fee > 0)) return false;
        if (pay === 'none' && a.fee) return false;
        if (day) {
          var d = new Date(a.dateTime);
          var want = day.split('-');
          if (d.getFullYear() !== Number(want[0]) || (d.getMonth() + 1) !== Number(want[1]) || d.getDate() !== Number(want[2])) return false;
        }
        return true;
      });
    }

    function bindCards() {
      var rows = filtered();
      el('ap-body').querySelectorAll('[data-open], [data-appt]').forEach(function (n) {
        n.onclick = function (e) {
          if (e.target.closest('button, a, select')) return;
          var id = n.getAttribute('data-open') || n.getAttribute('data-appt');
          var a = rows.filter(function (x) { return x.id === id; })[0];
          if (a) apptDrawer(a, load);
        };
      });
      rows.forEach(function (a) { bindActions(el('ap-body'), a, load); });
    }

    function render() {
      var rows = filtered();
      if (!rows.length) {
        el('ap-body').innerHTML = empty('No appointments scheduled.', 'Your calendar is clear for this period.', '#', 'Create appointment', 'appointments');
        var c = el('ap-body').querySelector('a'); if (c) c.onclick = function (e) { e.preventDefault(); bookWizard(); };
        return;
      }
      el('ap-body').innerHTML = '<div class="cos-appt-list cos-agenda">' + rows.map(apptCard).join('') + '</div>';
      bindCards();
    }

    function load() {
      var filter = view === 'today' ? 'today' : 'month';
      var q = '/api/appointments?limit=100' + (filter ? '&filter=' + filter : '');
      A().get(q).then(function (d) {
        var start = new Date(); start.setHours(0, 0, 0, 0);
        var end = new Date(start); end.setDate(end.getDate() + 1);
        var all = apptList(d);
        if (view === 'upcoming') {
          cache = all.filter(function (a) { return new Date(a.dateTime).getTime() >= end.getTime(); });
        } else if (view === 'past') {
          cache = all.filter(function (a) { return new Date(a.dateTime).getTime() < start.getTime(); });
        } else {
          cache = all;
        }
        if (A().qs('id')) {
          var wanted = cache.filter(function (a) { return a.id === A().qs('id'); })[0];
          if (wanted) apptDrawer(wanted, load);
        }
        render();
      }).catch(function () {
        el('ap-body').innerHTML = errBox("Couldn't load today's appointments.", 'ap-retry');
        el('ap-retry').onclick = load;
      });
    }
    ['f-st', 'f-pay', 'f-date'].forEach(function (id) { el(id).onchange = render; });
    load();
  }

  /* ── Calendar ───────────────────────────────────────────────────────── */
  function calendar() {
    var root = page();
    var mobile = window.matchMedia('(max-width: 900px)').matches;
    var calView = A().qs('view') || (mobile ? 'today' : 'week');
    if (calView !== 'today' && calView !== 'week' && calView !== 'month') calView = mobile ? 'today' : 'week';
    var cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    root.innerHTML =
      pageHead('Schedule', 'Book, reschedule and open visits without leaving the calendar.',
        '<button type="button" class="dma-btn dma-btn-primary" id="cal-new">+ New appointment</button>', 'Calendar') +
      '<div class="cos-cal-toolbar">' +
        '<div class="dma-tabs" id="cal-views" role="tablist"></div>' +
        '<button type="button" class="dma-btn dma-btn-ghost dma-btn-sm" id="cal-prev">Previous</button>' +
        '<button type="button" class="dma-btn dma-btn-ghost dma-btn-sm" id="cal-today">Today</button>' +
        '<button type="button" class="dma-btn dma-btn-ghost dma-btn-sm" id="cal-next">Next</button>' +
        '<strong id="cal-label"></strong>' +
      '</div>' +
      '<div id="cal-body">' + skel() + '</div>';
    var views = [['today', 'Today'], ['week', 'Week'], ['month', 'Month']];
    function drawTabs() {
      el('cal-views').innerHTML = views.map(function (v) {
        return '<button type="button" role="tab" aria-selected="' + (calView === v[0] ? 'true' : 'false') + '" data-v="' + v[0] + '" class="' + (calView === v[0] ? 'active' : '') + '">' + v[1] + '</button>';
      }).join('');
    }
    drawTabs();
    el('cal-new').onclick = function () { bookWizard(A().qs('patient')); };
    el('cal-views').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      calView = b.getAttribute('data-v');
      A().setQs({ view: calView }, true);
      drawTabs();
      paint();
    };
    el('cal-today').onclick = function () { cursor = new Date(); cursor.setHours(0, 0, 0, 0); paint(); };
    el('cal-prev').onclick = function () {
      if (calView === 'month') cursor.setMonth(cursor.getMonth() - 1);
      else if (calView === 'week') cursor.setDate(cursor.getDate() - 7);
      else cursor.setDate(cursor.getDate() - 1);
      paint();
    };
    el('cal-next').onclick = function () {
      if (calView === 'month') cursor.setMonth(cursor.getMonth() + 1);
      else if (calView === 'week') cursor.setDate(cursor.getDate() + 7);
      else cursor.setDate(cursor.getDate() + 1);
      paint();
    };

    var rows = [];
    function dayKey(d) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function itemsOn(key) {
      return rows.filter(function (a) { return String(a.dateTime).slice(0, 10) === key; });
    }
    function bindChips() {
      el('cal-body').querySelectorAll('[data-id], [data-open], [data-appt]').forEach(function (chip) {
        chip.onclick = function (e) {
          if (e.target.closest('button') && !chip.hasAttribute('data-id')) return;
          var id = chip.getAttribute('data-id') || chip.getAttribute('data-open') || chip.getAttribute('data-appt');
          var a = rows.filter(function (x) { return x.id === id; })[0];
          if (a) apptDrawer(a, calendar);
        };
      });
      el('cal-body').querySelectorAll('[data-id][draggable]').forEach(function (chip) {
        chip.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', chip.getAttribute('data-id')); });
      });
      el('cal-body').querySelectorAll('[data-day]').forEach(function (cell) {
        cell.addEventListener('dragover', function (e) { e.preventDefault(); });
        cell.addEventListener('drop', function (e) {
          e.preventDefault();
          var id = e.dataTransfer.getData('text/plain');
          var a = rows.filter(function (x) { return x.id === id; })[0];
          if (!a) return;
          var t = new Date(a.dateTime);
          var day = cell.getAttribute('data-day').split('-');
          var next = new Date(Number(day[0]), Number(day[1]) - 1, Number(day[2]), t.getHours(), t.getMinutes());
          patchAppt(id, { dateTime: next.toISOString() }, 'Moved', calendar);
        });
      });
      rows.forEach(function (a) { bindActions(el('cal-body'), a, calendar); });
    }
    function paint() {
      var label = el('cal-label');
      if (calView === 'today') {
        if (label) label.textContent = A().fmtDate(cursor.toISOString());
        var todayRows = itemsOn(dayKey(cursor));
        el('cal-body').innerHTML = todayRows.length
          ? '<div class="cos-appt-list cos-agenda">' + todayRows.map(apptCard).join('') + '</div>'
          : empty('Nothing booked for this day.', 'Book a visit or check another date.', '#', 'New appointment');
        var cta = el('cal-body').querySelector('a'); if (cta) cta.onclick = function (e) { e.preventDefault(); bookWizard(); };
      } else if (calView === 'week') {
        var start = new Date(cursor);
        start.setDate(cursor.getDate() - start.getDay());
        if (label) label.textContent = A().fmtDate(start.toISOString()) + ' – ' + A().fmtDate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6).toISOString());
        var html = '<div class="cos-week">';
        for (var i = 0; i < 7; i++) {
          var day = new Date(start); day.setDate(start.getDate() + i);
          var key = dayKey(day);
          var items = itemsOn(key);
          html += '<div class="cos-week-col' + (day.toDateString() === new Date().toDateString() ? ' is-today' : '') + '" data-day="' + key + '"><h4>' + day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }) + '</h4>' +
            (items.length ? items.map(function (a) {
              return '<button type="button" class="cos-cal-chip" draggable="true" data-id="' + esc(a.id) + '">' + A().fmtTime(a.dateTime) + ' ' + esc((a.patient && a.patient.fullName) || '') + '</button>';
            }).join('') : '<p class="dma-hint">—</p>') + '</div>';
        }
        html += '</div>';
        el('cal-body').innerHTML = html;
      } else {
        var y = cursor.getFullYear(); var m = cursor.getMonth();
        if (label) label.textContent = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        var first = new Date(y, m, 1);
        var startM = new Date(first); startM.setDate(1 - first.getDay());
        var htmlM = '<div class="cos-cal">';
        for (var j = 0; j < 42; j++) {
          var dayM = new Date(startM); dayM.setDate(startM.getDate() + j);
          var keyM = dayKey(dayM);
          var itemsM = itemsOn(keyM);
          var out = dayM.getMonth() !== m;
          htmlM += '<div class="cos-cal-day' + (out ? ' is-out' : '') + (dayM.toDateString() === new Date().toDateString() ? ' is-today' : '') + '" data-day="' + keyM + '">' +
            '<h4>' + dayM.getDate() + '</h4>' + itemsM.map(function (a) {
              return '<span class="cos-cal-chip" draggable="true" data-id="' + esc(a.id) + '">' + A().fmtTime(a.dateTime) + ' ' + esc((a.patient && a.patient.fullName) || '') + '</span>';
            }).join('') + '</div>';
        }
        htmlM += '</div>';
        el('cal-body').innerHTML = htmlM;
      }
      bindChips();
    }
    A().get('/api/appointments?filter=month&limit=200').then(function (d) {
      rows = apptList(d);
      paint();
    }).catch(function () {
      el('cal-body').innerHTML = errBox('Calendar could not load.', 'cal-retry');
      el('cal-retry').onclick = calendar;
    });
  }

  /* ── Waiting room ───────────────────────────────────────────────────── */
  function waitCard(a, idx) {
    var p = a.patient || {};
    var vis = visitOf(a);
    return '<article class="cos-queue-row">' +
      (idx != null ? '<span class="cos-queue-num">' + String(idx + 1).padStart(2, '0') + '</span>' : '') +
      '<div style="flex:1;min-width:0"><strong>' + esc(p.fullName || 'Patient') + '</strong>' +
      '<div class="dma-hint">' + esc(a.treatment || 'Visit') + '</div></div>' +
      A().chip(vis.label) +
      '<span class="dma-hint">' + A().fmtTime(a.dateTime) + '</span>' +
      '<div class="cos-appt-actions">' + actionButtons(a) + '</div></article>';
  }

  function waiting() {
    var root = page();
    root.innerHTML = pageHead('Waiting room', 'Patients who have arrived, been called, or are in consultation.',
      '<a class="dma-btn dma-btn-primary" href="/dashboard/appointments/?action=book">+ Walk-in</a>') +
      '<div id="w-body">' + skel() + '</div>';
    function load() {
      A().get('/api/appointments?filter=today&limit=80').then(function (d) {
        var rows = apptList(d);
        var cols = { WAITING: [], CALLED: [], IN_PROGRESS: [], COMPLETED: [] };
        rows.forEach(function (a) {
          var code = visitOf(a).code;
          var st = statusOf(a);
          if (code === 'WAITING' || st === 'ARRIVED') cols.WAITING.push(a);
          else if (code === 'CALLED') cols.CALLED.push(a);
          else if (st === 'IN_PROGRESS' || code === 'IN_PROGRESS') cols.IN_PROGRESS.push(a);
          else if (st === 'COMPLETED') cols.COMPLETED.push(a);
        });
        var queue = cols.WAITING.concat(cols.CALLED, cols.IN_PROGRESS);
        var total = queue.length + cols.COMPLETED.length;
        if (!total) {
          el('w-body').innerHTML = empty('No one is waiting.', 'Check in a confirmed visit from Appointments when a patient arrives.', '/dashboard/appointments/', 'Appointments', 'appointments');
          return;
        }
        el('w-body').innerHTML =
          (queue.length
            ? '<div class="cos-wait-queue">' + queue.map(function (a, i) { return waitCard(a, i); }).join('') + '</div>'
            : '<p class="dma-hint">No one is in the queue. Completed visits are below.</p>') +
          (cols.COMPLETED.length
            ? '<h2 class="dma-h3">Completed today</h2><div class="cos-wait-queue">' + cols.COMPLETED.map(function (a, i) { return waitCard(a, i); }).join('') + '</div>'
            : '');
        rows.forEach(function (a) { bindActions(el('w-body'), a, load); });
      }).catch(function () {
        el('w-body').innerHTML = errBox('Waiting room could not load.', 'w-retry');
        el('w-retry').onclick = load;
      });
    }
    load();
  }

  /* ── Patients ───────────────────────────────────────────────────────── */
  function patients() {
    var root = page();
    var filter = 'all';
    root.innerHTML = pageHead('Patients', "Search and manage your clinic's patient records.",
      '<button type="button" class="dma-btn dma-btn-primary" id="pt-add">+ New patient</button>', 'Patients') +
      '<div class="cos-pt-toolbar"><input class="dma-search" id="pt-search" placeholder="Search patients..." aria-label="Search patients">' +
      '<div class="dma-tabs" id="pt-filters" role="tablist">' +
        '<button type="button" data-f="all" class="active">All</button>' +
        '<button type="button" data-f="active">Active</button>' +
        '<button type="button" data-f="recent">Recent</button>' +
      '</div></div>' +
      '<div id="pt-body">' + skel() + '</div>';
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
        el('pt-body').innerHTML = empty('No patients yet.', 'Add a chart, or they will appear from WhatsApp leads.', '#', 'New patient');
        var c = el('pt-body').querySelector('a'); if (c) c.onclick = function (e) { e.preventDefault(); addPt(); };
        return;
      }
      if (!list.length) {
        el('pt-body').innerHTML = '<p class="dma-hint">No patients match this filter.</p>';
        return;
      }
      el('pt-body').innerHTML = '<div class="dma-table-wrap"><table class="dma-table dma-table--patients"><thead><tr><th>Patient</th><th>Contact</th><th>Last visit</th><th>Next appointment</th></tr></thead><tbody>' +
        list.map(function (p) {
          var i = rows.indexOf(p);
          var last = (p.appointments && p.appointments[0]) || {};
          var when = last.dateTime ? new Date(last.dateTime).getTime() : 0;
          var lastLabel = when && when < Date.now() ? A().fmtDate(last.dateTime) : '—';
          var nextLabel = when && when >= Date.now() ? A().fmtDate(last.dateTime) : '—';
          return '<tr data-i="' + i + '"><td><strong>' + esc(p.fullName) + '</strong></td><td>' + esc(p.phone || p.email || '—') + '</td><td>' + lastLabel + '</td><td>' + nextLabel + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      el('pt-body').querySelectorAll('[data-i]').forEach(function (tr) {
        tr.onclick = function () {
          var p = rows[Number(tr.getAttribute('data-i'))];
          if (p && global.DmaPages && DmaPages.openPatientDrawer) DmaPages.openPatientDrawer(p);
          else if (p) A().goto('/dashboard/patients/detail/?id=' + p.id);
        };
      });
    }
    function load(q) {
      A().get('/api/patients?limit=80' + (q ? '&search=' + encodeURIComponent(q) : '')).then(function (d) {
        rows = d.data || [];
        paint();
      }).catch(function () {
        el('pt-body').innerHTML = errBox('Patients could not load.', 'pt-retry');
        el('pt-retry').onclick = function () { load(); };
      });
    }
    function addPt() {
      A().modal('New patient',
        '<div class="dma-field"><label for="np-name">Full name</label><input id="np-name" required aria-required="true"></div>' +
        '<div class="dma-field"><label for="np-phone">Phone</label><input id="np-phone" required aria-required="true"></div>' +
        '<div class="dma-field"><label for="np-email">Email</label><input id="np-email" type="email"></div>',
        '<button class="dma-btn dma-btn-ghost" data-close>Cancel</button><button class="dma-btn dma-btn-primary" id="np-save">Save</button>'
      );
      el('np-save').onclick = function () {
        A().post('/api/patients', { fullName: el('np-name').value, phone: el('np-phone').value, email: el('np-email').value || undefined }).then(function (r) {
          if (!r.ok) { A().toast(failMsg(r, "Couldn't add this patient."), 'err'); return; }
          A().closeModal(); A().toast('Patient added', 'ok'); load();
          if (r.d && global.DmaPages && DmaPages.openPatientDrawer) DmaPages.openPatientDrawer(r.d);
        });
      };
    }
    el('pt-add').onclick = addPt;
    el('pt-filters').onclick = function (e) {
      var b = e.target.closest('[data-f]'); if (!b) return;
      filter = b.getAttribute('data-f');
      el('pt-filters').querySelectorAll('button').forEach(function (x) { x.classList.toggle('active', x === b); });
      paint();
    };
    var t;
    el('pt-search').oninput = function () {
      clearTimeout(t); var v = el('pt-search').value;
      t = setTimeout(function () { load(v); }, 250);
    };
    load();
    if (A().qs('action') === 'new') addPt();
  }

  /* ── Patient profile ────────────────────────────────────────────────── */
  function patient() {
    var id = A().qs('id');
    var root = page();
    if (!id) { root.innerHTML = empty('Select a patient', 'Open the list to view a chart.', '/dashboard/patients/', 'Patients'); return; }
    root.innerHTML = skel();
    Promise.all([
      A().get('/api/patients/' + id),
      A().get('/api/patients/' + id + '/appointments').catch(function () { return []; }),
      A().get('/api/patients/' + id + '/messages').catch(function () { return []; })
    ]).then(function (parts) {
      var p = parts[0];
      var appts = Array.isArray(parts[1]) ? parts[1] : (parts[1].data || []);
      var msgs = Array.isArray(parts[2]) ? parts[2] : (parts[2].data || []);
      var tab = A().qs('tab') || 'overview';
      var next = appts.filter(function (a) { return new Date(a.dateTime) >= new Date() && statusOf(a) !== 'CANCELLED'; })[0];
      var last = appts.filter(function (a) { return statusOf(a) === 'COMPLETED'; })[0];
      var tabs = [
        ['overview', 'Overview'], ['clinical', 'Clinical'], ['visits', 'Visits'], ['appointments', 'Appointments'],
        ['prescriptions', 'Prescriptions'], ['medications', 'Medications'], ['lab', 'Lab Results'], ['documents', 'Documents'],
        ['billing', 'Billing'], ['payments', 'Payments'], ['insurance', 'Insurance'], ['communication', 'Communication'],
        ['notes', 'Notes'], ['audit', 'Audit']
      ];
      function draw() {
        root.innerHTML =
          '<p class="dma-hint"><a href="/dashboard/patients/">← Patients</a></p>' +
          '<div class="cos-profile-hero"><div class="dma-avatar">' + A().initials(p.fullName) + '</div><div style="flex:1">' +
          '<span class="ds-pill">Patient</span><h1 style="margin:6px 0 4px">' + esc(p.fullName) + '</h1>' +
          '<p class="dma-hint">ID ' + esc(p.id.slice(-8)) + ' · Age ' + ageOf(p.dateOfBirth) + ' · ' + esc(p.gender || '—') + ' · ' + A().chip(p.isActive === false ? 'Inactive' : 'Active') + '</p></div>' +
          '<div class="dma-head-actions">' +
            '<a class="dma-btn dma-btn-ghost" href="/dashboard/appointments/?action=book&patient=' + esc(p.id) + '">Appointment</a>' +
            ((Clin() && Clin().canChart()) ? '<a class="dma-btn dma-btn-ghost" href="/dashboard/clinical/?patient=' + esc(p.id) + '">Consult</a>' : '') +
            '<a class="dma-btn dma-btn-ghost" href="/dashboard/messages/?patient=' + esc(p.id) + '">Message</a>' +
            ((Clin() && Clin().canPrescribe()) ? '<a class="dma-btn dma-btn-primary" href="/dashboard/prescriptions/?patient=' + esc(p.id) + '">Prescription</a>' : '') +
          '</div></div>' +
          (p.allergies ? '<div class="dma-alert">Allergy alert: ' + esc(p.allergies) + '</div>' : '') +
          '<div class="dma-tabs" id="pt-tabs" role="tablist" aria-label="Patient record">' + tabs.map(function (t) {
            return '<button type="button" role="tab" aria-selected="' + (tab === t[0] ? 'true' : 'false') + '" data-t="' + t[0] + '" class="' + (tab === t[0] ? 'active' : '') + '">' + t[1] + '</button>';
          }).join('') + '</div><div id="pt-pane" role="tabpanel"></div>';
        var pane = el('pt-pane');
        var none = function (label) {
          return unavailable(label, 'This clinic does not store ' + label.toLowerCase() + ' as a separate module. Record visit notes on the consultation, or keep allergies and history on the patient chart.', '/dashboard/clinical/?patient=' + p.id, 'Open consultation');
        };
        if (tab === 'overview') {
          pane.innerHTML = '<div class="dma-grid-2">' +
            section('Basic information', kv([['Name', p.fullName], ['Phone', p.phone], ['Email', p.email], ['DOB', p.dateOfBirth ? A().fmtDate(p.dateOfBirth) : '—'], ['Gender', p.gender], ['Blood group', p.bloodGroup]])) +
            section('Emergency contact', kv([['Name', p.emergencyName], ['Phone', p.emergencyPhone]])) +
            section('Allergies', '<p>' + esc(p.allergies || 'None recorded.') + '</p>') +
            section('Conditions / notes', '<p>' + esc(p.medicalNotes || 'No conditions recorded.') + '</p>') +
            section('Upcoming', next ? apptCard(next) : '<p class="dma-hint">No upcoming visit.</p>') +
            section('Last visit', last ? apptCard(last) : '<p class="dma-hint">No completed visit yet.</p>') +
            '</div>';
        } else if (tab === 'clinical' || tab === 'visits') {
          var entries = Clin() && Clin().timelineEntries ? Clin().timelineEntries(Clin().listEncounters(appts)) : [];
          pane.innerHTML = entries.length ? '<div class="cos-timeline-med cos-card--timeline">' + entries.map(function (e) {
            return '<details class="cos-tl-item"><summary><strong>' + A().fmtDate(e.date) + '</strong> · ' + esc(e.type) +
              '<span class="dma-hint"> · ' + esc(e.practitioner) + '</span></summary>' +
              '<div class="cos-tl-body">' +
              (e.hasClinical
                ? (e.complaint ? '<p>Chief complaint: ' + esc(e.complaint) + '</p>' : '') +
                  (e.vitals ? '<p>Vitals recorded on this visit.</p>' : '') +
                  (e.diagnosis ? '<p>Diagnosis: ' + esc(e.diagnosis) + '</p>' : '') +
                  (e.notes ? '<p>Notes: ' + esc(e.notes) + '</p>' : '') +
                  (e.prescriptions && e.prescriptions.length ? '<p>Prescription: ' + esc(e.prescriptions.join(', ')) + '</p>' : '') +
                  (e.labs && e.labs.length ? '<p>Lab: ' + esc(e.labs.join(', ')) + '</p>' : '') +
                  (e.followUp ? '<p>Follow-up: ' + esc(e.followUp) + '</p>' : '')
                : '<p>No clinical notes saved for this visit.</p>') +
              '</div></details>';
          }).join('') + '</div>' : empty('No encounters yet', 'Book a visit to start the clinical timeline.', '/dashboard/appointments/?action=book&patient=' + p.id, 'Book', 'clinical');
        } else if (tab === 'appointments') {
          pane.innerHTML = appts.length ? appts.map(apptCard).join('') : empty('No appointments', 'Schedule the first visit.', '/dashboard/appointments/?action=book&patient=' + p.id, 'Book');
        } else if (tab === 'communication') {
          pane.innerHTML = msgs.length ? msgs.map(function (m) {
            return '<div class="dma-row-item"><div><div class="name">' + (m.direction === 'INBOUND' ? 'Patient' : 'Clinic') + '</div><div class="sub">' + esc((m.body || '').slice(0, 160)) + '</div></div></div>';
          }).join('') : empty('No messages yet', 'WhatsApp threads appear here after the clinic is connected.', '/dashboard/messages/?patient=' + p.id, 'Inbox');
        } else if (tab === 'notes') {
          pane.innerHTML = '<div class="dma-field"><label>Chart notes</label><textarea id="pn" rows="8">' + esc(p.medicalNotes || '') + '</textarea></div><button class="dma-btn dma-btn-primary" id="pn-save">Save notes</button>';
          el('pn-save').onclick = function () {
            A().patch('/api/patients/' + p.id, { medicalNotes: el('pn').value }).then(function (r) {
              if (r.ok) A().toast('Notes saved', 'ok'); else A().toast(failMsg(r, "Couldn't save notes."), 'err');
            });
          };
        } else if (tab === 'audit') {
          pane.innerHTML = '<p class="dma-hint">Created ' + A().fmtDate(p.createdAt) + '. Full PHI audit trails are not a separate module on this platform.</p>';
        } else if (tab === 'payments' || tab === 'billing') {
          var fees = appts.filter(function (a) { return a.fee; });
          pane.innerHTML = fees.length ? fees.map(function (a) {
            return '<div class="dma-row-item"><div class="name">' + esc(a.treatment) + ' · ' + feeLabel(a) + '</div><div class="meta">' + A().fmtDate(a.dateTime) + '</div></div>';
          }).join('') + '<p class="dma-hint">These are visit fees on appointments — not patient AR invoices.</p>'
            : empty('No visit fees recorded', 'Fees can be added when booking or completing a visit.', '/dashboard/appointments/?action=book&patient=' + p.id, 'Book');
        } else {
          pane.innerHTML = none(tabs.filter(function (t) { return t[0] === tab; })[0][1]);
        }
        el('pt-tabs').onclick = function (e) {
          var b = e.target.closest('button'); if (!b) return;
          tab = b.getAttribute('data-t'); A().setQs({ tab: tab, id: p.id }, true); draw();
        };
        if (global.DmaUI && DmaUI.bindTablist) DmaUI.bindTablist(el('pt-tabs'));
      }
      draw();
    }).catch(function () {
      root.innerHTML = empty('Patient not found', 'They may have been removed.', '/dashboard/patients/', 'Back');
    });
  }

  function section(title, body) {
    return '<section class="dma-section"><header class="dma-section-h"><h2>' + title + '</h2></header><div class="dma-section-b">' + body + '</div></section>';
  }
  function kv(rows) {
    return rows.map(function (r) { return '<div class="dma-field"><label>' + esc(r[0]) + '</label><div>' + esc(r[1] || '—') + '</div></div>'; }).join('');
  }

  /* ── Clinical / consult / vitals / Rx ───────────────────────────────── */
  function loadVisit(cb) {
    var id = A().qs('id');
    var pid = A().qs('patient');
    var q = id ? A().get('/api/appointments/' + id) : A().get('/api/appointments?filter=today&limit=40').then(function (d) {
      var rows = apptList(d);
      if (pid) rows = rows.filter(function (a) { return a.patientId === pid; });
      return rows[0];
    });
    q.then(function (a) {
      if (!a || a.error) { cb(null); return; }
      cb(a);
    }).catch(function () { cb(null); });
  }

  function consultForm(a, mode) {
    var enc = encounterOf(a);
    var note = enc.clinicalNote || {};
    var v = enc.vitals || {};
    var dx = (enc.diagnoses && enc.diagnoses[0] && enc.diagnoses[0].text) || '';
    var root = page();
    var canEdit = Clin() ? Clin().canChart() : identity() === 'OWNER';
    var canRx = Clin() ? Clin().canPrescribe() : identity() === 'OWNER';
    if (!canEdit && mode !== 'rx') {
      root.innerHTML = pageHead('Clinical', 'This workspace is limited to clinical staff.', '', 'Care') +
        unavailable('Clinical editing is restricted', 'Reception and assistant roles can check patients in, but they cannot record vitals or encounter notes.', '/dashboard/appointments/', 'Appointments');
      return;
    }
    if (mode === 'rx' && !canRx) {
      root.innerHTML = pageHead('Prescriptions', 'Issuing prescriptions is limited to the clinic practitioner.', '', 'Care') +
        unavailable('Prescriptions are restricted', 'Ask a clinician to issue the visit prescription.', '/dashboard/clinical/', 'Clinical');
      return;
    }
    var title = mode === 'vitals' ? 'Vitals' : mode === 'rx' ? 'Prescription' : 'Consultation';
    var kicker = mode === 'vitals' ? 'Clinical' : 'Visit';
    var pName = enc.patient.name || 'Patient';
    var alerts = [];
    if (enc.patient.allergies) alerts.push('Allergy: ' + enc.patient.allergies);
    var hasVitals = Clin() && Clin().vitalsHasData(v);
    var vitalsFields = [['bp', 'Blood pressure'], ['hr', 'Heart rate'], ['temp', 'Temperature'], ['rr', 'Respiratory rate'], ['spo2', 'SpO2'], ['weight', 'Weight'], ['height', 'Height'], ['pain', 'Pain score']].map(function (f) {
      return '<div class="dma-field"><label for="v-' + f[0] + '">' + f[1] + '</label><input id="v-' + f[0] + '" value="' + esc(v[f[0]] || '') + '"></div>';
    }).join('') + '<div class="dma-field"><label for="v-bmi">BMI</label><input id="v-bmi" readonly value="' + esc(v.bmi || '') + '"></div>';
    var showVitals = mode === 'vitals' || mode === 'consult';
    var showConsult = mode === 'consult';
    var showRx = (mode === 'consult' && canRx) || mode === 'rx';
    root.innerHTML =
      '<div class="cos-consult">' +
      pageHead(title, pName + (a.treatment ? ' · ' + a.treatment : ''), '', kicker) +
      '<div class="cos-profile-hero"><div class="dma-avatar">' + A().initials(pName) + '</div><div style="flex:1"><span class="ds-pill">Patient</span>' +
      '<h2 style="margin:6px 0">' + esc(pName) + '</h2><p class="dma-hint">' + esc(a.treatment || 'Visit') + ' · ' + A().chip(visitOf(a).label) +
      (enc.patient.age ? ' · Age ' + ageOf(enc.patient.age) : '') + '</p></div></div>' +
      (alerts.length ? '<div class="cos-card cos-card--alert" role="status">' + esc(alerts.join(' · ')) + '</div>' : '') +
      (showConsult
        ? '<div class="cos-consult-grid">' +
            '<div>' +
              '<div class="dma-section"><header class="dma-section-h"><h2>Reason for visit</h2></header><div class="dma-section-b"><div class="dma-field"><label for="c-complaint">Chief complaint</label><textarea id="c-complaint" rows="2">' + esc(note.complaint || '') + '</textarea></div></div></div>' +
              '<div class="dma-section"><header class="dma-section-h"><h2>History</h2></header><div class="dma-section-b"><div class="dma-field"><label for="c-history" class="dma-sr">History</label><textarea id="c-history" rows="3">' + esc(note.history || '') + '</textarea></div></div></div>' +
              '<div class="dma-section"><header class="dma-section-h"><h2>Examination</h2></header><div class="dma-section-b"><div class="dma-field"><label for="c-exam" class="dma-sr">Examination</label><textarea id="c-exam" rows="3">' + esc(note.exam || '') + '</textarea></div></div></div>' +
              '<div class="dma-section"><header class="dma-section-h"><h2>Assessment</h2></header><div class="dma-section-b"><div class="dma-field"><label for="c-assessment" class="dma-sr">Assessment</label><textarea id="c-assessment" rows="3">' + esc(note.assessment || '') + '</textarea></div><div class="dma-field"><label for="c-treatment">Plan</label><textarea id="c-treatment" rows="2">' + esc(note.treatment || '') + '</textarea></div></div></div>' +
            '</div><div>' +
              (showVitals ? '<div class="dma-section"><header class="dma-section-h"><h2>Vitals</h2></header><div class="dma-section-b"><div class="cos-vitals-now">' + vitalsFields + '</div><div id="prev-vitals"></div></div></div>' : '') +
              '<div class="dma-section"><header class="dma-section-h"><h2>Diagnosis</h2></header><div class="dma-section-b"><div class="dma-field"><label for="c-diagnosis" class="dma-sr">Diagnosis</label><textarea id="c-diagnosis" rows="3">' + esc(dx) + '</textarea></div></div></div>' +
              (showRx ? '<div class="dma-section"><header class="dma-section-h"><h2>Prescription</h2><button type="button" class="dma-btn dma-btn-ghost dma-btn-sm" id="rx-add">+ Add medicine</button></header><div class="dma-section-b" id="rx-list"></div></div>' : '') +
              '<div class="dma-section"><header class="dma-section-h"><h2>Lab & follow-up</h2></header><div class="dma-section-b"><div class="dma-field"><label for="c-labs">Lab</label><textarea id="c-labs" rows="2">' + esc((enc.labOrders || []).join(', ')) + '</textarea><p class="dma-hint">Orders are recorded on the visit. There is no instrument feed.</p></div><div class="dma-field"><label for="c-followup">Follow-up</label><textarea id="c-followup" rows="2">' + esc((enc.followUp && enc.followUp.note) || '') + '</textarea></div></div></div>' +
            '</div></div>'
        : (showVitals ? '<div class="dma-section"><header class="dma-section-h"><h2>Current vitals</h2></header><div class="dma-section-b">' +
            (hasVitals ? '' : '<p class="dma-hint">No vitals recorded for this visit.</p>') +
            '<div class="cos-vitals-now">' + vitalsFields + '</div><div id="prev-vitals"></div></div></div>' : '') +
          (showRx ? '<div class="dma-section"><header class="dma-section-h"><h2>Prescription</h2><p class="dma-hint">' + esc(pName) + '</p><button type="button" class="dma-btn dma-btn-ghost dma-btn-sm" id="rx-add">+ Add medicine</button></header><div class="dma-section-b" id="rx-list"></div></div>' : '')) +
      '<div class="cos-consult-bar">' +
        '<span class="cos-save-state" id="c-save-state" role="status" aria-live="polite"></span>' +
        '<button type="button" class="dma-btn dma-btn-ghost" id="c-draft">Save draft</button>' +
        '<button type="button" class="dma-btn dma-btn-primary" id="c-done">' + (mode === 'rx' ? 'Save prescription' : mode === 'vitals' ? 'Save vitals' : 'Complete visit') + '</button>' +
      '</div></div>';

    if (el('c-tabs')) {
      el('c-tabs').onclick = function (e) {
        var b = e.target.closest('[data-c]'); if (!b) return;
        var id = b.getAttribute('data-c');
        el('c-tabs').querySelectorAll('[data-c]').forEach(function (x) {
          x.classList.toggle('active', x === b);
          x.setAttribute('aria-selected', x === b ? 'true' : 'false');
        });
        root.querySelectorAll('.ds-c-panel').forEach(function (p) {
          p.hidden = p.getAttribute('data-c') !== id;
        });
      };
      if (global.DmaUI && DmaUI.bindTablist) DmaUI.bindTablist(el('c-tabs'));
    }

    var rx = (enc.prescriptions || []).slice();
    function drawRx() {
      var box = el('rx-list'); if (!box) return;
      box.innerHTML = rx.length ? '<div class="cos-rx-head dma-hint">Medication · Strength · Dose · Frequency · Duration</div>' + rx.map(function (item, i) {
        return '<div class="cos-rx-row"><strong>' + esc(item.medication || 'Medication') + '</strong><span>' + esc(item.strength || '—') + '</span><span>' + esc(item.dosage || '—') + '</span><span>' + esc(item.frequency || '—') + '</span><span>' + esc(item.duration || '—') + '</span>' +
          '<span><button type="button" class="dma-btn dma-btn-ghost dma-btn-sm" data-dup="' + i + '">Duplicate</button> ' +
          '<button type="button" class="dma-btn dma-btn-danger dma-btn-sm" data-del="' + i + '">Remove</button></span></div>';
      }).join('') : empty('No medications on this draft.', 'Add a medication to this visit chart.', '', '', 'clinical');
      box.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { rx.splice(Number(b.getAttribute('data-del')), 1); drawRx(); }; });
      box.querySelectorAll('[data-dup]').forEach(function (b) { b.onclick = function () { rx.push(Object.assign({}, rx[Number(b.getAttribute('data-dup'))])); drawRx(); }; });
    }
    drawRx();
    if (el('rx-add')) el('rx-add').onclick = function () {
      A().modal('Add medication',
        ['medication:Medication', 'strength:Strength', 'route:Route', 'frequency:Frequency', 'dosage:Dose', 'duration:Duration', 'quantity:Quantity', 'instructions:Instructions', 'refills:Refills'].map(function (f) {
          var k = f.split(':');
          return '<div class="dma-field"><label for="rx-' + k[0] + '">' + k[1] + '</label><input id="rx-' + k[0] + '"></div>';
        }).join(''),
        '<button class="dma-btn dma-btn-ghost" data-close>Cancel</button><button class="dma-btn dma-btn-primary" id="rx-ok">Add</button>'
      );
      el('rx-ok').onclick = function () {
        var item = {};
        ['medication', 'strength', 'route', 'frequency', 'dosage', 'duration', 'quantity', 'instructions', 'refills'].forEach(function (k) {
          item[k] = el('rx-' + k).value;
        });
        if (!item.medication) { A().toast('Medication is required.', 'err'); return; }
        rx.push(item); A().closeModal(); drawRx();
      };
    };

    if (el('prev-vitals') && enc.patient.id) {
      A().get('/api/patients/' + enc.patient.id + '/appointments').then(function (list) {
        var rows = Array.isArray(list) ? list : (list.data || []);
        var prev = Clin() ? Clin().previousVitals(Clin().listEncounters(rows), enc.id) : [];
        if (!prev.length) return;
        el('prev-vitals').innerHTML = '<h3 class="dma-hint">Previous vitals</h3>' + prev.slice(0, 3).map(function (e) {
          var keys = Object.keys(e.vitals || {}).filter(function (k) { return e.vitals[k]; });
          return '<p class="dma-hint">' + A().fmtDate(e.appointment && e.appointment.dateTime) + ' · ' + esc(keys.map(function (k) { return k + ' ' + e.vitals[k]; }).join(', ')) + '</p>';
        }).join('');
      }).catch(function () {});
    }

    function collect() {
      var vitals = {};
      ['bp', 'hr', 'temp', 'rr', 'spo2', 'weight', 'height', 'pain'].forEach(function (k) {
        var n = el('v-' + k); if (n) vitals[k] = n.value;
      });
      var w = parseFloat(vitals.weight); var h = parseFloat(vitals.height);
      if (w && h) vitals.bmi = (h > 3 ? (w / Math.pow(h / 100, 2)) : (w / (h * h))).toFixed(1);
      if (el('v-bmi') && vitals.bmi) el('v-bmi').value = vitals.bmi;
      return {
        vitals: Object.keys(vitals).length ? vitals : enc.vitals,
        clinicalNote: {
          complaint: val('c-complaint'), history: val('c-history'), exam: val('c-exam'),
          diagnosis: val('c-diagnosis'), assessment: val('c-assessment'), treatment: val('c-treatment'),
          followup: val('c-followup')
        },
        prescriptions: rx,
        labOrders: val('c-labs') ? val('c-labs').split(',').map(function (s) { return s.trim(); }).filter(Boolean) : (enc.labOrders || []),
        draft: true,
        freeText: note.freeText || ''
      };
    }
    function val(id) { return el(id) ? el(id).value : ''; }
    function setSave(text) { if (el('c-save-state')) el('c-save-state').textContent = text; }

    function persist(extra, opts, okMsg, thenFn) {
      setSave('Saving…');
      var btn = el('c-draft'); var done = el('c-done');
      if (btn) btn.disabled = true; if (done) done.disabled = true;
      return Clin().saveEncounter(enc, extra, opts).then(function (r) {
        if (btn) btn.disabled = false; if (done) done.disabled = false;
        if (r.ok) {
          setSave('Saved');
          A().toast(okMsg, 'ok');
          if (r.d && r.d.clinical) {
            a = r.d.appointment || a;
            enc = encounterOf(Object.assign({}, a, { clinical: r.d.clinical }));
          } else if (r.d && r.d.id) {
            return Clin().getEncounter(r.d.id).then(function (fresh) { if (fresh) enc = fresh; if (thenFn) thenFn(r); });
          }
          if (thenFn) thenFn(r);
        } else {
          setSave("Couldn't save");
          A().toast(failMsg(r, "Couldn't save the consultation. Please try again."), 'err');
        }
        return r;
      }).catch(function () {
        if (btn) btn.disabled = false; if (done) done.disabled = false;
        setSave("Couldn't save");
        A().toast("Couldn't save the consultation. Please try again.", 'err');
      });
    }

    el('c-draft').onclick = function () {
      var extra = collect();
      extra.draft = true;
      var status = statusOf(a) === 'PENDING' || statusOf(a) === 'CONFIRMED' || statusOf(a) === 'ARRIVED' ? 'IN_PROGRESS' : a.status;
      persist(extra, { status: status }, 'Draft saved');
    };
    el('c-done').onclick = function () {
      if (mode === 'rx' && !window.confirm('Issue this prescription into the visit chart? It is not sent to a pharmacy — ClinicOS does not have e-prescribe.')) return;
      var extra = collect();
      extra.draft = false;
      var nextStatus = mode === 'vitals'
        ? ((statusOf(a) === 'PENDING' || statusOf(a) === 'CONFIRMED') ? 'IN_PROGRESS' : a.status)
        : 'COMPLETED';
      var ok = mode === 'rx' ? 'Prescription saved to chart' : (mode === 'vitals' ? 'Vitals saved' : 'Visit completed');
      persist(extra, { status: nextStatus, complete: true }, ok, function (r) {
        if (r && r.ok) location.href = '/dashboard/appointments/';
      });
    };
  }

  function clinical() {
    loadVisit(function (a) {
      if (!a) {
        page().innerHTML = pageHead('Clinical', 'Open a visit to record the encounter.', '', 'Care') +
          empty('No active visit', 'Start from the waiting room or today’s schedule.', '/dashboard/waiting/', 'Waiting room');
        return;
      }
      consultForm(a, 'consult');
    });
  }
  function vitals() {
    loadVisit(function (a) {
      if (!a) {
        page().innerHTML = pageHead('Vitals', 'Record vitals on today’s visit. Nothing is fabricated.', '', 'Clinical') +
          empty('No visit to chart', 'Check in a patient first.', '/dashboard/waiting/', 'Waiting room');
        return;
      }
      consultForm(a, 'vitals');
    });
  }
  function prescriptions() {
    loadVisit(function (a) {
      if (!a) {
        page().innerHTML = pageHead('Prescriptions', 'Write a prescription on a real visit, then confirm before saving.', '', 'Care') +
          empty('No visit selected', 'Open a patient encounter first.', '/dashboard/appointments/', 'Appointments');
        return;
      }
      consultForm(a, 'rx');
    });
  }

  function laboratory() {
    var root = page();
    root.innerHTML = pageHead('Laboratory', 'Track lab orders from request through results.',
      (Clin() && Clin().canChart()) ? '<button type="button" class="dma-btn dma-btn-primary" id="lab-add">Create lab order</button>' : '', 'Clinical') +
      '<div class="dma-tabs" id="lab-tabs" role="tablist">' +
        '<button type="button" data-lab="orders" class="active">Orders</button>' +
        '<button type="button" data-lab="results">Results</button>' +
      '</div>' +
      '<div id="lab-body">' + skel() + '</div>';
    var labTab = 'orders';
    var labRows = [];
    function paintLab() {
      var rows = labTab === 'results'
        ? labRows.filter(function (r) { return (r.results || []).length; })
        : labRows;
      if (!labRows.length) {
        el('lab-body').innerHTML = empty('No laboratory orders yet.', 'Create an order from a patient visit. Results appear only after they are entered.', '/dashboard/clinical/', 'Open consultation');
        return;
      }
      if (!rows.length) {
        el('lab-body').innerHTML = empty('No results yet.', 'Results appear after they are entered on an order.', '/dashboard/clinical/', 'Open consultation');
        return;
      }
      el('lab-body').innerHTML = '<div class="dma-table-wrap"><table class="dma-table"><thead><tr><th>Order</th><th>Tests</th><th>Status</th><th>Results</th></tr></thead><tbody>' +
        rows.map(function (r) {
          var tests = (r.items || []).map(function (i) { return i.testName; }).join(', ') || '—';
          var res = (r.results || []).map(function (x) { return esc(x.value) + (x.unit ? ' ' + esc(x.unit) : '') + (x.flag ? ' · ' + esc(x.flag) : ''); }).join('; ') || '—';
          return '<tr><td>' + esc((r.id || '').slice(-8)) + '</td><td>' + esc(tests) + '</td><td>' + A().chip(r.status) + '</td><td>' + res + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    function load() {
      A().getFull('/api/lab-orders').then(function (r) {
        if (!r.ok) {
          el('lab-body').innerHTML = errBox('Laboratory unavailable', 'lab-retry');
          el('lab-retry').onclick = load;
          return;
        }
        labRows = (r.d && r.d.data) || [];
        paintLab();
      }).catch(function () {
        el('lab-body').innerHTML = errBox('Laboratory unavailable', 'lab-retry');
        el('lab-retry').onclick = load;
      });
    }
    el('lab-tabs').onclick = function (e) {
      var b = e.target.closest('[data-lab]'); if (!b) return;
      labTab = b.getAttribute('data-lab');
      el('lab-tabs').querySelectorAll('button').forEach(function (x) { x.classList.toggle('active', x === b); });
      paintLab();
    };
    load();
    if (el('lab-add')) el('lab-add').onclick = function () {
      A().goto('/dashboard/clinical/');
      A().toast('Open a visit, then create the lab order there.', 'ok');
    };
  }

  function rooms() {
    var owner = identity() === 'OWNER';
    var root = page();
    root.innerHTML = pageHead('Rooms', 'Rooms you can assign during a visit.',
      owner ? '<button type="button" class="dma-btn dma-btn-primary" id="rm-add">Add room</button>' : '', 'Operations') +
      '<div id="rm-body">' + skel() + '</div>';
    function load() {
      Promise.all([
        A().getFull('/api/rooms'),
        A().getFull('/api/roster')
      ]).then(function (p) {
        if (!p[0] || !p[0].ok) {
          el('rm-body').innerHTML = errBox('Rooms unavailable', 'rm-retry');
          el('rm-retry').onclick = load;
          return;
        }
        var rows = (p[0].d && p[0].d.data) || [];
        var locs = (p[1] && p[1].ok && p[1].d && p[1].d.locations) || [];
        var locName = function (id) {
          var loc = locs.filter(function (l) { return l.id === id; })[0];
          return loc ? loc.name : '—';
        };
        if (!rows.length) {
          el('rm-body').innerHTML = empty('No rooms yet.', 'Add a room when you have a physical space to assign. Appointments still book against working hours.', '#', owner ? 'Add room' : '');
          var c = el('rm-body').querySelector('a'); if (c && owner) c.onclick = function (e) { e.preventDefault(); addRoom(locs); };
          return;
        }
        el('rm-body').innerHTML = '<div class="dma-table-wrap"><table class="dma-table"><thead><tr><th>Room</th><th>Location</th><th>Status</th></tr></thead><tbody>' +
          rows.map(function (r) {
            return '<tr><td><strong>' + esc(r.name) + '</strong></td><td>' + esc(locName(r.locationId)) + '</td><td>' + A().chip(r.status || 'AVAILABLE') + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      }).catch(function () {
        el('rm-body').innerHTML = errBox('Rooms unavailable', 'rm-retry');
        el('rm-retry').onclick = load;
      });
    }
    function addRoom(locs) {
      var locOpts = (locs || []).map(function (l) { return '<option value="' + esc(l.id) + '">' + esc(l.name) + '</option>'; }).join('');
      A().modal('Add room',
        '<div class="dma-field"><label for="rm-name">Name</label><input id="rm-name" required></div>' +
        (locOpts ? '<div class="dma-field"><label for="rm-loc">Location</label><select id="rm-loc"><option value="">—</option>' + locOpts + '</select></div>' : ''),
        '<button class="dma-btn dma-btn-ghost" data-close>Cancel</button><button class="dma-btn dma-btn-primary" id="rm-save">Save</button>'
      );
      el('rm-save').onclick = function () {
        A().post('/api/rooms', { name: el('rm-name').value, locationId: el('rm-loc') ? el('rm-loc').value || undefined : undefined }).then(function (r) {
          if (!r.ok) { A().toast(failMsg(r, "Couldn't add this room."), 'err'); return; }
          A().closeModal(); A().toast('Room added', 'ok'); load();
        });
      };
    }
    if (el('rm-add')) el('rm-add').onclick = function () {
      A().get('/api/roster').then(function (d) { addRoom(d.locations || []); }).catch(function () { addRoom([]); });
    };
    load();
  }

  function telemedicine() {
    var root = page();
    root.innerHTML = pageHead('Telemedicine', 'Session records for remote visits. Clinicos does not host video calls.', '', 'Care') +
      '<div id="tele-body">' + skel() + '</div>';
    A().getFull('/api/tele-sessions').then(function (r) {
      if (!r.ok) {
        el('tele-body').innerHTML = errBox('Telemedicine unavailable', 'tele-retry');
        if (el('tele-retry')) el('tele-retry').onclick = function () { telemedicine(); };
        return;
      }
      var d = r.d || {};
      var rows = d.data || [];
      if (!rows.length) {
        el('tele-body').innerHTML = empty("Telemedicine isn't connected yet.", 'Clinicos stores session records only. Video is not hosted here.');
        return;
      }
      el('tele-body').innerHTML = '<div class="dma-table-wrap"><table class="dma-table"><thead><tr><th>Session</th><th>Provider</th><th>Status</th></tr></thead><tbody>' +
        rows.map(function (row) {
          return '<tr><td>' + esc((row.id || '').slice(-8)) + '</td><td>' + esc(row.provider || '—') + '</td><td>' + A().chip(row.status || 'SCHEDULED') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }).catch(function () {
      el('tele-body').innerHTML = errBox('Telemedicine unavailable', 'tele-retry');
      if (el('tele-retry')) el('tele-retry').onclick = function () { telemedicine(); };
    });
  }

  function inventory() {
    var owner = identity() === 'OWNER';
    var root = page();
    root.innerHTML = pageHead('Inventory', 'Stock recorded for this clinic.',
      owner ? '<button type="button" class="dma-btn dma-btn-primary" id="inv-add">Add item</button>' : '', 'Operations') +
      '<div id="inv-body">' + skel() + '</div>';
    function load() {
      A().getFull('/api/inventory/skus').then(function (r) {
        if (!r.ok) {
          el('inv-body').innerHTML = errBox('Inventory unavailable', 'inv-retry');
          el('inv-retry').onclick = load;
          return;
        }
        var d = r.d || {};
        var rows = d.data || [];
        if (!rows.length) {
          el('inv-body').innerHTML = empty('No inventory items yet.', 'Add an SKU when you need a stock ledger. Quantities will not be invented.', '#', owner ? 'Add item' : '');
          var c = el('inv-body').querySelector('a'); if (c && owner) c.onclick = function (e) { e.preventDefault(); addSku(); };
          return;
        }
        Promise.all(rows.map(function (sku) {
          return A().get('/api/inventory/balance?skuId=' + encodeURIComponent(sku.id)).then(function (b) {
            sku._qty = b.quantity;
            return sku;
          }).catch(function () { sku._qty = '—'; return sku; });
        })).then(function (skus) {
          el('inv-body').innerHTML = '<div class="dma-table-wrap"><table class="dma-table"><thead><tr><th>Item</th><th>Unit</th><th>Quantity</th></tr></thead><tbody>' +
            skus.map(function (s) {
              return '<tr><td><strong>' + esc(s.name) + '</strong></td><td>' + esc(s.unit || 'ea') + '</td><td>' + esc(s._qty) + '</td></tr>';
            }).join('') + '</tbody></table></div>';
        });
      }).catch(function () {
        el('inv-body').innerHTML = errBox('Inventory unavailable', 'inv-retry');
        el('inv-retry').onclick = load;
      });
    }
    function addSku() {
      A().modal('Add item',
        '<div class="dma-field"><label for="sku-name">Name</label><input id="sku-name" required></div>' +
        '<div class="dma-field"><label for="sku-unit">Unit</label><input id="sku-unit" value="ea"></div>',
        '<button class="dma-btn dma-btn-ghost" data-close>Cancel</button><button class="dma-btn dma-btn-primary" id="sku-save">Save</button>'
      );
      el('sku-save').onclick = function () {
        A().post('/api/inventory/skus', { name: el('sku-name').value, unit: el('sku-unit').value || 'ea' }).then(function (r) {
          if (!r.ok) { A().toast(failMsg(r, "Couldn't add this item."), 'err'); return; }
          A().closeModal(); A().toast('Item added', 'ok'); load();
        });
      };
    }
    if (el('inv-add')) el('inv-add').onclick = addSku;
    load();
  }

  function documents() {
    var root = page();
    root.innerHTML = pageHead('Documents', 'Files attached to this clinic.',
      '', 'Care') +
      '<div id="doc-body">' + skel() + '</div>';
    A().get('/api/documents').then(function (d) {
      var rows = d.data || [];
      if (!rows.length) {
        el('doc-body').innerHTML = empty('No documents yet.', 'Upload from a patient chart. Files stay inside this clinic.', '/dashboard/patients/', 'Patients');
        return;
      }
      el('doc-body').innerHTML = '<div class="dma-table-wrap"><table class="dma-table"><thead><tr><th>File</th><th>Type</th><th>Patient</th><th>Date</th><th></th></tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr><td><strong>' + esc(r.filename) + '</strong></td><td>' + A().chip(r.type || 'OTHER') + '</td><td class="dma-hint">' + esc((r.patientId || '').slice(-8)) + '</td><td>' + (r.createdAt ? A().fmtDate(r.createdAt) : '—') + '</td>' +
            '<td><button type="button" class="dma-btn dma-btn-ghost dma-btn-sm" data-doc="' + esc(r.id) + '" data-name="' + esc(r.filename) + '">Download</button></td></tr>';
        }).join('') + '</tbody></table></div>';
      el('doc-body').querySelectorAll('[data-doc]').forEach(function (b) {
        b.onclick = function () {
          var id = b.getAttribute('data-doc');
          var name = b.getAttribute('data-name') || 'file';
          var t = localStorage.getItem('token') || '';
          fetch('/api/documents/' + encodeURIComponent(id) + '/file', {
            credentials: 'include',
            headers: t ? { Authorization: 'Bearer ' + t } : {}
          }).then(function (r) {
            if (!r.ok) throw new Error('download');
            return r.blob().then(function (blob) {
              var a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = name;
              a.click();
              setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
            });
          }).catch(function () { A().toast("Couldn't download that file.", 'err'); });
        };
      });
    }).catch(function () {
      el('doc-body').innerHTML = errBox('Documents could not load.', 'doc-retry');
      el('doc-retry').onclick = documents;
    });
  }

  function leave() {
    var owner = identity() === 'OWNER';
    var root = page();
    root.innerHTML = pageHead('Leave', 'Practitioner time away.',
      owner ? '<button type="button" class="dma-btn dma-btn-primary" id="lv-add">Add leave</button>' : '', 'Operations') +
      '<div id="lv-body">' + skel() + '</div>';
    function load() {
      Promise.all([
        A().get('/api/leave').catch(function () { return { data: [] }; }),
        A().get('/api/roster').catch(function () { return { practitioners: [] }; })
      ]).then(function (p) {
        var rows = (p[0] && p[0].data) || [];
        var practs = (p[1] && p[1].practitioners) || [];
        var pname = function (id) {
          var pr = practs.filter(function (x) { return x.id === id; })[0];
          return pr ? pr.name : 'Practitioner';
        };
        if (!rows.length) {
          el('lv-body').innerHTML = empty('No leave recorded.', 'Add practitioner leave when someone is away. Appointments still follow working hours.', '#', owner ? 'Add leave' : '');
          var c = el('lv-body').querySelector('a'); if (c && owner) c.onclick = function (e) { e.preventDefault(); addLeave(practs); };
          return;
        }
        el('lv-body').innerHTML = '<div class="dma-table-wrap"><table class="dma-table"><thead><tr><th>Practitioner</th><th>From</th><th>To</th><th>Reason</th></tr></thead><tbody>' +
          rows.map(function (r) {
            return '<tr><td>' + esc(pname(r.practitionerId)) + '</td><td>' + (r.startsAt ? A().fmtDate(r.startsAt) : '—') + '</td><td>' + (r.endsAt ? A().fmtDate(r.endsAt) : '—') + '</td><td>' + esc(r.reason || '—') + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      }).catch(function () {
        el('lv-body').innerHTML = errBox('Leave could not load.', 'lv-retry');
        el('lv-retry').onclick = load;
      });
    }
    function addLeave(practs) {
      var opts = (practs || []).map(function (pr) { return '<option value="' + esc(pr.id) + '">' + esc(pr.name) + '</option>'; }).join('');
      if (!opts) { A().toast('Add a practitioner first.', 'err'); return; }
      A().modal('Add leave',
        '<div class="dma-field"><label for="lv-pr">Practitioner</label><select id="lv-pr">' + opts + '</select></div>' +
        '<div class="dma-field"><label for="lv-from">Starts</label><input id="lv-from" type="datetime-local" required></div>' +
        '<div class="dma-field"><label for="lv-to">Ends</label><input id="lv-to" type="datetime-local" required></div>' +
        '<div class="dma-field"><label for="lv-reason">Reason</label><input id="lv-reason"></div>',
        '<button class="dma-btn dma-btn-ghost" data-close>Cancel</button><button class="dma-btn dma-btn-primary" id="lv-save">Save</button>'
      );
      el('lv-save').onclick = function () {
        A().post('/api/leave', {
          practitionerId: el('lv-pr').value,
          startsAt: new Date(el('lv-from').value).toISOString(),
          endsAt: new Date(el('lv-to').value).toISOString(),
          reason: el('lv-reason').value || undefined
        }).then(function (r) {
          if (!r.ok) { A().toast(failMsg(r, "Couldn't save leave."), 'err'); return; }
          A().closeModal(); A().toast('Leave added', 'ok'); load();
        });
      };
    }
    if (el('lv-add')) el('lv-add').onclick = function () {
      A().get('/api/roster').then(function (d) { addLeave(d.practitioners || []); }).catch(function () { addLeave([]); });
    };
    load();
  }

  function locations() {
    var owner = identity() === 'OWNER';
    var root = page();
    root.innerHTML = pageHead('Your clinic', 'Address, phone and hours for this practice.',
      owner ? '<a class="dma-btn dma-btn-ghost" href="/dashboard/settings/?tab=hours">Hours</a><button type="button" class="dma-btn dma-btn-primary" id="loc-add">Add location</button>' : '', 'Clinic') +
      '<div id="loc-body">' + skel() + '</div>';
    function load() {
      A().get('/api/roster').then(function (d) {
        var rows = d.locations || [];
        if (!rows.length) {
          el('loc-body').innerHTML = empty('No locations yet.', 'Add a site when the clinic practises in more than one place.', '#', owner ? 'Add location' : '');
          var c = el('loc-body').querySelector('a'); if (c && owner) c.onclick = function (e) { e.preventDefault(); addLoc(); };
          return;
        }
        if (rows.length === 1) {
          var r = rows[0];
          el('loc-body').innerHTML = '<div class="cos-card cos-loc-card">' +
            '<span class="ds-pill">Your clinic</span>' +
            '<h2>' + esc(r.name) + '</h2>' +
            '<p>' + esc(r.address || 'No address yet') + '</p>' +
            (r.phone ? '<p>' + esc(r.phone) + '</p>' : '') +
            '<div class="dma-head-actions" style="margin-top:16px">' +
              '<a class="dma-btn dma-btn-ghost" href="/dashboard/settings/?tab=hours">Hours</a>' +
              (owner ? '<a class="dma-btn dma-btn-primary" href="/dashboard/settings/?tab=clinic">Edit location</a>' : '') +
            '</div></div>';
          return;
        }
        el('loc-body').innerHTML = '<div class="dma-table-wrap"><table class="dma-table"><thead><tr><th>Location</th><th>Address</th></tr></thead><tbody>' +
          rows.map(function (r) {
            return '<tr><td><strong>' + esc(r.name) + '</strong>' + (r.isPrimary ? ' ' + A().chip('Primary') : '') + '</td><td>' + esc(r.address || '—') + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      }).catch(function () {
        el('loc-body').innerHTML = errBox('Locations could not load.', 'loc-retry');
        el('loc-retry').onclick = load;
      });
    }
    function addLoc() {
      A().modal('Add location',
        '<div class="dma-field"><label for="loc-name">Name</label><input id="loc-name" required></div>' +
        '<div class="dma-field"><label for="loc-addr">Address</label><input id="loc-addr"></div>',
        '<button class="dma-btn dma-btn-ghost" data-close>Cancel</button><button class="dma-btn dma-btn-primary" id="loc-save">Save</button>'
      );
      el('loc-save').onclick = function () {
        A().post('/api/locations', { name: el('loc-name').value, address: el('loc-addr').value || undefined }).then(function (r) {
          if (!r.ok) { A().toast(failMsg(r, "Couldn't add this location."), 'err'); return; }
          A().closeModal(); A().toast('Location added', 'ok'); load();
        });
      };
    }
    if (el('loc-add')) el('loc-add').onclick = addLoc;
    load();
  }

  function doctors() {
    var root = page();
    var u = A().user();
    var pract = Clin() ? Clin().primaryPractitioner() : { name: ownerName(), specialty: u.specialty };
    root.innerHTML = pageHead('Doctors', 'Clinicians assigned to this clinic. Utilization is booked visits versus working-hour slots.',
      identity() === 'OWNER' ? '<a class="dma-btn dma-btn-ghost" href="/dashboard/settings/?tab=hours">Working hours</a>' : '', 'Team') +
      '<div id="doc-body">' + skel() + '</div>';
    A().get('/api/appointments?filter=today&limit=80').then(function (d) {
      var rows = apptList(d);
      var booked = rows.filter(function (a) { return statusOf(a) !== 'CANCELLED' && statusOf(a) !== 'NO_SHOW'; }).length;
      var practs = Clin() ? Clin().listPractitioners() : [pract];
      el('doc-body').innerHTML =
        practs.map(function (pr) {
          return '<div class="cos-profile-hero"><div class="dma-avatar">' + A().initials(pr.name) + '</div><div><span class="ds-pill">Practitioner</span><h2 style="margin:6px 0">' + esc(pr.name) + '</h2><p class="dma-hint">' + esc(pr.specialty || clinicName()) + '</p></div></div>';
        }).join('') +
        (practs.length < 2 ? '<p class="dma-hint">Additional clinicians can be assigned when they are added to this clinic.</p>' : '') +
        '<div class="cos-kpi-row">' +
          '<div class="cos-card cos-card--kpi"><span>Today booked</span><strong>' + booked + '</strong><em>visits</em></div>' +
          '<div class="cos-card cos-card--kpi"><span>Completed</span><strong>' + rows.filter(function (a) { return statusOf(a) === 'COMPLETED'; }).length + '</strong><em>today</em></div>' +
          '<div class="cos-card cos-card--kpi"><span>Leave</span><strong><a href="/dashboard/leave/">Open</a></strong><em>Roster leave</em></div>' +
        '</div>' +
        section('Today', rows.length ? rows.map(apptCard).join('') : empty('No visits today', 'The board is clear.', '/dashboard/appointments/?action=book', 'Book', 'appointments'));
    }).catch(function () { el('doc-body').innerHTML = errBox('Could not load doctor activity.', 'd-retry'); el('d-retry').onclick = doctors; });
  }

  function payments() {
    var root = page();
    root.innerHTML = pageHead('Payments', 'Visit fees recorded on appointments.',
      identity() === 'OWNER' ? '<a class="dma-btn dma-btn-ghost" href="/dashboard/billing/">SaaS billing</a>' : '', 'Finance') +
      '<div id="pay-body">' + skel() + '</div>';
    A().get('/api/appointments?filter=month&limit=200').then(function (d) {
      var rows = apptList(d).filter(function (a) { return a.fee; });
      if (!rows.length) {
        el('pay-body').innerHTML = empty('No visit fees this month', 'Add a fee when booking or completing a visit.', '/dashboard/appointments/?action=book', 'New appointment');
        return;
      }
      var sum = rows.reduce(function (s, a) { return s + Number(a.fee || 0); }, 0);
      el('pay-body').innerHTML = '<div class="dma-kpis"><div class="dma-kpi"><span>Visit fees (month)</span><strong>' + A().money(sum) + '</strong></div></div>' +
        rows.map(function (a) {
          return '<div class="dma-row-item"><div class="name">' + esc((a.patient && a.patient.fullName) || 'Patient') + ' · ' + feeLabel(a) + '</div><div class="meta">' + A().fmtDate(a.dateTime) + ' · ' + A().chip(a.status) + '</div></div>';
        }).join('');
    }).catch(function () { el('pay-body').innerHTML = errBox('Could not load fees.', 'p-retry'); el('p-retry').onclick = payments; });
  }

  function tasks() {
    var root = page();
    root.innerHTML = pageHead('Tasks', 'Operational work derived from live appointments and leads — not a standalone task database.', '', 'Operations') +
      '<div id="tk">' + skel() + '</div>';
    Promise.all([
      A().get('/api/appointments?filter=today&limit=80').catch(function () { return { data: [] }; }),
      A().get('/api/leads?limit=20').catch(function () { return { leads: [] }; })
    ]).then(function (p) {
      var rows = apptList(p[0]);
      var leads = p[1].leads || [];
      var items = [];
      rows.filter(function (a) { return statusOf(a) === 'PENDING' && new Date(a.dateTime) < new Date(); }).forEach(function (a) {
        items.push({ t: 'Overdue pending visit', d: (a.patient && a.patient.fullName) || 'Patient', st: 'To Do', href: '/dashboard/appointments/?id=' + a.id });
      });
      rows.filter(function (a) { return statusOf(a) === 'ARRIVED'; }).forEach(function (a) {
        items.push({ t: 'Waiting — start visit', d: (a.patient && a.patient.fullName) || 'Patient', st: 'In Progress', href: '/dashboard/waiting/' });
      });
      leads.filter(function (l) { return String(l.status || 'NEW').toUpperCase() === 'NEW'; }).forEach(function (l) {
        items.push({ t: 'Lead follow-up', d: l.fullName || l.phone, st: 'To Do', href: '/dashboard/leads/?id=' + l.id });
      });
      if (!items.length) {
        el('tk').innerHTML = empty('No open operational tasks', 'Overdue visits and new leads will appear here.', '/dashboard/appointments/', 'Schedule');
        return;
      }
      el('tk').innerHTML = items.map(function (i) {
        return '<a class="dma-row-item" href="' + i.href + '"><div><div class="name">' + esc(i.t) + '</div><div class="sub">' + esc(i.d) + '</div></div>' + A().chip(i.st) + '</a>';
      }).join('');
    });
  }

  function reports() {
    var root = page();
    root.innerHTML = pageHead('Reports', 'Appointments, visit fees and no-shows from this clinic’s real records.', '', 'Analytics') +
      '<div id="rp">' + skel() + '</div>';
    var owner = identity() === 'OWNER';
    var reqs = [
      A().get('/api/appointments?filter=month&limit=200').catch(function () { return { data: [] }; })
    ];
    if (owner) {
      reqs.push(A().get('/api/analytics/overview').catch(function () { return {}; }));
      reqs.push(A().get('/api/analytics/weekly-appointments').catch(function () { return []; }));
    }
    Promise.all(reqs).then(function (p) {
      var rows = apptList(p[0]);
      var n = rows.length;
      var noshow = rows.filter(function (a) { return statusOf(a) === 'NO_SHOW'; }).length;
      var cancel = rows.filter(function (a) { return statusOf(a) === 'CANCELLED'; }).length;
      var fees = rows.filter(function (a) { return statusOf(a) === 'COMPLETED'; }).reduce(function (s, a) { return s + Number(a.fee || 0); }, 0);
      var html = '<div class="cos-card cos-card--feature cos-report-hero"><span class="ds-pill">This month</span><span class="dma-hint">Visit fees from completed appointments</span><strong>' + A().money(fees) + '</strong></div>' +
        '<div class="cos-kpi-row">' +
        '<div class="cos-card cos-card--kpi"><span>Appointments</span><strong>' + n + '</strong><em>this month</em></div>' +
        '<div class="cos-card cos-card--kpi"><span>No-shows</span><strong>' + (n ? Math.round(noshow / n * 100) : 0) + '%</strong></div>' +
        '<div class="cos-card cos-card--kpi"><span>Cancellations</span><strong>' + (n ? Math.round(cancel / n * 100) : 0) + '%</strong></div>' +
        '</div>';
      if (!n) html += empty('Not enough history yet', 'Reports fill in as visits are booked and completed.', '/dashboard/appointments/?action=book', 'Book', 'reports');
      if (p[1] && p[1].totalPatients != null) html += '<p class="dma-hint">' + esc(p[1].totalPatients) + ' patient charts on file.</p>';
      el('rp').innerHTML = html;
    });
  }

  function operations() {
    location.replace('/dashboard/rooms/' + (location.search || ''));
  }

  function communication() {
    location.replace('/dashboard/messages/' + (location.search || ''));
  }

  var PAGES = {
    appointments: appointments,
    calendar: calendar,
    waiting: waiting,
    patients: patients,
    patient: patient,
    doctors: doctors,
    rooms: rooms,
    clinical: clinical,
    vitals: vitals,
    prescriptions: prescriptions,
    laboratory: laboratory,
    telemedicine: telemedicine,
    payments: payments,
    tasks: tasks,
    inventory: inventory,
    documents: documents,
    leave: leave,
    locations: locations,
    reports: reports,
    operations: operations,
    communication: communication,
    consult: clinical
  };

  function mountPage(id) {
    if (!PAGES[id]) return false;
    PAGES[id]();
    return true;
  }

  global.DmaInner = {
    mountPage: mountPage,
    bookWizard: bookWizard,
    apptDrawer: apptDrawer,
    encounterOf: encounterOf
  };
})(window);
