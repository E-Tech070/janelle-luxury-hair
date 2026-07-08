// ============================================================
// SHOP GRID — RENDERED FROM THE DATABASE
// Replaces the old hardcoded product cards. Fetches everything
// from /api/products and builds cards with the exact same
// classes/structure the static cards used to have, so cart.js
// (wireAddToCartButtons), the product-click-to-detail handler,
// and the price/sort filter in script.js all keep working
// without needing to know the cards are now dynamic.
// ============================================================

var PRODUCTS_API = "http://localhost:5000/api/products";
var WHATSAPP_NUMBER = "2348107796481";

function buildProductCardHtml(p) {
  var waText = encodeURIComponent("Hi! I'm interested in the " + p.name);
  var waLink = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + waText;

  var badgeHtml = "";
  if (p.badge) {
    var badgeClass = p.badge.toLowerCase() === "new" ? "product-badge product-badge--new" : "product-badge";
    badgeHtml = '<span class="' + badgeClass + '">' + p.badge + '</span>';
  }

  var priceHtml = '<span class="product-price">' + p.price + '</span>';
  if (p.oldPrice) {
    var oldNum = parseInt(String(p.oldPrice).replace(/[^0-9]/g, ""), 10);
    var percentOff = Math.round(((oldNum - p.numericPrice) / oldNum) * 100);
    priceHtml = '<span class="sale-old-price">' + p.oldPrice + '</span>' +
      priceHtml +
      '<span class="sale-save-badge">Save ' + percentOff + '%</span>';
  }

  var outOfStockHtml = p.stock === 0 ? '<span class="product-badge" style="background:#e74c3c;">Out of Stock</span>' : "";

  return '<div class="product-card" data-category="' + p.category.toLowerCase() + '">' +
    '<div class="product-img-wrap">' +
      '<img src="' + p.img + '" data-product-id="' + p.id + '" alt="' + p.name + '" loading="lazy" />' +
      badgeHtml + outOfStockHtml +
      '<div class="product-actions">' +
        '<a href="' + waLink + '" target="_blank" class="product-order-btn">Order on WhatsApp</a>' +
      '</div>' +
    '</div>' +
    '<div class="product-info">' +
      '<span class="product-category">' + p.category + '</span>' +
      '<h3 class="product-name">' + p.name + '</h3>' +
      '<p class="product-desc">' + (p.desc || "") + '</p>' +
      '<div class="product-footer">' +
        priceHtml +
        '<a href="' + waLink + '" target="_blank" class="btn-icon" aria-label="Order on WhatsApp"><i class="bi bi-whatsapp"></i></a>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function renderShopGrid() {
  var grid = document.getElementById("shopGrid");
  if (!grid) return;

  fetch(PRODUCTS_API)
    .then(function(res) { return res.json(); })
    .then(function(products) {
      if (!products.length) {
        grid.innerHTML = '<p class="admin-empty">No products available right now.</p>';
        return;
      }
      grid.innerHTML = products.map(buildProductCardHtml).join("");

      // Now that the real cards exist, wire up "Add to Cart"
      // buttons (function lives in cart.js, loaded before this file).
      if (typeof wireAddToCartButtons === "function") wireAddToCartButtons();
    })
    .catch(function() {
      grid.innerHTML = '<p class="admin-empty">Could not load products. Please refresh the page.</p>';
    });
}

renderShopGrid();