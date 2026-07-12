var API = "/api";
var token = localStorage.getItem("janelle_token");
var user = JSON.parse(localStorage.getItem("janelle_user") || "null");

// Escapes text before it goes into innerHTML, so a name, message,
// or review comment containing something like <script> just shows
// up as plain text instead of running in the browser. Anywhere
// customer-entered text gets displayed, it should go through this.
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

if (!token || !user) {
  window.location.href = "login.html";
} else {
  document.getElementById("acc-name").textContent = user.name;
  document.getElementById("acc-email").textContent = user.email;
}

document.getElementById("logout-btn").addEventListener("click", function () {
  localStorage.removeItem("janelle_token");
  localStorage.removeItem("janelle_user");
  window.location.href = "index.html";
});

document.querySelectorAll(".acc-nav-btn").forEach(function (btn) {
  btn.addEventListener("click", function () {
    document.querySelectorAll(".acc-nav-btn").forEach(function (b) {
      b.classList.remove("active");
    });
    document.querySelectorAll(".acc-tab").forEach(function (t) {
      t.classList.remove("active");
    });
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  });
});

function formatDate(d) {
  return new Date(d).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusSteps(status) {
  var steps = ["pending", "confirmed", "processing", "shipped", "delivered"];
  var current = steps.indexOf(status);
  if (status === "cancelled") {
    return '<div class="track-cancelled">Order Cancelled</div>';
  }
  var html = '<div class="track-bar">';
  steps.forEach(function (step, i) {
    var cls =
      i < current
        ? "track-step done"
        : i === current
          ? "track-step active"
          : "track-step";
    var labels = {
      pending: "Pending",
      confirmed: "Confirmed",
      processing: "Processing",
      shipped: "Shipped",
      delivered: "Delivered",
    };
    html +=
      '<div class="' +
      cls +
      '"><div class="track-dot"></div><div class="track-label">' +
      labels[step] +
      "</div></div>";
    if (i < steps.length - 1)
      html +=
        '<div class="track-line' + (i < current ? " done" : "") + '"></div>';
  });
  html += "</div>";
  return html;
}

// ============================================================
// PAYMENT PROOF — customer uploads a screenshot of their bank
// transfer after placing an order, admin confirms it later.
// ============================================================

function paymentProofHtml(o) {
  if (o.paymentStatus === "confirmed") {
    return '<div class="acc-payment-block confirmed">✅ Payment Confirmed</div>';
  }
  if (o.paymentStatus === "proof_submitted") {
    return (
      '<div class="acc-payment-block pending-review">' +
      '<div class="acc-payment-label">🧾 Payment proof submitted — awaiting confirmation</div>' +
      (o.paymentProof
        ? '<img class="acc-payment-thumb" src="' +
          o.paymentProof +
          '" alt="Payment proof" />'
        : "") +
      "</div>"
    );
  }
  // Legacy orders placed before proof was required at checkout.
  // No upload form here anymore — proof is now mandatory at checkout time.
  return '<div class="acc-payment-block awaiting">⚠️ No payment proof on file for this order. Please contact us.</div>';
}

function wirePaymentProofForms() {
  // No-op: payment proof is collected during checkout now, nothing to wire up here.
}

var myReviewedItems = []; // filled by loadMyReviews(), list of "orderId::productName"

function reviewKey(orderId, productName) {
  return orderId + "::" + productName;
}

async function loadMyReviews() {
  try {
    var res = await fetch(API + "/reviews/my", {
      headers: { Authorization: "Bearer " + token },
    });
    var reviews = await res.json();
    myReviewedItems = reviews.map(function (r) {
      return reviewKey(r.order, r.productName);
    });
  } catch (err) {
    myReviewedItems = [];
  }
}

// Shrinks a photo down before turning it into base64, so review
// photos don't balloon the database. Keeps things around 700px
// wide at moderate JPEG quality — plenty sharp for a review photo.
function resizePhotoFile(file, callback) {
  var reader = new FileReader();
  reader.onload = function (e) {
    var img = new Image();
    img.onload = function () {
      var maxWidth = 700;
      var scale = Math.min(1, maxWidth / img.width);
      var canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      var ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      callback(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function reviewFormHtml(orderId, productName) {
  var key = reviewKey(orderId, productName);
  if (myReviewedItems.indexOf(key) !== -1) {
    return '<div class="acc-reviewed-tag">✅ You reviewed this item</div>';
  }
  var safeId = (orderId + "-" + productName).replace(/[^a-zA-Z0-9]/g, "");
  var safeName = escapeHtml(productName);
  return (
    '<button class="acc-review-toggle-btn" data-form="review-form-' +
    safeId +
    '">⭐ Leave a Review</button>' +
    '<div class="acc-review-form" id="review-form-' +
    safeId +
    '" style="display:none">' +
    '<div class="acc-star-picker" data-order="' +
    orderId +
    '" data-product="' +
    safeName +
    '">' +
    '<span class="acc-star" data-value="1">☆</span>' +
    '<span class="acc-star" data-value="2">☆</span>' +
    '<span class="acc-star" data-value="3">☆</span>' +
    '<span class="acc-star" data-value="4">☆</span>' +
    '<span class="acc-star" data-value="5">☆</span>' +
    "</div>" +
    '<textarea class="acc-review-comment" rows="3" placeholder="How was it? What did you love?"></textarea>' +
    '<input type="file" class="acc-review-photo" accept="image/*" />' +
    '<div class="acc-review-photo-preview" style="display:none"></div>' +
    '<div class="acc-review-error" style="display:none"></div>' +
    '<button class="acc-review-submit-btn" data-order="' +
    orderId +
    '" data-product="' +
    safeName +
    '">Submit Review</button>' +
    "</div>"
  );
}

function wireReviewForms() {
  document.querySelectorAll(".acc-review-toggle-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var form = document.getElementById(btn.dataset.form);
      var isOpen = form.style.display === "block";
      form.style.display = isOpen ? "none" : "block";
    });
  });

  document.querySelectorAll(".acc-star-picker").forEach(function (picker) {
    var stars = picker.querySelectorAll(".acc-star");

    function paintStars(uptoValue) {
      stars.forEach(function (s) {
        var isFilled = parseInt(s.dataset.value) <= uptoValue;
        s.classList.toggle("filled", isFilled);
        s.textContent = isFilled ? "★" : "☆";
      });
    }

    stars.forEach(function (star) {
      star.addEventListener("click", function () {
        picker.dataset.rating = star.dataset.value;
        paintStars(parseInt(star.dataset.value));
      });
      star.addEventListener("mouseenter", function () {
        paintStars(parseInt(star.dataset.value));
      });
    });

    picker.addEventListener("mouseleave", function () {
      paintStars(parseInt(picker.dataset.rating || "0"));
    });
  });

  document.querySelectorAll(".acc-review-photo").forEach(function (input) {
    input.addEventListener("change", function () {
      var file = input.files[0];
      var preview = input.parentElement.querySelector(
        ".acc-review-photo-preview",
      );
      if (!file) {
        preview.style.display = "none";
        return;
      }
      resizePhotoFile(file, function (dataUrl) {
        input.dataset.photo = dataUrl;
        preview.innerHTML = '<img src="' + dataUrl + '" alt="Preview" />';
        preview.style.display = "block";
      });
    });
  });

  document.querySelectorAll(".acc-review-submit-btn").forEach(function (btn) {
    btn.addEventListener("click", async function () {
      var formWrap = btn.closest(".acc-review-form");
      var picker = formWrap.querySelector(".acc-star-picker");
      var comment = formWrap.querySelector(".acc-review-comment").value.trim();
      var photoInput = formWrap.querySelector(".acc-review-photo");
      var errorEl = formWrap.querySelector(".acc-review-error");
      var rating = parseInt(picker.dataset.rating || "0");

      if (!rating) {
        errorEl.textContent = "Please pick a star rating.";
        errorEl.style.display = "block";
        return;
      }
      if (!comment) {
        errorEl.textContent = "Please write a short comment.";
        errorEl.style.display = "block";
        return;
      }

      btn.disabled = true;
      btn.textContent = "Submitting...";

      try {
        var res = await fetch(API + "/reviews", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify({
            orderId: btn.dataset.order,
            productName: btn.dataset.product,
            rating: rating,
            comment: comment,
            photo: photoInput.dataset.photo || undefined,
          }),
        });
        var data = await res.json();
        if (res.ok) {
          formWrap.innerHTML =
            '<div class="acc-reviewed-tag">✅ Thanks! Your review is awaiting approval.</div>';
        } else {
          errorEl.textContent = data.message || "Could not submit review.";
          errorEl.style.display = "block";
          btn.disabled = false;
          btn.textContent = "Submit Review";
        }
      } catch (err) {
        errorEl.textContent = "Connection error. Please try again.";
        errorEl.style.display = "block";
        btn.disabled = false;
        btn.textContent = "Submit Review";
      }
    });
  });
}

async function loadOrders() {
  var el = document.getElementById("orders-list");
  el.innerHTML =
    '<div class="loading-state"><span class="spinner"></span> Loading your orders...</div>';
  try {
    await loadMyReviews();
    var res = await fetch(API + "/orders/my", {
      headers: { Authorization: "Bearer " + token },
    });
    var orders = await res.json();
    if (!orders.length) {
      el.innerHTML =
        '<p class="acc-empty">You have no orders yet. Start shopping!</p>';
      return;
    }
    var html = "";
    orders.forEach(function (o) {
      var items = "";
      o.items.forEach(function (i) {
        items +=
          '<div class="acc-order-item">' +
          escapeHtml(i.name) +
          " x" +
          i.qty +
          " — " +
          escapeHtml(i.price) +
          "</div>";
        if (o.status === "delivered") {
          items += reviewFormHtml(o._id, i.name);
        }
      });
      html += '<div class="acc-order-card">';
      html += '<div class="acc-order-header">';
      html +=
        '<div><div class="acc-order-id">ORDER #' +
        o._id.slice(-6).toUpperCase() +
        "</div>";
      html +=
        '<div class="acc-order-date">' +
        formatDate(o.createdAt) +
        "</div></div>";
      html +=
        '<span class="acc-status ' +
        o.status +
        '">' +
        o.status.toUpperCase() +
        "</span>";
      html += "</div>";
      html += statusSteps(o.status);
      html += paymentProofHtml(o);
      html +=
        '<div class="acc-order-items" style="margin-top:1rem">' +
        items +
        "</div>";
      if (o.deliveryMethod === "pickup") {
        html += '<div class="acc-order-items">🛍️ Self-Pickup (Lagos)</div>';
      } else if (o.shippingAddress && o.shippingAddress.address) {
        html +=
          '<div class="acc-order-items">📍 ' +
          escapeHtml(o.shippingAddress.address) +
          ", " +
          escapeHtml(o.shippingAddress.city) +
          ", " +
          escapeHtml(o.shippingAddress.state) +
          "</div>";
      }
      html +=
        '<div class="acc-order-total">Total: ₦' +
        o.total.toLocaleString() +
        "</div>";
      html += "</div>";
    });
    el.innerHTML = html;
    wireReviewForms();
    wirePaymentProofForms();
  } catch (err) {
    el.innerHTML = '<p class="acc-empty">Could not load orders.</p>';
  }
}

// ============================================================
// CHAT WITH US — live two-way thread with the admin
// ============================================================

var chatPhotoDataUrl = null; // set when a photo is attached, cleared after sending
var chatPollTimer = null;

function chatBubbleHtml(m) {
  var mine = m.sender === "customer";
  var html = '<div class="chat-bubble-row ' + (mine ? "mine" : "theirs") + '">';
  html += '<div class="chat-bubble">';
  if (m.photo)
    html +=
      '<img class="chat-bubble-photo" src="' +
      m.photo +
      '" alt="Attached photo" />';
  if (m.text)
    html += '<div class="chat-bubble-text">' + escapeHtml(m.text) + "</div>";
  html += '<div class="chat-bubble-time">' + formatDate(m.createdAt) + "</div>";
  html += "</div></div>";
  return html;
}

async function loadChatThread(isFirstLoad) {
  var el = document.getElementById("chat-thread");
  if (isFirstLoad)
    el.innerHTML =
      '<div class="loading-state"><span class="spinner"></span> Loading...</div>';
  try {
    var res = await fetch(API + "/chat/my", {
      headers: { Authorization: "Bearer " + token },
    });
    var messages = await res.json();

    if (!messages.length) {
      el.innerHTML = '<p class="acc-empty">No messages yet — say hello! 👋</p>';
    } else {
      var wasScrolledToBottom =
        el.scrollTop + el.clientHeight >= el.scrollHeight - 30;
      el.innerHTML = messages.map(chatBubbleHtml).join("");
      if (isFirstLoad || wasScrolledToBottom) el.scrollTop = el.scrollHeight;
    }

    // We just fetched (and the backend marked admin replies read),
    // so the badge can go quiet now.
    updateChatBadge(0);
  } catch (err) {
    if (isFirstLoad)
      el.innerHTML =
        '<p class="acc-empty">Could not load chat. Please refresh.</p>';
  }
}

function updateChatBadge(count) {
  var badge = document.getElementById("chat-unread-badge");
  if (!badge) return;
  badge.textContent = count;
  badge.style.display = count > 0 ? "inline-block" : "none";
}

async function pollChatBadgeIfNotOnChatTab() {
  var chatTabActive = document
    .getElementById("tab-chat")
    .classList.contains("active");
  if (chatTabActive) return; // loadChatThread() already keeps this fresh
  try {
    var res = await fetch(API + "/chat/my/unread-count", {
      headers: { Authorization: "Bearer " + token },
    });
    var data = await res.json();
    updateChatBadge(data.count);
  } catch (err) {
    /* quiet fail, not critical */
  }
}

function startChatPolling() {
  loadChatThread(true);
  pollChatBadgeIfNotOnChatTab();
  chatPollTimer = setInterval(function () {
    var chatTabActive = document
      .getElementById("tab-chat")
      .classList.contains("active");
    if (chatTabActive) {
      loadChatThread(false);
    } else {
      pollChatBadgeIfNotOnChatTab();
    }
  }, 6000);
}

document
  .getElementById("chat-photo-btn")
  .addEventListener("click", function () {
    document.getElementById("chat-photo-input").click();
  });

document
  .getElementById("chat-photo-input")
  .addEventListener("change", function () {
    var file = this.files[0];
    if (!file) return;
    resizePhotoFile(file, function (dataUrl) {
      chatPhotoDataUrl = dataUrl;
      document.getElementById("chat-photo-preview-img").src = dataUrl;
      document.getElementById("chat-photo-preview").style.display = "flex";
    });
  });

document
  .getElementById("chat-photo-remove-btn")
  .addEventListener("click", function () {
    chatPhotoDataUrl = null;
    document.getElementById("chat-photo-input").value = "";
    document.getElementById("chat-photo-preview").style.display = "none";
  });

async function sendChatMessage() {
  var input = document.getElementById("chat-text-input");
  var text = input.value.trim();
  if (!text && !chatPhotoDataUrl) return;

  var sendBtn = document.getElementById("chat-send-btn");
  sendBtn.disabled = true;

  try {
    var res = await fetch(API + "/chat/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ text: text, photo: chatPhotoDataUrl }),
    });
    if (res.ok) {
      input.value = "";
      chatPhotoDataUrl = null;
      document.getElementById("chat-photo-input").value = "";
      document.getElementById("chat-photo-preview").style.display = "none";
      loadChatThread(false);
    }
  } catch (err) {
    console.log("Could not send message:", err);
  } finally {
    sendBtn.disabled = false;
  }
}

document
  .getElementById("chat-send-btn")
  .addEventListener("click", sendChatMessage);
document
  .getElementById("chat-text-input")
  .addEventListener("keydown", function (e) {
    if (e.key === "Enter") sendChatMessage();
  });

// Show a success banner if we just landed here from checkout
if (window.location.search.indexOf("order=success") !== -1) {
  var banner = document.createElement("div");
  banner.className = "acc-success";
  banner.textContent =
    "✅ Order placed successfully! Track its progress below.";
  var ordersTab = document.getElementById("tab-orders");
  ordersTab.insertBefore(banner, ordersTab.querySelector("h2").nextSibling);
}

loadOrders();
startChatPolling();
