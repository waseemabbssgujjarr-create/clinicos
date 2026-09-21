/**
 * Clinicos format helpers — locale-aware, honest missing values, tabular nums.
 * Numbers and money use the body font (Plus Jakarta Sans), not Montserrat.
 */
(function (global) {
  function missing(v) {
    return v == null || v === "" || v === "undefined" || v === "null" ||
      (typeof v === "number" && !isFinite(v));
  }

  function dash(v) {
    return missing(v) ? "—" : String(v);
  }

  function wrapNum(html) {
    return '<span class="ds-num">' + html + "</span>";
  }

  function money(amount, currency) {
    if (missing(amount)) return wrapNum("—");
    var n = Number(amount);
    if (!isFinite(n)) return wrapNum("—");
    var cur = currency || "USD";
    try {
      return wrapNum(new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: cur,
        maximumFractionDigits: 2,
      }).format(n));
    } catch (_) {
      return wrapNum(n.toFixed(2));
    }
  }

  function integer(n) {
    if (missing(n)) return wrapNum("—");
    var v = Number(n);
    if (!isFinite(v)) return wrapNum("—");
    try {
      return wrapNum(new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(v));
    } catch (_) {
      return wrapNum(String(Math.round(v)));
    }
  }

  function percent(part, whole) {
    var w = Number(whole);
    var p = Number(part);
    if (!isFinite(w) || w === 0 || !isFinite(p)) return "—";
    return wrapNum(Math.round((p / w) * 100) + "%");
  }

  function dateTime(iso) {
    if (missing(iso)) return "—";
    var d = iso instanceof Date ? iso : new Date(iso);
    if (isNaN(d.getTime())) return "—";
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(d);
    } catch (_) {
      return d.toISOString();
    }
  }

  function dateOnly(iso) {
    if (missing(iso)) return "—";
    var d = iso instanceof Date ? iso : new Date(iso);
    if (isNaN(d.getTime())) return "—";
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(d);
    } catch (_) {
      return d.toISOString().slice(0, 10);
    }
  }

  function relative(iso) {
    if (missing(iso)) return { text: "—", title: "" };
    var d = iso instanceof Date ? iso : new Date(iso);
    if (isNaN(d.getTime())) return { text: "—", title: "" };
    var diff = Date.now() - d.getTime();
    var sec = Math.round(diff / 1000);
    var abs = Math.abs(sec);
    var text;
    if (abs < 60) text = "Just now";
    else if (abs < 3600) text = Math.round(abs / 60) + " min ago";
    else if (abs < 86400) text = Math.round(abs / 3600) + " hr ago";
    else if (abs < 86400 * 7) text = Math.round(abs / 86400) + " days ago";
    else text = dateOnly(d);
    return { text: text, title: dateTime(d) };
  }

  function relativeHtml(iso) {
    var r = relative(iso);
    if (r.text === "—") return "—";
    return '<time class="ds-rel" datetime="' + dash(iso) + '" title="' + r.title + '">' + r.text + "</time>";
  }

  global.DmaFormat = {
    dash: dash,
    missing: missing,
    money: money,
    integer: integer,
    percent: percent,
    dateTime: dateTime,
    dateOnly: dateOnly,
    relative: relative,
    relativeHtml: relativeHtml,
    wrapNum: wrapNum,
  };
})(window);
