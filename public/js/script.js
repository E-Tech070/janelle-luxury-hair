document.addEventListener("DOMContentLoaded", function () {
  // ============================================================
  // PRELOADER
  // ============================================================
  var preloader = document.getElementById("preloader");
  window.addEventListener("load", function () {
    setTimeout(function () {
      if (preloader) preloader.classList.add("hidden");
    }, 800);
  });

  // ============================================================
  // HEADER SCROLL
  // ============================================================
  var header = document.getElementById("header");
  window.addEventListener("scroll", function () {
    if (header) {
      header.classList.toggle("scrolled", window.scrollY > 50);
    }
  });

  // ============================================================
  // HAMBURGER MENU
  // ============================================================
  var hamburger = document.getElementById("hamburger");
  var nav = document.querySelector(".nav");
  var overlay = document.getElementById("overlay");

  function closeMenu() {
    if (hamburger) hamburger.classList.remove("active");
    if (nav) nav.classList.remove("open");
    if (overlay) overlay.classList.remove("active");
    document.body.style.overflow = "";
  }

  function toggleMenu() {
    var isOpen = nav && nav.classList.contains("open");
    if (isOpen) {
      closeMenu();
    } else {
      if (hamburger) hamburger.classList.add("active");
      if (nav) nav.classList.add("open");
      if (overlay) overlay.classList.add("active");
      document.body.style.overflow = "hidden";
    }
  }

  if (hamburger) hamburger.addEventListener("click", toggleMenu);
  if (overlay) overlay.addEventListener("click", closeMenu);
  document.querySelectorAll(".nav-link").forEach(function (link) {
    link.addEventListener("click", closeMenu);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeMenu();
  });

  // ============================================================
  // ACTIVE NAV ON SCROLL
  // ============================================================
  var sections = document.querySelectorAll("section[id]");
  var navLinks = document.querySelectorAll(".nav-link");

  window.addEventListener("scroll", function () {
    var current = "";
    sections.forEach(function (section) {
      if (window.scrollY >= section.offsetTop - 120) {
        current = section.getAttribute("id");
      }
    });
    navLinks.forEach(function (link) {
      link.classList.toggle(
        "active",
        link.getAttribute("href") === "#" + current,
      );
    });
  });

  // ============================================================
  // PRODUCT FILTER (category button active-state only)
  // Actual show/hide for category — combined with price, sort and
  // search — happens in applyFilters() further down, since a
  // product now has to match ALL active filters at once, not just
  // category alone.
  // ============================================================
  var filterBtns = document.querySelectorAll(".filter-btn");

  filterBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      filterBtns.forEach(function (b) {
        b.classList.remove("active");
      });
      btn.classList.add("active");
    });
  });

  // ============================================================
  // BACK TO TOP
  // ============================================================
  var backToTop = document.getElementById("back-to-top");
  if (backToTop) {
    window.addEventListener("scroll", function () {
      backToTop.style.display = window.scrollY > 400 ? "flex" : "none";
    });
    backToTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // NOTE: shopping cart logic lives in js/cart.js now, and the
  // checkout/order flow lives in js/checkout.js. Keeping cart
  // code out of this file so nothing else in here can interfere
  // with the "Place Order" button.
});

// ============================================================
// PRODUCT CARD CLICK — clicking anywhere on a product card
// (except a link, button, or dropdown inside it) opens that
// product's detail page. Works for the main shop grid,
// new arrivals, and the accessories section, since they all
// use the same data-product-id attribute on their <img>.
// ============================================================
document.addEventListener("click", function (e) {
  var card = e.target.closest(".product-card, .arrival-card, .acc-card");
  if (!card) return;
  if (
    e.target.closest("a") ||
    e.target.closest("button") ||
    e.target.closest("select")
  )
    return;

  var img = card.querySelector("img[data-product-id]");
  if (!img) return;
  var id = img.getAttribute("data-product-id");
  card.style.cursor = "pointer";

  // Don't put base64 image data in the URL — only pass &img= for
  // real image paths. product.html always has product.img from the
  // database as a fallback anyway.
  var url = "product.html?id=" + id;
  if (img.src.indexOf("data:") !== 0) {
    url += "&img=" + encodeURIComponent(img.src);
  }
  window.location.href = url;
});

// ============================================================
// PRICE + SORT FILTERS
// ============================================================
document.addEventListener("DOMContentLoaded", function () {
  var priceFilter = document.getElementById("price-filter");
  var sortFilter = document.getElementById("sort-filter");
  var searchFilter = document.getElementById("search-filter");
  if (!priceFilter || !sortFilter) return;

  function getPrice(card) {
    var el = card.querySelector(".product-price");
    if (!el) return 0;
    return parseInt(el.textContent.replace(/[^0-9]/g, "")) || 0;
  }

  function getName(card) {
    var el = card.querySelector(".product-name");
    return el ? el.textContent.trim() : "";
  }

  function applyFilters() {
    var priceVal = priceFilter.value;
    var sortVal = sortFilter.value;
    var searchVal = searchFilter ? searchFilter.value.trim().toLowerCase() : "";
    var activeCategory =
      (document.querySelector(".filter-btn.active") || {}).dataset.filter ||
      "all";
    var grid = document.getElementById("shopGrid");
    if (!grid) return;

    var cards = Array.from(grid.querySelectorAll(".product-card"));

    // Show/hide by category, price and search — a card only stays
    // visible if it matches ALL active filters at once, not just one.
    cards.forEach(function (card) {
      var categoryMatch =
        activeCategory === "all" || card.dataset.category === activeCategory;
      var price = getPrice(card);
      var priceMatch = true;
      if (priceVal !== "all") {
        var parts = priceVal.split("-");
        var min = parseInt(parts[0]);
        var max = parseInt(parts[1]);
        priceMatch = price >= min && price <= max;
      }
      var searchMatch =
        !searchVal || getName(card).toLowerCase().indexOf(searchVal) !== -1;
      card.classList.toggle(
        "hidden",
        !(categoryMatch && priceMatch && searchMatch),
      );
    });

    // Sort visible cards
    if (sortVal !== "default") {
      var visible = cards.filter(function (c) {
        return !c.classList.contains("hidden");
      });
      visible.sort(function (a, b) {
        if (sortVal === "price-low") return getPrice(a) - getPrice(b);
        if (sortVal === "price-high") return getPrice(b) - getPrice(a);
        if (sortVal === "name") return getName(a).localeCompare(getName(b));
        return 0;
      });
      visible.forEach(function (card) {
        grid.appendChild(card);
      });
    }

    // Let the shopper know clearly when nothing matches, instead of
    // just leaving them looking at an empty grid.
    var noResultsEl = document.getElementById("shop-no-results");
    if (noResultsEl) {
      var anyVisible = cards.some(function (c) {
        return !c.classList.contains("hidden");
      });
      noResultsEl.style.display =
        cards.length && !anyVisible ? "block" : "none";
    }
  }

  priceFilter.addEventListener("change", applyFilters);
  sortFilter.addEventListener("change", applyFilters);

  if (searchFilter) {
    // A short debounce so filtering doesn't re-run on every single
    // keystroke while someone is still typing.
    var searchDebounce;
    searchFilter.addEventListener("input", function () {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(applyFilters, 150);
    });
  }

  // Hook into existing category filter buttons
  document.querySelectorAll(".filter-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setTimeout(applyFilters, 10);
    });
  });

  // Products load asynchronously (see products-render.js). Re-run
  // filters once they're actually in the DOM, in case the shopper
  // already typed a search or picked a filter before the fetch
  // finished — otherwise the freshly-added cards would ignore
  // whatever was already selected.
  var shopGridEl = document.getElementById("shopGrid");
  if (shopGridEl) {
    var gridObserver = new MutationObserver(function () {
      applyFilters();
    });
    gridObserver.observe(shopGridEl, { childList: true });
  }
});
