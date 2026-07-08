// ============================================================
// SHOP GRID — RENDERED FROM THE DATABASE
// Replaces the old hardcoded product cards. Fetches everything
// from /api/products and builds cards with the exact same
// classes/structure the static cards used to have, so cart.js
// (wireAddToCartButtons) and the click-to-detail handler in
// script.js all keep working without needing to know the cards
// are now dynamic.
// ============================================================

var PRODUCTS_API = "/api/products";

function buildProductCardHtml(p) {
  var badgeHtml = "";
  if (p.badge) {
    var badgeClass =
      p.badge.toLowerCase() === "new"
        ? "product-badge product-badge--new"
        : "product-badge";
    badgeHtml = '<span class="' + badgeClass + '">' + p.badge + "</span>";
  }

  var priceHtml = '<span class="product-price">' + p.price + "</span>";
  if (p.oldPrice) {
    var oldNum = parseInt(String(p.oldPrice).replace(/[^0-9]/g, ""), 10);
    var percentOff = Math.round(((oldNum - p.numericPrice) / oldNum) * 100);
    priceHtml =
      '<span class="sale-old-price">' +
      p.oldPrice +
      "</span>" +
      priceHtml +
      '<span class="sale-save-badge">Save ' +
      percentOff +
      "%</span>";
  }

  var outOfStockHtml =
    p.stock === 0
      ? '<span class="product-badge" style="background:#e74c3c;">Out of Stock</span>'
      : "";

  return (
    '<div class="product-card" data-category="' +
    p.category.toLowerCase() +
    '">' +
    '<div class="product-img-wrap">' +
    '<img src="' +
    p.img +
    '" data-product-id="' +
    p.id +
    '" alt="' +
    p.name +
    '" loading="lazy" />' +
    badgeHtml +
    outOfStockHtml +
    "</div>" +
    '<div class="product-info">' +
    '<span class="product-category">' +
    p.category +
    "</span>" +
    '<h3 class="product-name">' +
    p.name +
    "</h3>" +
    '<p class="product-desc">' +
    (p.desc || "") +
    "</p>" +
    '<div class="product-footer">' +
    priceHtml +
    "</div>" +
    "</div>" +
    "</div>"
  );
}

function renderShopGrid() {
  var grid = document.getElementById("shopGrid");
  if (!grid) return;

  fetch(PRODUCTS_API)
    .then(function (res) {
      return res.json();
    })
    .then(function (products) {
      if (!products.length) {
        grid.innerHTML =
          '<p class="admin-empty">No products available right now.</p>';
        return;
      }
      grid.innerHTML = products.map(buildProductCardHtml).join("");

      // Now that the real cards exist, wire up "Add to Cart"
      // buttons (function lives in cart.js, loaded before this file).
      if (typeof wireAddToCartButtons === "function") wireAddToCartButtons();
    })
    .catch(function () {
      grid.innerHTML =
        '<p class="admin-empty">Could not load products. Please refresh the page.</p>';
    });
}

renderShopGrid();
