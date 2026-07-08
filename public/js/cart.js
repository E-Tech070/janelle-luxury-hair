// ============================================================
// JANELLE CART — single source of truth for the shopping cart.
//
// This is the ONLY file that touches the cart. Old versions of
// this site had THREE different scripts fighting over the
// "Place Order" button (script.js twice + orderoverride.js),
// which is why it sometimes failed. That is fixed by having
// just one file own the cart, from "Add to Cart" all the way
// to "Place Order" on the checkout page.
//
// The cart is saved to localStorage under "janelle_cart" so it
// survives page reloads and carries over from index.html to
// checkout.html.
// ============================================================

var CART_STORAGE_KEY = "janelle_cart";

// ------------------------------------------------------------
// STORAGE HELPERS
// ------------------------------------------------------------

function getCart() {
  var raw = localStorage.getItem(CART_STORAGE_KEY);
  if (!raw) return [];
  try {
    var parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch (err) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

function parsePrice(str) {
  var digits = String(str).replace(/[^0-9]/g, "");
  return parseInt(digits, 10) || 0;
}

function getCartTotal() {
  var cart = getCart();
  var total = 0;
  for (var i = 0; i < cart.length; i++) {
    total = total + (cart[i].numericPrice * cart[i].qty);
  }
  return total;
}

function getCartCount() {
  var cart = getCart();
  var count = 0;
  for (var i = 0; i < cart.length; i++) {
    count = count + cart[i].qty;
  }
  return count;
}

// ------------------------------------------------------------
// CART ACTIONS
// ------------------------------------------------------------

function addToCart(name, price, img, qty) {
  qty = qty || 1;
  var cart = getCart();
  var existing = null;
  for (var i = 0; i < cart.length; i++) {
    if (cart[i].name === name) existing = cart[i];
  }
  if (existing) {
    existing.qty = existing.qty + qty;
  } else {
    cart.push({ name: name, price: price, numericPrice: parsePrice(price), img: img, qty: qty });
  }
  saveCart(cart);
  renderCartDrawer();
  updateCartBadge();
}

function changeQty(name, delta) {
  var cart = getCart();
  var newCart = [];
  for (var i = 0; i < cart.length; i++) {
    var item = cart[i];
    if (item.name === name) {
      item.qty = item.qty + delta;
      if (item.qty > 0) newCart.push(item);
    } else {
      newCart.push(item);
    }
  }
  saveCart(newCart);
  renderCartDrawer();
  updateCartBadge();
}

function removeFromCart(name) {
  var cart = getCart();
  var newCart = [];
  for (var i = 0; i < cart.length; i++) {
    if (cart[i].name !== name) newCart.push(cart[i]);
  }
  saveCart(newCart);
  renderCartDrawer();
  updateCartBadge();
}

function clearCart() {
  saveCart([]);
  renderCartDrawer();
  updateCartBadge();
}

// ------------------------------------------------------------
// BUILD THE DRAWER (once, on every page that includes cart.js)
// ------------------------------------------------------------

function buildCartDrawer() {
  if (document.getElementById("cart-panel")) return; // already built

  var wrap = document.createElement("div");
  wrap.innerHTML =
    '<div id="cart-panel" class="cart-panel" role="dialog" aria-modal="true" aria-label="Shopping cart">' +
      '<div class="cart-panel-header">' +
        '<h3>🛍️ Your Cart</h3>' +
        '<button id="cart-close-btn" aria-label="Close cart">✕</button>' +
      '</div>' +
      '<div id="cart-list" class="cart-list"></div>' +
      '<div class="cart-panel-footer">' +
        '<div class="cart-total-row"><span>Total</span><span id="cart-total">₦0</span></div>' +
        '<button id="cart-checkout-btn" class="cart-checkout-btn" disabled>Proceed to Checkout →</button>' +
        '<button id="cart-clear-btn" class="cart-clear-btn">Clear Cart</button>' +
      '</div>' +
    '</div>' +
    '<div id="cart-backdrop" class="cart-backdrop"></div>';
  document.body.appendChild(wrap);

  document.getElementById("cart-close-btn").addEventListener("click", closeCartDrawer);
  document.getElementById("cart-backdrop").addEventListener("click", closeCartDrawer);
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") closeCartDrawer();
  });

  document.getElementById("cart-clear-btn").addEventListener("click", function() {
    clearCart();
  });

  document.getElementById("cart-checkout-btn").addEventListener("click", function() {
    if (getCartCount() === 0) return;
    window.location.href = "checkout.html";
  });
}

function openCartDrawer() {
  var panel = document.getElementById("cart-panel");
  var backdrop = document.getElementById("cart-backdrop");
  if (!panel || !backdrop) return;
  panel.classList.add("open");
  backdrop.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeCartDrawer() {
  var panel = document.getElementById("cart-panel");
  var backdrop = document.getElementById("cart-backdrop");
  if (!panel || !backdrop) return;
  panel.classList.remove("open");
  backdrop.classList.remove("active");
  document.body.style.overflow = "";
}

function renderCartDrawer() {
  var list = document.getElementById("cart-list");
  var totalEl = document.getElementById("cart-total");
  var checkoutBtn = document.getElementById("cart-checkout-btn");
  if (!list || !totalEl || !checkoutBtn) return;

  var cart = getCart();

  if (cart.length === 0) {
    list.innerHTML = '<p class="cart-empty">🛍️<br>Your cart is empty.<br>Add items to get started.</p>';
  } else {
    var html = "";
    for (var i = 0; i < cart.length; i++) {
      var item = cart[i];
      html +=
        '<div class="cart-item">' +
          '<img class="cart-item-img" src="' + item.img + '" alt="' + item.name + '" loading="lazy" />' +
          '<div class="cart-item-body">' +
            '<p class="cart-item-name">' + item.name + '</p>' +
            '<p class="cart-item-price">' + item.price + '</p>' +
            '<div class="cart-item-qty">' +
              '<button class="qty-btn" data-action="dec" data-name="' + item.name + '">-</button>' +
              '<span class="qty-num">' + item.qty + '</span>' +
              '<button class="qty-btn" data-action="inc" data-name="' + item.name + '">+</button>' +
            '</div>' +
          '</div>' +
          '<button class="cart-item-remove" data-name="' + item.name + '" aria-label="Remove">✕</button>' +
        '</div>';
    }
    list.innerHTML = html;

    var qtyBtns = list.querySelectorAll(".qty-btn");
    for (var q = 0; q < qtyBtns.length; q++) {
      qtyBtns[q].addEventListener("click", function() {
        var delta = this.dataset.action === "inc" ? 1 : -1;
        changeQty(this.dataset.name, delta);
      });
    }

    var removeBtns = list.querySelectorAll(".cart-item-remove");
    for (var r = 0; r < removeBtns.length; r++) {
      removeBtns[r].addEventListener("click", function() {
        removeFromCart(this.dataset.name);
      });
    }
  }

  totalEl.textContent = "₦" + getCartTotal().toLocaleString();
  checkoutBtn.disabled = cart.length === 0;
}

function updateCartBadge() {
  var badge = document.getElementById("cart-badge");
  if (!badge) return;
  var count = getCartCount();
  badge.textContent = count;
  badge.classList.toggle("visible", count > 0);
  badge.classList.remove("bounce");
  void badge.offsetWidth; // restart the animation
  if (count > 0) badge.classList.add("bounce");
}

// ------------------------------------------------------------
// WIRE UP "ADD TO CART" BUTTONS ON PRODUCT / ARRIVAL CARDS
// ------------------------------------------------------------

function wireAddToCartButtons() {
  var cards = document.querySelectorAll(".product-card, .arrival-card");
  cards.forEach(function(card) {
    var nameEl = card.querySelector(".product-name, .arrival-name");
    var priceEl = card.querySelector(".product-price, .arrival-price");
    var imgEl = card.querySelector("img");
    var infoEl = card.querySelector(".product-info, .arrival-info");
    if (!nameEl || !priceEl || !infoEl) return;
    if (infoEl.querySelector(".add-to-cart-btn")) return; // already wired

    var btn = document.createElement("button");
    btn.className = "add-to-cart-btn";
    btn.textContent = "+ Add to Cart";

    btn.addEventListener("click", function() {
      addToCart(nameEl.textContent.trim(), priceEl.textContent.trim(), imgEl ? imgEl.src : "");
      btn.textContent = "Added! ✓";
      btn.classList.add("added");
      setTimeout(function() {
        btn.textContent = "+ Add to Cart";
        btn.classList.remove("added");
      }, 1500);
      openCartDrawer();
    });

    infoEl.appendChild(btn);
  });
}

// ------------------------------------------------------------
// WIRE UP THE HEADER CART ICON
// ------------------------------------------------------------

function wireCartHeaderButton() {
  var headerBtn = document.getElementById("cart-header-link");
  if (!headerBtn) return;
  headerBtn.addEventListener("click", function(e) {
    e.preventDefault();
    openCartDrawer();
  });
}

// ------------------------------------------------------------
// INIT
// ------------------------------------------------------------

document.addEventListener("DOMContentLoaded", function() {
  buildCartDrawer();
  wireCartHeaderButton();
  wireAddToCartButtons();
  renderCartDrawer();
  updateCartBadge();
});
