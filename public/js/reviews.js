// ============================================================
// PUBLIC REVIEW DISPLAY
// Shows a small star-rating line under each product's name on
// the shop grid (and on the product detail page), pulled from
// the review summary endpoint. Clicking it opens a modal with
// the individual reviews, including any customer photos.
// ============================================================

var REVIEWS_API = "/api/reviews";

// Escapes text before it goes into innerHTML. This one matters
// most of all — this file shows review text to EVERY visitor of
// the shop, not just the admin, so an unescaped review comment
// would be a script that runs in every shopper's browser.
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function starString(avg) {
  var full = Math.round(avg);
  var out = "";
  for (var i = 1; i <= 5; i++) {
    out += i <= full ? "★" : "☆";
  }
  return out;
}

function buildReviewsModal() {
  if (document.getElementById("reviews-modal")) return;
  var wrap = document.createElement("div");
  wrap.innerHTML =
    '<div id="reviews-modal" class="reviews-modal">' +
      '<div class="reviews-modal-box">' +
        '<div class="reviews-modal-header">' +
          '<h3 id="reviews-modal-title">Reviews</h3>' +
          '<button id="reviews-modal-close">✕</button>' +
        '</div>' +
        '<div id="reviews-modal-list" class="reviews-modal-list"></div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(wrap);
  document.getElementById("reviews-modal-close").addEventListener("click", closeReviewsModal);
  document.getElementById("reviews-modal").addEventListener("click", function(e) {
    if (e.target.id === "reviews-modal") closeReviewsModal();
  });
}

function openReviewsModal(productName) {
  buildReviewsModal();
  document.getElementById("reviews-modal-title").textContent = "Reviews — " + productName;
  var listEl = document.getElementById("reviews-modal-list");
  listEl.innerHTML = '<p class="reviews-loading">Loading reviews...</p>';
  document.getElementById("reviews-modal").classList.add("open");
  document.body.style.overflow = "hidden";

  fetch(REVIEWS_API + "/product/" + encodeURIComponent(productName))
    .then(function(res) { return res.json(); })
    .then(function(reviews) {
      if (!reviews.length) {
        listEl.innerHTML = '<p class="reviews-empty">No reviews yet for this product.</p>';
        return;
      }
      var html = "";
      reviews.forEach(function(r) {
        html += '<div class="review-card">';
        html += '<div class="review-card-top"><span class="review-card-stars">' + starString(r.rating) + '</span><span class="review-card-name">' + escapeHtml(r.userName) + '</span></div>';
        if (r.photo && r.photo.indexOf("data:image/") === 0) html += '<img class="review-card-photo" src="' + r.photo + '" alt="Customer photo" />';
        html += '<p class="review-card-comment">' + escapeHtml(r.comment) + '</p>';
        html += '</div>';
      });
      listEl.innerHTML = html;
    })
    .catch(function() {
      listEl.innerHTML = '<p class="reviews-empty">Could not load reviews.</p>';
    });
}

function closeReviewsModal() {
  var modal = document.getElementById("reviews-modal");
  if (!modal) return;
  modal.classList.remove("open");
  document.body.style.overflow = "";
}

function applyRatingBadgesToCards() {
  fetch(REVIEWS_API + "/summary")
    .then(function(res) { return res.json(); })
    .then(function(summary) {
      document.querySelectorAll(".product-card, .arrival-card, .acc-card").forEach(function(card) {
        var nameEl = card.querySelector(".product-name, .arrival-name, .acc-name");
        if (!nameEl) return;
        if (nameEl.parentElement.querySelector(".review-rating-badge")) return;

        var name = nameEl.textContent.trim();
        var data = summary[name];
        if (!data) return;

        var badge = document.createElement("div");
        badge.className = "review-rating-badge";
        badge.innerHTML = '<span class="review-stars">' + starString(data.avg) + '</span><span class="review-count">(' + data.count + ')</span>';
        badge.addEventListener("click", function(e) {
          e.stopPropagation();
          openReviewsModal(name);
        });
        nameEl.insertAdjacentElement("afterend", badge);
      });
    })
    .catch(function() {});
}

function applyRatingBadgeToProductPage() {
  if (typeof window.currentProduct === "undefined" || !window.currentProduct) return;
  var name = window.currentProduct.name;
  var titleEl = document.getElementById("product-name-display");
  if (!titleEl) return;

  fetch(REVIEWS_API + "/summary")
    .then(function(res) { return res.json(); })
    .then(function(summary) {
      var data = summary[name];
      var badge = document.createElement("div");
      badge.className = "review-rating-badge review-rating-badge-large";
      if (data) {
        badge.innerHTML = '<span class="review-stars">' + starString(data.avg) + '</span><span class="review-count">' + data.avg + ' · ' + data.count + ' review' + (data.count === 1 ? "" : "s") + '</span>';
        badge.addEventListener("click", function() { openReviewsModal(name); });
      } else {
        badge.innerHTML = '<span class="review-count">No reviews yet — be the first!</span>';
      }
      titleEl.insertAdjacentElement("afterend", badge);
    })
    .catch(function() {});
}

document.addEventListener("DOMContentLoaded", function() {
  applyRatingBadgesToCards();
  applyRatingBadgeToProductPage();
});
