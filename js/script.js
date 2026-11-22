/* ==========================================================================
   Spotless Cleaning — interactions
   Vanilla JS, no dependencies. Progressive enhancement only: every link,
   call button and section still works with JavaScript disabled.
   --------------------------------------------------------------------------
   1.  Helpers
   2.  Sticky header
   3.  Mobile drawer (focus trap, ESC, resize safety)
   4.  Floating quick-contact
   5.  FAQ accordion
   6.  Scroll reveals
   7.  Active nav state
   8.  Smooth anchor scrolling (compensates for the fixed header)
   9.  Year stamp
   ========================================================================== */
(function () {
  "use strict";

  /* 1. Helpers ------------------------------------------------------------ */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var mqDesktop = window.matchMedia("(min-width: 900px)");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  var header = $("#site-header");
  var body = document.body;
  var drawer = $("#drawer");
  var navToggle = $("#navToggle");
  var navLabel = $(".nav-toggle__label", navToggle || document);
  var lastFocused = null;

  function headerHeight() {
    return header ? header.getBoundingClientRect().height : 68;
  }

  /* 2. Sticky header ------------------------------------------------------ */
  var ticking = false;
  function onScrollHeader() {
    if (!header) return;
    header.classList.toggle("is-stuck", window.scrollY > 8);
    ticking = false;
  }
  window.addEventListener("scroll", function () {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(onScrollHeader);
    }
  }, { passive: true });
  onScrollHeader();

  /* 3. Mobile drawer ------------------------------------------------------ */
  function setDrawer(open) {
    if (!drawer || !navToggle) return;
    body.classList.toggle("menu-open", open);
    body.classList.toggle("is-locked", open);
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    drawer.setAttribute("aria-hidden", open ? "false" : "true");
    if (navLabel) navLabel.textContent = open ? "Close" : "Menu";

    if (open) {
      lastFocused = document.activeElement;
      // Move focus into the drawer once the open transition starts.
      window.setTimeout(function () {
        var first = $(".drawer__link", drawer);
        if (first) first.focus({ preventScroll: true });
      }, 120);
    } else if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus({ preventScroll: true });
      lastFocused = null;
    }
  }

  if (navToggle && drawer) {
    navToggle.addEventListener("click", function () {
      setDrawer(!body.classList.contains("menu-open"));
    });

    // Close after choosing a destination.
    $$(".drawer a").forEach(function (link) {
      link.addEventListener("click", function () { setDrawer(false); });
    });

    // Escape closes and returns focus to the toggle.
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && body.classList.contains("menu-open")) {
        setDrawer(false);
        navToggle.focus({ preventScroll: true });
      }
    });

    // Keep Tab inside the drawer while it is open.
    drawer.addEventListener("keydown", function (e) {
      if (e.key !== "Tab" || !body.classList.contains("menu-open")) return;
      var focusables = $$('a[href], button:not([disabled])', drawer).filter(function (el) {
        return el.offsetParent !== null;
      });
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    // Never leave the drawer open when the desktop nav takes over.
    var onDesktopChange = function (e) {
      if (e.matches && body.classList.contains("menu-open")) setDrawer(false);
    };
    if (mqDesktop.addEventListener) mqDesktop.addEventListener("change", onDesktopChange);
    else if (mqDesktop.addListener) mqDesktop.addListener(onDesktopChange);
  }

  /* 4. Floating quick-contact -------------------------------------------- */
  var fab = $("#fab");
  var fabToggle = $("#fabToggle");
  if (fab && fabToggle) {
    fabToggle.addEventListener("click", function () {
      var open = !fab.classList.contains("is-open");
      fab.classList.toggle("is-open", open);
      fabToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    document.addEventListener("click", function (e) {
      if (fab.classList.contains("is-open") && !fab.contains(e.target)) {
        fab.classList.remove("is-open");
        fabToggle.setAttribute("aria-expanded", "false");
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && fab.classList.contains("is-open")) {
        fab.classList.remove("is-open");
        fabToggle.setAttribute("aria-expanded", "false");
        fabToggle.focus({ preventScroll: true });
      }
    });

    $$(".fab__action", fab).forEach(function (a) {
      a.addEventListener("click", function () {
        fab.classList.remove("is-open");
        fabToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* 5. FAQ accordion ------------------------------------------------------ */
  var faqButtons = $$(".faq__q");
  faqButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var item = btn.closest(".faq__item");
      var open = btn.getAttribute("aria-expanded") === "true";

      // Single-open behaviour keeps the section compact on phones.
      faqButtons.forEach(function (other) {
        if (other !== btn) {
          other.setAttribute("aria-expanded", "false");
          other.closest(".faq__item").classList.remove("is-open");
        }
      });

      btn.setAttribute("aria-expanded", open ? "false" : "true");
      item.classList.toggle("is-open", !open);
    });
  });

  /* 6. Scroll reveals ----------------------------------------------------- */
  var revealables = $$("[data-reveal]");
  if (revealables.length) {
    if (!("IntersectionObserver" in window) || reduceMotion.matches) {
      revealables.forEach(function (el) { el.classList.add("is-visible"); });
    } else {
      var revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
      revealables.forEach(function (el) { revealObserver.observe(el); });
    }
  }

  /* 7. Active nav state --------------------------------------------------- */
  var navLinks = $$(".nav__link");
  var sections = navLinks
    .map(function (link) {
      var id = link.getAttribute("href");
      return id && id.charAt(0) === "#" ? document.getElementById(id.slice(1)) : null;
    })
    .filter(Boolean);

  if (sections.length && "IntersectionObserver" in window) {
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (link) {
          var current = link.getAttribute("href") === "#" + entry.target.id;
          if (current) link.setAttribute("aria-current", "true");
          else link.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
    sections.forEach(function (s) { navObserver.observe(s); });
  }

  /* 8. Smooth anchor scrolling ------------------------------------------- */
  $$('a[href^="#"]').forEach(function (link) {
    var hash = link.getAttribute("href");
    if (!hash || hash === "#" || hash.length < 2) return;
    link.addEventListener("click", function (e) {
      var target = document.getElementById(hash.slice(1));
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.scrollY - headerHeight() - 14;
      window.scrollTo({ top: Math.max(top, 0), behavior: reduceMotion.matches ? "auto" : "smooth" });
      if (history.replaceState) history.replaceState(null, "", hash);
    });
  });

  /* 9. Year stamp --------------------------------------------------------- */
  var year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
