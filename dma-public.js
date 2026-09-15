/**
 * Public website shell. Uses dma-design-system.css only.
 * Links only to live public routes — no blog, no demo, no invented pages.
 */
(function (global) {
  var NAV = [
    {
      label: "Platform",
      children: [
        { href: "/platform/", label: "Overview" },
        { href: "/ai-receptionist/", label: "AI Receptionist" },
        { href: "/clinic-crm/", label: "Clinic CRM" },
        { href: "/clinical/", label: "Clinical" },
        { href: "/patient-experience/", label: "Patient experience" }
      ]
    },
    { href: "/solutions/", label: "Solutions" },
    { href: "/platform/", label: "For Clinics" },
    { href: "/clinical/", label: "For Doctors" },
    { href: "/patient-experience/", label: "For Patients" },
    {
      label: "Resources",
      children: [
        { href: "/faqs/", label: "FAQs" },
        { href: "/contact/", label: "Contact" },
        { href: "/about/", label: "About" }
      ]
    },
    { href: "/pricing/", label: "Pricing" }
  ];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
    });
  }

  function itemHtml(item) {
    if (item.children) {
      return '<li class="dma-pub-dd">' +
        '<button type="button" class="dma-pub-drop" aria-expanded="false">' + esc(item.label) + "</button>" +
        '<ul class="dma-pub-dd-list">' +
          item.children.map(function (c) {
            return '<li><a href="' + c.href + '">' + esc(c.label) + "</a></li>";
          }).join("") +
        "</ul></li>";
    }
    return '<li><a href="' + item.href + '">' + esc(item.label) + "</a></li>";
  }

  function navHtml() {
    return '<div class="dma-pub-wrap"><nav class="dma-pub-nav" id="dma-pub-nav">' +
      '<a class="dma-pub-logo" href="/"><span class="mark">DM</span> Clinicos</a>' +
      '<button type="button" class="dma-pub-menu dma-btn dma-btn-ghost dma-btn-sm" id="dma-pub-toggle" aria-expanded="false" aria-controls="dma-pub-links" aria-label="Open menu">Menu</button>' +
      '<ul class="dma-pub-links" id="dma-pub-links">' +
        NAV.map(itemHtml).join("") +
      "</ul>" +
      '<div class="dma-pub-cta">' +
        '<a class="dma-btn dma-btn-ghost" href="/doctor-login/">Login</a>' +
        '<a class="dma-btn dma-btn-primary" href="/register/">Start Free Trial</a>' +
      "</div></nav></div>";
  }

  function footerHtml() {
    return '<footer class="dma-pub-wrap dma-pub-foot">' +
      '<div><a class="dma-pub-logo" href="/"><span class="mark">DM</span> Clinicos</a>' +
        "<p>Private clinic operating system. Isolated clinic data. No public marketplace.</p></div>" +
      '<div><strong>Platform</strong><a href="/platform/">Overview</a><br><a href="/ai-receptionist/">AI Receptionist</a><br><a href="/clinic-crm/">Clinic CRM</a><br><a href="/clinical/">Clinical</a><br><a href="/pricing/">Pricing</a></div>' +
      '<div><strong>For</strong><a href="/platform/">Clinics</a><br><a href="/clinical/">Doctors</a><br><a href="/patient-experience/">Patients</a><br><a href="/solutions/">Solutions</a></div>' +
      '<div><strong>Company</strong><a href="/about/">About</a><br><a href="/contact/">Contact</a><br><a href="/faqs/">FAQs</a><br><a href="/privacy/">Privacy</a><br><a href="/terms/">Terms</a><br><a href="/security/">Security</a></div>' +
      "</footer>" +
      '<p class="dma-pub-copy">© Clinicos · Doctors My Agency</p>';
  }

  function bootPublic() {
    document.documentElement.classList.add("dma-world-public");
    var header = document.getElementById("dma-public-header");
    var footer = document.getElementById("dma-public-footer");
    if (header) header.innerHTML = navHtml();
    if (footer) footer.innerHTML = footerHtml();
    var toggle = document.getElementById("dma-pub-toggle");
    var nav = document.getElementById("dma-pub-nav");
    if (toggle && nav) {
      toggle.onclick = function () {
        var open = nav.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      };
    }
    document.querySelectorAll(".dma-pub-drop").forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        var li = btn.parentElement;
        var open = li.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        document.querySelectorAll(".dma-pub-dd").forEach(function (other) {
          if (other !== li) {
            other.classList.remove("is-open");
            var b = other.querySelector(".dma-pub-drop");
            if (b) b.setAttribute("aria-expanded", "false");
          }
        });
      };
    });
    document.addEventListener("click", function () {
      document.querySelectorAll(".dma-pub-dd").forEach(function (li) {
        li.classList.remove("is-open");
        var b = li.querySelector(".dma-pub-drop");
        if (b) b.setAttribute("aria-expanded", "false");
      });
    });
  }

  global.DmaPublic = { boot: bootPublic, esc: esc };
})(window);
