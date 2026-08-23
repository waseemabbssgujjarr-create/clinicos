/**
 * Superadmin clinics list — add Delete button next to Suspend/Activate.
 * Resolves clinic IDs from row links (primary) or /api/superadmin/clinics (fallback).
 */
(function () {
  if (!/\/superadmin\/clinics\/?$/.test(location.pathname)) return;

  var clinicsByName = {};
  var clinicsById = {};
  var clinicsReady = false;

  function authHeaders() {
    var h = { 'Content-Type': 'application/json' };
    var token = localStorage.getItem('token');
    if (token) h.Authorization = 'Bearer ' + token;
    return h;
  }

  /** Parse fetch response; avoid r.json() on HTML (SPA 404 / proxy miss). */
  function parseApiResponse(r, actionLabel) {
    return r.text().then(function (text) {
      var ct = (r.headers.get('content-type') || '').toLowerCase();
      var data = null;
      var trimmed = (text || '').trim();

      if (trimmed && (ct.indexOf('application/json') !== -1 || trimmed.charAt(0) === '{' || trimmed.charAt(0) === '[')) {
        try {
          data = JSON.parse(trimmed);
        } catch (e) {
          throw new Error((actionLabel || 'Request') + ' failed: server returned invalid JSON (HTTP ' + r.status + ')');
        }
      } else if (trimmed && trimmed.charAt(0) === '<') {
        throw new Error(
          (actionLabel || 'Request') + ' failed: server returned HTML instead of JSON. '
          + 'Upload clinicos-api/dist/routes/superadmin.routes.js and superadmin.controller.js, then restart Node in cPanel.'
        );
      } else if (trimmed) {
        throw new Error(trimmed.slice(0, 200));
      } else {
        data = {};
      }

      if (!r.ok) {
        throw new Error((data && data.error) || ((actionLabel || 'Request') + ' failed (HTTP ' + r.status + ')'));
      }
      return data;
    });
  }

  function norm(s) {
    return (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function loadClinics() {
    return fetch('/api/superadmin/clinics?limit=50', {
      headers: authHeaders(),
      credentials: 'include',
    }).then(function (r) {
      return parseApiResponse(r, 'Load clinics').then(function (d) {
        var list = d.data || [];
        clinicsByName = {};
        clinicsById = {};
        list.forEach(function (c) {
          clinicsById[c.id] = c;
          var key = norm(c.name);
          if (!clinicsByName[key]) clinicsByName[key] = [];
          clinicsByName[key].push(c);
        });
        clinicsReady = true;
        return list;
      });
    });
  }

  function clinicIdFromLink(row) {
    var link = row.querySelector('a[href*="/superadmin/clinics/"]');
    if (!link) return null;
    var href = link.getAttribute('href') || '';
    var m = href.match(/\/superadmin\/clinics\/([^/?#]+)/);
    return m ? m[1] : null;
  }

  function clinicNameFromRow(row) {
    var link = row.querySelector('a[href*="/superadmin/clinics/"]');
    if (link) return (link.textContent || '').replace(/\s+/g, ' ').trim();
    var nameEl = row.querySelector('td:first-child .font-bold, [data-label="Clinic"] .font-bold');
    if (nameEl) return (nameEl.textContent || '').replace(/\s+/g, ' ').trim();
    return '';
  }

  function ownerNameFromRow(row) {
    var td = row.querySelector('td:nth-child(2), [data-label="Doctor"]');
    return td ? norm(td.textContent) : '';
  }

  function resolveClinic(row) {
    var linkId = clinicIdFromLink(row);
    if (linkId) {
      if (clinicsById[linkId]) return clinicsById[linkId];
      return { id: linkId, name: clinicNameFromRow(row) || 'this clinic' };
    }

    if (!clinicsReady) return null;

    var name = norm(clinicNameFromRow(row));
    if (!name) return null;

    var matches = clinicsByName[name];
    if (!matches || !matches.length) return null;
    if (matches.length === 1) return matches[0];

    var owner = ownerNameFromRow(row);
    if (owner) {
      var byOwner = matches.filter(function (c) { return norm(c.ownerName) === owner; });
      if (byOwner.length === 1) return byOwner[0];
    }
    return matches[0];
  }

  function findRows() {
    var rows = [];
    var seen = typeof WeakSet !== 'undefined' ? new WeakSet() : null;

    function add(el) {
      if (!el || (seen && seen.has(el))) return;
      if (seen) seen.add(el);
      rows.push(el);
    }

    document.querySelectorAll('table tbody tr').forEach(add);

    if (!rows.length) {
      document.querySelectorAll('[role="row"]').forEach(function (el) {
        if (el.querySelector('a[href*="/superadmin/clinics/"]') || el.querySelector('button')) add(el);
      });
    }

    if (!rows.length) {
      document.querySelectorAll('a[href*="/superadmin/clinics/"]').forEach(function (link) {
        var row = link.closest('tr') || link.closest('[role="row"]') || link.closest('.card') || link.parentElement;
        while (row && row !== document.body) {
          if (row.querySelector('button')) {
            add(row);
            break;
          }
          row = row.parentElement;
        }
      });
    }

    return rows;
  }

  function actionsTarget(row) {
    var cell = row.querySelector('td:last-child, [data-label="Actions"]');
    if (cell && cell.querySelector('button')) return cell;
    var btn = row.querySelector('button');
    return btn ? btn.parentElement : row;
  }

  function patchStatus(id, isActive) {
    return fetch('/api/superadmin/clinics/' + encodeURIComponent(id) + '/status', {
      method: 'PATCH',
      headers: authHeaders(),
      credentials: 'include',
      body: JSON.stringify({ isActive: isActive }),
    }).then(function (r) {
      return parseApiResponse(r, 'Update clinic status');
    });
  }

  function deleteClinic(id) {
    return fetch('/api/superadmin/clinics/' + encodeURIComponent(id), {
      method: 'DELETE',
      headers: authHeaders(),
      credentials: 'include',
    }).then(function (r) {
      return parseApiResponse(r, 'Delete clinic');
    });
  }

  function enhanceRow(row) {
    if (row.dataset.dmaActionsEnhanced) return;

    var clinic = resolveClinic(row);
    if (!clinic || !clinic.id) return;

    var actionsCell = actionsTarget(row);
    var existingBtn = actionsCell.querySelector('button');
    if (!existingBtn) return;
    if (/^\s*delete\s*$/i.test((existingBtn.textContent || '').trim())) return;

    row.dataset.dmaActionsEnhanced = '1';
    row.dataset.dmaClinicId = clinic.id;

    var wrap = document.createElement('div');
    wrap.className = 'sa-clinic-actions';

    var label = (existingBtn.textContent || '').replace(/\s+/g, ' ').trim();
    var isActivate = /activate/i.test(label);

    var suspendBtn = document.createElement('button');
    suspendBtn.type = 'button';
    suspendBtn.className = isActivate ? 'sa-clinic-btn sa-clinic-btn-activate' : 'sa-clinic-btn sa-clinic-btn-suspend';
    suspendBtn.textContent = isActivate ? 'Activate' : 'Suspend';
    suspendBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var activating = /activate/i.test(suspendBtn.textContent || '');
      var msg = activating
        ? 'Activate this clinic? They will be able to sign in again.'
        : 'Suspend this clinic? They will be blocked from signing in.';
      if (!confirm(msg)) return;
      suspendBtn.disabled = true;
      patchStatus(clinic.id, activating)
        .then(function () { location.reload(); })
        .catch(function (err) { alert(err.message); suspendBtn.disabled = false; });
    });

    var delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.textContent = 'Delete';
    delBtn.className = 'sa-clinic-btn sa-clinic-btn-delete';
    delBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var name = clinic.name || clinicNameFromRow(row) || 'this clinic';
      if (!confirm('Permanently delete "' + name + '"?\n\nThis removes all patients, appointments, and staff. Cannot be undone.')) return;
      if (!confirm('Final confirmation: delete "' + name + '" forever?')) return;
      delBtn.disabled = true;
      deleteClinic(clinic.id)
        .then(function () { row.remove(); })
        .catch(function (err) { alert(err.message); delBtn.disabled = false; });
    });

    existingBtn.replaceWith(wrap);
    wrap.appendChild(suspendBtn);
    wrap.appendChild(delBtn);
  }

  function scan() {
    findRows().forEach(enhanceRow);
  }

  function start() {
    scan();

    loadClinics()
      .then(function () {
        scan();
        setTimeout(scan, 800);
      })
      .catch(function () {
        setTimeout(scan, 800);
        setTimeout(scan, 2000);
      });

    if (window.MutationObserver) {
      new MutationObserver(function () {
        scan();
      }).observe(document.body, { childList: true, subtree: true });
    }

    setTimeout(scan, 400);
    setTimeout(scan, 1200);
    setTimeout(scan, 3000);
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
