/**
 * Public website shell. Uses dma-design-system.css only.
 * Links only to live public routes — no blog, no demo, no invented pages.
 */
(function (global) {
  var NAV = [
    {
      label: "Platform",
      children: [
        { href: "/platform/", hash: "#platform", label: "Overview" },
        { href: "/ai-receptionist/", hash: "#ai-receptionist", label: "AI Receptionist" },
        { href: "/clinic-crm/", hash: "#clinic-crm", label: "Clinic CRM" },
        { href: "/clinical/", hash: "#clinical", label: "Clinical" },
        { href: "/patient-experience/", hash: "#patient-experience", label: "Patient experience" }
      ]
    },
    { href: "/solutions/", hash: "#solutions", label: "Solutions" },
    { href: "/platform/", hash: "#for-clinics", label: "For Clinics" },
    { href: "/clinical/", hash: "#for-doctors", label: "For Doctors" },
    { href: "/patient-experience/", hash: "#for-patients", label: "For Patients" },
    {
      label: "Resources",
      children: [
        { href: "/faqs/", hash: "#faqs", label: "FAQs" },
        { href: "/contact/", hash: "#contact", label: "Contact" },
        { href: "/about/", hash: "#about", label: "About" }
      ]
    },
    { href: "/pricing/", hash: "#pricing", label: "Pricing" }
  ];

  function isHome() {
    var path = String(location.pathname || "/").replace(/\/index\.html$/i, "");
    if (path.length > 1) path = path.replace(/\/+$/, "");
    return path === "" || path === "/";
  }

  function itemHref(item) {
    if (item.hash && isHome()) return item.hash;
    return item.href;
  }

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
            return '<li><a href="' + itemHref(c) + '">' + esc(c.label) + "</a></li>";
          }).join("") +
        "</ul></li>";
    }
    return '<li><a href="' + itemHref(item) + '">' + esc(item.label) + "</a></li>";
  }

  function icon(path) {
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">' + path + "</svg>";
  }

  function dockHtml() {
    var items = [
      { href: "/", label: "Home", d: '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z"/>' },
      { href: "/platform/", hash: "#platform", label: "Platform", d: '<rect x="4" y="4" width="7" height="7" rx="1.4"/><rect x="13" y="4" width="7" height="7" rx="1.4"/><rect x="4" y="13" width="7" height="7" rx="1.4"/><rect x="13" y="13" width="7" height="7" rx="1.4"/>' },
      { href: "/solutions/", hash: "#solutions", label: "Solutions", d: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>' },
      { href: "/pricing/", hash: "#pricing", label: "Pricing", d: '<path d="M6 8h9a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h9"/><path d="M12 4v16"/>' },
      { href: "/contact/", hash: "#contact", label: "Contact", d: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8A2.5 2.5 0 0 1 17.5 17H9l-5 3v-13.5z"/>' }
    ];
    return '<nav class="dma-pub-dock" aria-label="Primary">' +
      items.map(function (it) {
        return '<a href="' + itemHref(it) + '">' + icon(it.d) + "<span>" + esc(it.label) + "</span></a>";
      }).join("") +
      "</nav>";
  }

  function navHtml() {
    var brand = '<a class="dma-pub-logo" href="/"><span class="mark">C</span><span>Clinicos</span></a>';
    return '<div class="dma-pub-wrap"><nav class="dma-pub-nav" id="dma-pub-nav">' +
      brand +
      '<button type="button" class="dma-pub-menu" id="dma-pub-toggle" aria-expanded="false" aria-controls="dma-pub-links" aria-label="Open menu">' +
        '<span class="dma-pub-burger" aria-hidden="true"></span>' +
        '<span class="dma-pub-menu-label">Menu</span>' +
      "</button>" +
      '<ul class="dma-pub-links" id="dma-pub-links">' +
        '<li class="dma-pub-menu-brand">' + brand + "</li>" +
        NAV.map(itemHtml).join("") +
      "</ul>" +
      '<div class="dma-pub-cta">' +
        '<a class="dma-btn dma-btn-ghost" href="/doctor-login/">Login</a>' +
        '<a class="dma-btn dma-btn-primary" href="/register/">Start Free Trial</a>' +
      "</div></nav></div>";
  }

  function footerHtml() {
    return '<div class="dma-pub-foot-wrap">' +
      '<footer class="dma-pub-wrap dma-pub-foot">' +
      '<div class="dma-pub-foot-brand"><a class="dma-pub-logo" href="/"><span class="mark">C</span><span>Clinicos</span></a>' +
        "<p>The operating system for modern clinics.</p></div>" +
      '<div><strong>Platform</strong><a href="/platform/">Overview</a><a href="/ai-receptionist/">AI Receptionist</a><a href="/clinic-crm/">Clinic CRM</a><a href="/clinical/">Clinical</a><a href="/pricing/">Pricing</a></div>' +
      '<div><strong>For</strong><a href="/platform/">Clinics</a><a href="/clinical/">Doctors</a><a href="/patient-experience/">Patients</a><a href="/solutions/">Solutions</a></div>' +
      '<div><strong>Company</strong><a href="/about/">About</a><a href="/contact/">Contact</a><a href="/faqs/">FAQs</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/security/">Security</a></div>' +
      "</footer>" +
      '<p class="dma-pub-copy">© Clinicos · Doctors My Agency · 2026</p>' +
      "</div>";
  }

  function bootPublic() {
    document.documentElement.classList.add("dma-world-public");
    var header = document.getElementById("dma-public-header");
    var footer = document.getElementById("dma-public-footer");
    if (header) {
      header.innerHTML = navHtml();
      header.insertAdjacentHTML("afterend", dockHtml());
    }
    if (footer) footer.innerHTML = footerHtml();
    var toggle = document.getElementById("dma-pub-toggle");
    var nav = document.getElementById("dma-pub-nav");
    function setMenu(open) {
      if (!nav || !toggle) return;
      nav.classList.toggle("is-open", open);
      document.documentElement.classList.toggle("dma-pub-menu-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }
    if (toggle && nav) {
      toggle.onclick = function (e) {
        e.stopPropagation();
        setMenu(!nav.classList.contains("is-open"));
      };
      nav.querySelectorAll(".dma-pub-links a").forEach(function (a) {
        a.addEventListener("click", function () { setMenu(false); });
      });
      var links = document.getElementById("dma-pub-links");
      if (links) {
        links.addEventListener("click", function (e) { e.stopPropagation(); });
      }
      document.addEventListener("click", function (e) {
        if (nav && !nav.contains(e.target)) setMenu(false);
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") setMenu(false);
      });
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
    document.querySelectorAll(".dma-faq-q").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = btn.closest(".dma-faq");
        var panel = document.getElementById(btn.getAttribute("aria-controls"));
        var open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", open ? "false" : "true");
        if (item) item.classList.toggle("is-open", !open);
        if (panel) {
          if (open) panel.setAttribute("hidden", "");
          else panel.removeAttribute("hidden");
        }
      });
    });
    if (isHome() && location.hash) {
      var target = document.getElementById(location.hash.slice(1));
      if (target && target.scrollIntoView) {
        requestAnimationFrame(function () {
          target.scrollIntoView({ block: "start" });
        });
      }
    }
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var reveal = document.querySelectorAll(".dma-editorial, .dma-cta-band");
    if (!reveal.length || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("dma-pub-in");
        io.unobserve(en.target);
      });
    }, { threshold: 0.01, rootMargin: "0px 0px -48px 0px" });
    reveal.forEach(function (el) {
      var top = el.getBoundingClientRect().top;
      if (top < window.innerHeight * 0.92) {
        el.classList.add("dma-pub-in");
      } else {
        io.observe(el);
      }
    });
  }

  global.DmaPublic = { boot: bootPublic, esc: esc };
})(window);
