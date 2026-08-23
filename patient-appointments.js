(function (global) {
  var TOKEN_KEY = 'dma_patient_token';
  var INFO_KEY = 'dma_patient_info';
  var SESSION_KEY = 'dma_patient_session_token';
  var PHONE_KEY = 'dma_patient_phone';

  function getToken() {
    try { return sessionStorage.getItem(TOKEN_KEY); } catch (_) { return null; }
  }

  function setAuth(token, patient) {
    try {
      sessionStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem(INFO_KEY, JSON.stringify(patient || {}));
      sessionStorage.removeItem(SESSION_KEY);
    } catch (_) {}
  }

  function clearAuth() {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(INFO_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(PHONE_KEY);
    } catch (_) {}
  }

  function getPatientInfo() {
    try {
      var raw = sessionStorage.getItem(INFO_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function getSessionToken() {
    try { return sessionStorage.getItem(SESSION_KEY); } catch (_) { return null; }
  }

  function getStoredPhone() {
    try { return sessionStorage.getItem(PHONE_KEY) || ''; } catch (_) { return ''; }
  }

  function setOtpSession(sessionToken, phone) {
    try {
      sessionStorage.setItem(SESSION_KEY, sessionToken);
      sessionStorage.setItem(PHONE_KEY, phone);
    } catch (_) {}
  }

  async function requestOtp(phone) {
    var r = await fetch('/api/patient/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone }),
    });
    var data = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(data.error || data.message || 'Could not send OTP');
    if (data.sessionToken) setOtpSession(data.sessionToken, phone);
    return data;
  }

  async function verifyOtp(otp, sessionToken) {
    var r = await fetch('/api/patient/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp: otp, sessionToken: sessionToken }),
    });
    var data = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(data.error || data.message || 'Invalid code');
    setAuth(data.token, data.patient);
    return data;
  }

  async function fetchAppointments() {
    var token = getToken();
    if (!token) throw new Error('Not signed in');
    var r = await fetch('/api/patient/appointments', {
      headers: { Authorization: 'Bearer ' + token },
    });
    var data = await r.json().catch(function () { return {}; });
    if (r.status === 401) {
      clearAuth();
      throw new Error('Session expired — please verify your phone again.');
    }
    if (!r.ok) throw new Error(data.error || data.message || 'Could not load appointments');
    return data;
  }

  async function cancelAppointment(id) {
    var token = getToken();
    if (!token) throw new Error('Not signed in');
    var r = await fetch('/api/patient/appointments/' + encodeURIComponent(id) + '/cancel', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + token },
    });
    var data = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(data.error || data.message || 'Could not cancel');
    return data;
  }

  function formatDateTime(iso) {
    try {
      return new Date(iso).toLocaleString(undefined, {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch (_) { return iso; }
  }

  function statusLabel(status) {
    var s = (status || '').toUpperCase();
    if (s === 'CONFIRMED') return 'Confirmed';
    if (s === 'CANCELLED') return 'Cancelled';
    if (s === 'COMPLETED') return 'Completed';
    if (s === 'NO_SHOW') return 'No show';
    if (s === 'PENDING') return 'Pending';
    return status || 'Scheduled';
  }

  function canCancel(appt) {
    if (!appt || !appt.dateTime) return false;
    if ((appt.status || '').toUpperCase() === 'CANCELLED') return false;
    if ((appt.status || '').toUpperCase() === 'COMPLETED') return false;
    return new Date(appt.dateTime).getTime() > Date.now() + 2 * 60 * 60 * 1000;
  }

  global.DmaPatientAppts = {
    getToken: getToken,
    getPatientInfo: getPatientInfo,
    getSessionToken: getSessionToken,
    getStoredPhone: getStoredPhone,
    setOtpSession: setOtpSession,
    clearAuth: clearAuth,
    requestOtp: requestOtp,
    verifyOtp: verifyOtp,
    fetchAppointments: fetchAppointments,
    cancelAppointment: cancelAppointment,
    formatDateTime: formatDateTime,
    statusLabel: statusLabel,
    canCancel: canCancel,
  };
})(window);
