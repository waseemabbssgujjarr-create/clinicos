/**
 * ClinicOS clinical + roster abstractions.
 * Persistence remains appointment.notes ([[clinicos-chart]] JSON).
 * UI should call these helpers, not parse notes directly.
 */
(function (global) {
  var CHART_MARK = '[[clinicos-chart]]';

  function A() { return global.DmaApp; }

  function user() {
    return A() && A().user ? A().user() : {};
  }

  function emptyChart() {
    return {
      vitals: {},
      complaint: '',
      history: '',
      exam: '',
      diagnosis: '',
      assessment: '',
      treatment: '',
      rx: [],
      labs: [],
      followup: '',
      draft: true
    };
  }

  function parseChart(notes) {
    var s = String(notes || '');
    var i = s.indexOf(CHART_MARK);
    var base = emptyChart();
    if (i < 0) return { text: s, chart: base };
    try {
      return { text: s.slice(0, i).trim(), chart: Object.assign(base, JSON.parse(s.slice(i + CHART_MARK.length).trim() || '{}')) };
    } catch (_) {
      return { text: s, chart: base };
    }
  }

  function serializeChart(text, chart) {
    return String(text || '').replace(/\s+$/, '') + '\n' + CHART_MARK + '\n' + JSON.stringify(chart || emptyChart());
  }

  function vitalsHasData(vitals) {
    if (!vitals || typeof vitals !== 'object') return false;
    return Object.keys(vitals).some(function (k) {
      var v = vitals[k];
      return v != null && String(v).trim() !== '';
    });
  }

  function noteHasData(note) {
    return !!(note && String(note).trim());
  }

  function clinicOrg() {
    var u = user();
    return {
      id: u.clinicId || u.id || 'clinic',
      name: u.clinicName || u.name || 'Clinic'
    };
  }

  var _roster = { practitioners: null, locations: null, loading: false };

  function hydrateRoster() {
    if (_roster.loading || !A() || !A().get) return;
    _roster.loading = true;
    A().get('/api/roster').then(function (d) {
      _roster.practitioners = (d && d.practitioners) || [];
      _roster.locations = (d && d.locations) || [];
    }).catch(function () {}).then(function () { _roster.loading = false; });
  }

  function listLocations() {
    hydrateRoster();
    var org = clinicOrg();
    if (_roster.locations && _roster.locations.length) {
      return _roster.locations.map(function (loc) {
        return { id: loc.id, name: loc.name, organizationId: org.id, isPrimary: !!loc.isPrimary };
      });
    }
    var extra = user().locations;
    if (Array.isArray(extra) && extra.length) {
      return extra.map(function (loc, i) {
        return {
          id: loc.id || loc.slug || ('loc-' + i),
          name: loc.name || loc.label || org.name,
          organizationId: org.id
        };
      });
    }
    return [{
      id: org.id,
      name: org.name,
      organizationId: org.id,
      isPrimary: true
    }];
  }

  function locationOf(appointment) {
    if (appointment && appointment.location && appointment.location.name) return appointment.location;
    if (appointment && appointment.locationName) {
      return { id: appointment.locationId || 'loc', name: appointment.locationName };
    }
    var list = listLocations();
    return list[0] || { id: 'clinic', name: 'Clinic' };
  }

  function locationFilterState() {
    var n = listLocations().length;
    var extra = user().locations;
    var multi = Array.isArray(extra) && extra.length > 1;
    if (_roster.locations && _roster.locations.length > 1) multi = true;
    return {
      available: multi || n > 1,
      hint: 'Location filtering becomes available when additional clinic sites are configured.'
    };
  }

  function listPractitioners() {
    hydrateRoster();
    var u = user();
    if (_roster.practitioners && _roster.practitioners.length) {
      return _roster.practitioners.map(function (p) {
        return {
          id: p.id,
          name: p.name || p.fullName || 'Practitioner',
          role: 'PRACTITIONER',
          specialty: p.specialty || '',
          source: 'roster'
        };
      });
    }
    if (Array.isArray(u.practitioners) && u.practitioners.length) {
      return u.practitioners.map(function (p, i) {
        return {
          id: p.id || ('pr-' + i),
          name: p.fullName || p.name || 'Practitioner',
          role: p.role || 'PRACTITIONER',
          specialty: p.specialty || '',
          source: 'roster'
        };
      });
    }
    return [{
      id: u.id || u.clinicId || 'primary-practitioner',
      name: u.ownerName || u.name || 'Practitioner',
      role: 'PRACTITIONER',
      specialty: u.specialty || '',
      source: 'clinic'
    }];
  }

  function primaryPractitioner() {
    return listPractitioners()[0] || { id: 'primary-practitioner', name: 'Practitioner', role: 'PRACTITIONER' };
  }

  function assignedClinician(appointment) {
    appointment = appointment || {};
    if (appointment.practitioner && (appointment.practitioner.name || appointment.practitioner.fullName)) {
      return {
        id: appointment.practitioner.id || appointment.practitionerId,
        name: appointment.practitioner.name || appointment.practitioner.fullName,
        role: 'PRACTITIONER',
        source: 'roster'
      };
    }
    if (appointment.practitionerId) {
      var hit = listPractitioners().filter(function (p) { return p.id === appointment.practitionerId; })[0];
      if (hit) return hit;
    }
    if (appointment.doctor && (appointment.doctor.fullName || appointment.doctor.name)) {
      return {
        id: appointment.doctor.id || appointment.doctorId,
        name: appointment.doctor.fullName || appointment.doctor.name,
        role: 'PRACTITIONER',
        source: 'appointment'
      };
    }
    if (appointment.clinician && (appointment.clinician.fullName || appointment.clinician.name)) {
      return {
        id: appointment.clinician.id,
        name: appointment.clinician.fullName || appointment.clinician.name,
        role: 'PRACTITIONER',
        source: 'appointment'
      };
    }
    if (appointment.doctorName) {
      return { id: appointment.doctorId || 'clinician', name: appointment.doctorName, role: 'PRACTITIONER', source: 'appointment' };
    }
    return primaryPractitioner();
  }

  function clinicianFilterState() {
    return {
      available: listPractitioners().length > 1,
      hint: 'Doctor filtering becomes available when multiple clinicians are configured.'
    };
  }

  function roomFilterState() {
    return {
      available: false,
      hint: 'Room filtering requires a rooms data source. Appointments are scheduled against clinic hours, not rooms.'
    };
  }

  function staffRole() {
    var u = user();
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

  function canChart() {
    var r = staffRole();
    return r === 'OWNER' || r === 'NURSE';
  }

  function canPrescribe() {
    return staffRole() === 'OWNER';
  }

  var PERSISTABLE = {
    PENDING: 1, CONFIRMED: 1, ARRIVED: 1, CALLED: 1, IN_PROGRESS: 1,
    COMPLETED: 1, NO_SHOW: 1, CANCELLED: 1, RESCHEDULED: 1
  };
  var CALLED_KEY = 'clinicos.queue.called';

  function calledMap() {
    try { return JSON.parse(sessionStorage.getItem(CALLED_KEY) || '{}') || {}; }
    catch (_) { return {}; }
  }
  function writeCalledMap(map) {
    try { sessionStorage.setItem(CALLED_KEY, JSON.stringify(map)); } catch (_) {}
  }
  function isCalled(id) {
    return !!(id && calledMap()[id]);
  }
  function markCalled(id) {
    if (!id) return { ok: false, persistable: false };
    var map = calledMap();
    map[id] = Date.now();
    writeCalledMap(map);
    var persistable = canPersistStatus('CALLED');
    if (persistable && A() && A().patch) {
      A().patch('/api/appointments/' + id, { status: 'CALLED' }).catch(function () {});
    }
    return {
      ok: true,
      persistable: persistable,
      code: 'CALLED',
      note: persistable
        ? 'Called is stored on the appointment.'
        : 'Called is held on this device until the visit API supports CALLED.'
    };
  }
  function clearCalled(id) {
    if (!id) return;
    var map = calledMap();
    if (!map[id]) return;
    delete map[id];
    writeCalledMap(map);
  }
  function canPersistStatus(code) {
    return !!PERSISTABLE[String(code || '').toUpperCase()];
  }

  function visitState(appointment) {
    appointment = appointment || {};
    var persist = String(appointment.status || '').toUpperCase();
    if (persist === 'CALLED') {
      return { code: 'CALLED', persist: 'CALLED', persistable: true, label: 'Called', queue: true };
    }
    if (persist === 'IN_PROGRESS' || persist === 'COMPLETED' || persist === 'NO_SHOW' || persist === 'CANCELLED') {
      clearCalled(appointment.id);
    }
    if (persist === 'ARRIVED' && isCalled(appointment.id)) {
      return {
        code: 'CALLED',
        persist: 'ARRIVED',
        persistable: false,
        label: 'Called',
        queue: true,
        note: 'Called is not stored on the server yet. Starting the visit will persist In consultation.'
      };
    }
    if (persist === 'ARRIVED') {
      return { code: 'WAITING', persist: 'ARRIVED', persistable: true, label: 'Waiting', queue: true };
    }
    var labels = {
      PENDING: 'Pending', CONFIRMED: 'Confirmed', IN_PROGRESS: 'In consultation',
      COMPLETED: 'Completed', NO_SHOW: 'No show', CANCELLED: 'Cancelled', RESCHEDULED: 'Rescheduled'
    };
    return {
      code: persist || 'PENDING',
      persist: persist || 'PENDING',
      persistable: canPersistStatus(persist),
      label: labels[persist] || persist.replace(/_/g, ' '),
      queue: persist === 'CONFIRMED'
    };
  }

  function fromClinical(a, clinical) {
    a = a || {};
    clinical = clinical || {};
    return {
      id: a.id || clinical.id,
      encounterId: clinical.encounterId,
      migrated: !!clinical.migrated || !!a.chartMigratedAt,
      patient: clinical.patient || {
        id: a.patientId || (a.patient && a.patient.id) || '',
        name: (a.patient && (a.patient.fullName || a.patient.name)) || 'Patient',
        phone: (a.patient && a.patient.phone) || '',
        age: a.patient && a.patient.dateOfBirth,
        allergies: (a.patient && a.patient.allergies) || '',
        gender: (a.patient && a.patient.gender) || ''
      },
      appointment: a,
      practitioner: clinical.practitioner || assignedClinician(a),
      location: clinical.location || locationOf(a),
      vitals: clinical.vitals || {},
      diagnoses: clinical.diagnoses || [],
      clinicalNote: clinical.clinicalNote || { complaint: '', history: '', exam: '', assessment: '', treatment: '', freeText: '' },
      prescriptions: clinical.prescriptions || [],
      labOrders: clinical.labOrders || [],
      followUp: clinical.followUp || null,
      draft: clinical.draft !== false,
      _persist: { source: 'encounter', encounterId: clinical.encounterId }
    };
  }

  function fromAppointment(a) {
    a = a || {};
    if (a.clinical) return fromClinical(a, a.clinical);
    if (a.chartMigratedAt) {
      return fromClinical(a, { migrated: true, vitals: {}, diagnoses: [], clinicalNote: { complaint: '', history: '', exam: '', assessment: '', treatment: '', freeText: '' }, prescriptions: [], labOrders: [], followUp: null, draft: true });
    }
    var parsed = parseChart(a.notes);
    var c = parsed.chart || emptyChart();
    var patient = a.patient || {};
    var vitals = c.vitals && typeof c.vitals === 'object' ? c.vitals : {};
    var prescriptions = Array.isArray(c.rx) ? c.rx : [];
    var labs = Array.isArray(c.labs) ? c.labs : [];
    return {
      id: a.id,
      patient: {
        id: a.patientId || patient.id || '',
        name: patient.fullName || patient.name || 'Patient',
        phone: patient.phone || '',
        age: patient.dateOfBirth,
        allergies: patient.allergies || '',
        gender: patient.gender || ''
      },
      appointment: a,
      practitioner: assignedClinician(a),
      location: locationOf(a),
      vitals: vitals,
      diagnoses: noteHasData(c.diagnosis) ? [{ text: c.diagnosis }] : [],
      clinicalNote: {
        complaint: c.complaint || '',
        history: c.history || '',
        exam: c.exam || '',
        assessment: c.assessment || '',
        treatment: c.treatment || '',
        freeText: parsed.text || ''
      },
      prescriptions: prescriptions,
      labOrders: labs,
      followUp: noteHasData(c.followup) ? { note: c.followup } : null,
      draft: c.draft !== false,
      _persist: { text: parsed.text, chart: c }
    };
  }

  function encounterHasClinical(enc) {
    if (!enc) return false;
    if (vitalsHasData(enc.vitals)) return true;
    if (enc.diagnoses && enc.diagnoses.length) return true;
    if (enc.prescriptions && enc.prescriptions.length) return true;
    if (enc.labOrders && enc.labOrders.length) return true;
    if (enc.followUp && enc.followUp.note) return true;
    var n = enc.clinicalNote || {};
    return !!(n.complaint || n.history || n.exam || n.assessment || n.treatment || n.freeText);
  }

  function getEncounter(appointmentId) {
    return A().get('/api/encounters/by-appointment/' + appointmentId).then(function (d) {
      if (d && d.clinical) return fromClinical(d.appointment || { id: appointmentId }, d.clinical);
      return A().get('/api/appointments/' + appointmentId).then(function (a) {
        if (!a || a.error) return null;
        return fromAppointment(a);
      });
    }).catch(function () {
      return A().get('/api/appointments/' + appointmentId).then(function (a) {
        if (!a || a.error) return null;
        return fromAppointment(a);
      });
    });
  }

  function chartFromEncounter(enc, extra) {
    extra = extra || {};
    var chart = Object.assign(emptyChart(), (enc && enc._persist && enc._persist.chart) || {});
    if (extra.vitals) chart.vitals = extra.vitals;
    if (extra.clinicalNote) {
      chart.complaint = extra.clinicalNote.complaint || '';
      chart.history = extra.clinicalNote.history || '';
      chart.exam = extra.clinicalNote.exam || '';
      chart.diagnosis = extra.clinicalNote.diagnosis || (enc.diagnoses && enc.diagnoses[0] && enc.diagnoses[0].text) || '';
      chart.assessment = extra.clinicalNote.assessment || '';
      chart.treatment = extra.clinicalNote.treatment || '';
      chart.followup = extra.clinicalNote.followup || (enc.followUp && enc.followUp.note) || '';
    }
    if (extra.prescriptions) chart.rx = extra.prescriptions;
    if (extra.labOrders) chart.labs = extra.labOrders;
    if (extra.draft != null) chart.draft = extra.draft;
    var text = extra.freeText != null ? extra.freeText : ((enc && enc._persist && enc._persist.text) || '');
    return serializeChart(text, chart);
  }

  function saveEncounter(enc, extra, opts) {
    extra = extra || {};
    opts = opts || {};
    if (!enc || !enc.id) {
      return Promise.resolve({ ok: false, status: 0, d: { error: 'missing-encounter' } });
    }
    if (opts.status && !canPersistStatus(opts.status)) {
      return Promise.resolve({ ok: false, status: 0, d: { error: 'not-persistable' } });
    }
    var payload = {
      vitals: extra.vitals,
      clinicalNote: extra.clinicalNote,
      diagnoses: extra.diagnoses,
      prescriptions: extra.prescriptions,
      labOrders: extra.labOrders,
      followUp: extra.followUp,
      draft: extra.draft,
      freeText: extra.freeText,
      complete: !!opts.complete,
      status: opts.status
    };
    if (opts.complete) payload.draft = false;
    return A().put('/api/encounters/by-appointment/' + enc.id, payload).then(function (r) {
      if (r.ok) {
        if (opts.status === 'IN_PROGRESS' || opts.status === 'CALLED') clearCalled(enc.id);
        if (opts.status === 'IN_PROGRESS') clearCalled(enc.id);
        return r;
      }
      if (r.status === 404 || r.status === 0) {
        var notes = chartFromEncounter(enc, extra);
        var body = { notes: notes };
        if (opts.status) body.status = opts.status;
        return A().patch('/api/appointments/' + enc.id, body).then(function (r2) {
          if (r2.ok && opts.status === 'IN_PROGRESS') clearCalled(enc.id);
          return r2;
        });
      }
      return r;
    });
  }

  function timelineEntries(encounters) {
    return (encounters || []).map(function (e) {
      var n = e.clinicalNote || {};
      return {
        id: e.id,
        date: e.appointment && e.appointment.dateTime,
        type: (e.appointment && e.appointment.treatment) || 'Visit',
        practitioner: (e.practitioner && e.practitioner.name) || '',
        status: e.appointment && e.appointment.status,
        hasClinical: encounterHasClinical(e),
        complaint: n.complaint || '',
        vitals: vitalsHasData(e.vitals),
        diagnosis: (e.diagnoses && e.diagnoses[0] && e.diagnoses[0].text) || '',
        notes: n.assessment || '',
        prescriptions: (e.prescriptions || []).map(function (x) { return x.medication; }).filter(Boolean),
        labs: e.labOrders || [],
        followUp: e.followUp && e.followUp.note
      };
    });
  }

  function listEncounters(appointments) {
    return (appointments || []).map(fromAppointment);
  }

  function previousVitals(encounters, currentId) {
    return (encounters || []).filter(function (e) {
      return e.id !== currentId && vitalsHasData(e.vitals);
    });
  }

  global.DmaClinical = {
    vitalsHasData: vitalsHasData,
    fromAppointment: fromAppointment,
    getEncounter: getEncounter,
    saveEncounter: saveEncounter,
    listEncounters: listEncounters,
    encounterHasClinical: encounterHasClinical,
    previousVitals: previousVitals,
    timelineEntries: timelineEntries,
    visitState: visitState,
    markCalled: markCalled,
    clearCalled: clearCalled,
    isCalled: isCalled,
    canPersistStatus: canPersistStatus,
    listPractitioners: listPractitioners,
    primaryPractitioner: primaryPractitioner,
    assignedClinician: assignedClinician,
    listLocations: listLocations,
    locationOf: locationOf,
    clinicianFilterState: clinicianFilterState,
    locationFilterState: locationFilterState,
    roomFilterState: roomFilterState,
    staffRole: staffRole,
    canChart: canChart,
    canPrescribe: canPrescribe,
    clinicOrg: clinicOrg
  };
})(window);
