var qty = 1;
var PRODUCT_API = "/api/products";

// Product data now comes from MongoDB via the API. For items not
// yet migrated into the database (accessories, some new-arrival
// items), we fall back to the old products-data.js array so their
// detail pages keep working too.

function getParam(name) {
  var url = new URL(window.location.href);
  return url.searchParams.get(name);
}

function loadProduct() {
  var id = getParam("id");

  fetch(PRODUCT_API + "/" + id)
    .then(function (res) {
      if (!res.ok) throw new Error("not found in database");
      return res.json();
    })
    .then(function (product) {
      renderProduct(product);
    })
    .catch(function () {
      var fallback = null;
      if (typeof PRODUCTS !== "undefined") {
        for (var i = 0; i < PRODUCTS.length; i++) {
          if (PRODUCTS[i].id === id) {
            fallback = PRODUCTS[i];
            break;
          }
        }
      }
      if (fallback) renderProduct(fallback);
      else {
        document.querySelector(".product-container").innerHTML =
          '<p style="color:#888;text-align:center;grid-column:1/-1;padding:4rem;">Product not found. <a href="index.html#shop" style="color:#c9a84c;">Back to shop</a></p>';
      }
    });
}

function renderProduct(product) {
  window.currentProduct = product;

  document.title = product.name + " – Janelle Luxury Hairs";
  document.getElementById("breadcrumb-name").textContent = product.name;

  var urlImg = getParam("img");
  document.getElementById("product-img").src = urlImg
    ? decodeURIComponent(urlImg)
    : product.img;
  document.getElementById("product-img").alt = product.name;

  if (product.badge) {
    document.getElementById("product-badge-display").textContent =
      product.badge;
    document.getElementById("product-badge-display").style.display =
      "inline-block";
  }

  document.getElementById("product-category-display").textContent =
    product.category;
  document.getElementById("product-name-display").textContent = product.name;
  document.getElementById("product-price-display").textContent = product.price;

  if (product.oldPrice) {
    document.getElementById("product-old-price").textContent = product.oldPrice;
    document.getElementById("product-old-price").style.display = "inline";
  }

  var specsHtml = "";
  product.specs.forEach(function (s) {
    specsHtml +=
      '<div class="spec-item"><span class="spec-label">' +
      s.label +
      '</span><span class="spec-value">' +
      s.value +
      "</span></div>";
  });
  document.getElementById("product-specs").innerHTML = specsHtml;

  document.getElementById("product-desc-display").textContent = product.desc;

  document.getElementById("qty-minus").addEventListener("click", function () {
    if (qty > 1) {
      qty--;
      document.getElementById("qty-num").textContent = qty;
    }
  });
  document.getElementById("qty-plus").addEventListener("click", function () {
    qty++;
    document.getElementById("qty-num").textContent = qty;
  });

  document
    .getElementById("add-to-cart-btn")
    .addEventListener("click", function () {
      addToCart(
        product.name,
        product.price,
        urlImg ? decodeURIComponent(urlImg) : product.img,
        qty,
      );
      document.getElementById("add-success").style.display = "block";
      document.getElementById("add-to-cart-btn").textContent = "✅ Added!";
      setTimeout(function () {
        document.getElementById("add-success").style.display = "none";
        document.getElementById("add-to-cart-btn").innerHTML =
          '<i class="bi bi-bag-plus"></i> Add to Cart';
      }, 3000);
    });
}

loadProduct();
