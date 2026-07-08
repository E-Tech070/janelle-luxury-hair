// ============================================================
// SALE BADGES
// Looks up each product card against PRODUCTS (products-data.js).
// If that product has an "oldPrice" set, shows the old price
// struck through plus a "Save X%" badge next to the price.
// To put a product on sale: just add an oldPrice to its entry
// in js/products-data.js — no HTML editing needed.
// ============================================================

function applySaleBadges() {
  if (typeof PRODUCTS === "undefined") return;

  document.querySelectorAll(".product-card, .arrival-card, .acc-card").forEach(function(card) {
    var img = card.querySelector("img[data-product-id]");
    var priceEl = card.querySelector(".product-price, .arrival-price, .acc-price");
    if (!img || !priceEl) return;

    var id = img.getAttribute("data-product-id");
    var product = null;
    for (var i = 0; i < PRODUCTS.length; i++) {
      if (PRODUCTS[i].id === id) { product = PRODUCTS[i]; break; }
    }
    if (!product || !product.oldPrice) return;
    if (priceEl.querySelector(".sale-old-price")) return; // already added

    var oldNum = parseInt(String(product.oldPrice).replace(/[^0-9]/g, ""), 10);
    var newNum = product.numericPrice;
    var percentOff = Math.round(((oldNum - newNum) / oldNum) * 100);

    var oldPriceSpan = document.createElement("span");
    oldPriceSpan.className = "sale-old-price";
    oldPriceSpan.textContent = product.oldPrice;

    var saveBadge = document.createElement("span");
    saveBadge.className = "sale-save-badge";
    saveBadge.textContent = "Save " + percentOff + "%";

    priceEl.insertAdjacentElement("beforebegin", oldPriceSpan);
    priceEl.insertAdjacentElement("afterend", saveBadge);
  });
}

document.addEventListener("DOMContentLoaded", applySaleBadges);
