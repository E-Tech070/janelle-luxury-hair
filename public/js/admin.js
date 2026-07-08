var API = "/api";
var token = localStorage.getItem("janelle_token");
var user = JSON.parse(localStorage.getItem("janelle_user") || "null");

if (!token || !user || user.role !== "admin") { window.location.href = "login.html"; }

document.getElementById("admin-logout").addEventListener("click", function() {
  localStorage.removeItem("janelle_token");
  localStorage.removeItem("janelle_user");
  window.location.href = "index.html";
});

document.querySelectorAll(".admin-nav-btn").forEach(function(btn) {
  btn.addEventListener("click", function() {
    document.querySelectorAll(".admin-nav-btn").forEach(function(b) { b.classList.remove("active"); });
    document.querySelectorAll(".admin-tab").forEach(function(t) { t.classList.remove("active"); });
    btn.classList.add("active");
    document.getElementById("admin-tab-" + btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "chat") loadConversations();
    if (btn.dataset.tab === "reviews") loadReviews();
    if (btn.dataset.tab === "products") loadProducts();
  });
});

function formatDate(d) {
  return new Date(d).toLocaleDateString("en-NG", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

function paymentStatusBadge(status) {
  if (status === "confirmed") return '<span style="background:rgba(46,204,113,.15);color:#2ecc71;padding:.2rem .65rem;border-radius:100px;font-size:.62rem;font-weight:700;text-transform:uppercase;">✅ Payment Confirmed</span>';
  if (status === "proof_submitted") return '<span style="background:rgba(241,196,15,.15);color:#f1c40f;padding:.2rem .65rem;border-radius:100px;font-size:.62rem;font-weight:700;text-transform:uppercase;">🧾 Proof Submitted</span>';
  return '<span style="background:rgba(231,76,60,.15);color:#e74c3c;padding:.2rem .65rem;border-radius:100px;font-size:.62rem;font-weight:700;text-transform:uppercase;">⏳ Awaiting Payment</span>';
}

// ============================================================
// ORDERS
// ============================================================
async function loadOrders() {
  try {
    var res = await fetch(API + "/orders/all", { headers: { "Authorization": "Bearer " + token } });
    var orders = await res.json();
    document.getElementById("orders-count").textContent = orders.length + " orders";
    var el = document.getElementById("admin-orders-list");
    if (!orders.length) { el.innerHTML = '<p class="admin-empty">No orders yet.</p>'; return; }
    var html = "";
    orders.forEach(function(o) {
      var items = "";
      o.items.forEach(function(i) { items += '<div class="admin-order-item">' + i.name + " x" + i.qty + " — " + i.price + "</div>"; });
      var proofHtml = "";
      if (o.paymentProof) {
        proofHtml = '<div class="admin-proof-wrap"><p class="admin-proof-label">💳 Payment Receipt:</p>' +
          '<img src="' + o.paymentProof + '" class="admin-proof-img" alt="Payment proof" onclick="this.classList.toggle(\'expanded\')" />' +
          (o.paymentStatus !== "confirmed" ? '<button class="admin-confirm-payment-btn" data-id="' + o._id + '">✅ Confirm Payment</button>' : "") +
          '</div>';
      }
      html += '<div class="admin-order-card"><div class="admin-order-header"><div class="admin-order-info">';
      html += "<h4>" + o.userName + "</h4><p>" + o.userEmail + (o.userPhone ? " · " + o.userPhone : "") + "</p><p>" + formatDate(o.createdAt) + "</p>";
      if (o.shippingAddress && o.shippingAddress.address) html += "<p>📍 " + o.shippingAddress.address + ", " + (o.shippingAddress.city || "") + ", " + (o.shippingAddress.state || "") + "</p>";
      if (o.deliveryMethod === "pickup") html += "<p>🛍️ Self-pickup</p>";
      html += "</div><div class='admin-order-meta'>";
      html += '<span class="acc-status ' + o.status + '">' + o.status.replace(/_/g, " ") + "</span>";
      html += paymentStatusBadge(o.paymentStatus);
      html += '<select class="status-select" data-id="' + o._id + '">';
      ["awaiting_payment","pending","confirmed","processing","shipped","delivered","cancelled"].forEach(function(s) {
        html += '<option value="' + s + '">' + s.replace(/_/g," ") + "</option>";
      });
      html += "</select></div></div>" + proofHtml;
      html += '<div class="admin-order-items">' + items + "</div>";
      html += '<div class="admin-order-total">Total: ₦' + o.total.toLocaleString() + "</div></div>";
    });
    el.innerHTML = html;

    document.querySelectorAll(".status-select").forEach(function(sel) {
      var order = orders.find(function(o) { return o._id === sel.dataset.id; });
      if (order) sel.value = order.status;
      sel.addEventListener("change", async function() {
        await fetch(API + "/orders/" + sel.dataset.id + "/status", {
          method: "PATCH", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
          body: JSON.stringify({ status: sel.value })
        });
        loadOrders();
      });
    });

    document.querySelectorAll(".admin-confirm-payment-btn").forEach(function(btn) {
      btn.addEventListener("click", async function() {
        btn.textContent = "Confirming..."; btn.disabled = true;
        await fetch(API + "/orders/" + btn.dataset.id + "/payment", {
          method: "PATCH", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token }
        });
        loadOrders();
      });
    });
  } catch(err) { document.getElementById("admin-orders-list").innerHTML = '<p class="admin-empty">Could not load orders.</p>'; }
}

// ============================================================
// CHAT
// ============================================================
var currentCustomerId = null;
var chatAdminPhotoDataUrl = null;
var chatPollTimer = null;

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function chatBubbleHtml(m) {
  var mine = m.sender === "admin";
  var html = '<div class="chat-bubble-row ' + (mine ? "mine" : "theirs") + '">';
  html += '<div class="chat-bubble">';
  if (m.photo) html += '<img class="chat-bubble-photo" src="' + m.photo + '" alt="Photo" />';
  if (m.text) html += '<div class="chat-bubble-text">' + escapeHtml(m.text) + '</div>';
  html += '<div class="chat-bubble-time">' + formatDate(m.createdAt) + '</div>';
  html += '</div></div>';
  return html;
}

async function loadConversations() {
  try {
    var res = await fetch(API + "/chat/conversations", { headers: { "Authorization": "Bearer " + token } });
    var convos = await res.json();
    var totalUnread = convos.reduce(function(s, c) { return s + c.unreadCount; }, 0);
    document.getElementById("unread-badge").textContent = totalUnread;
    document.getElementById("chat-conversations-count").textContent = convos.length + " conversations";
    var el = document.getElementById("admin-chat-list");
    if (!convos.length) { el.innerHTML = '<p class="admin-empty">No conversations yet.</p>'; return; }
    el.innerHTML = convos.map(function(c) {
      var preview = c.lastMessage.text ? escapeHtml(c.lastMessage.text).substring(0, 50) : "📷 Photo";
      return '<div class="admin-chat-list-item' + (currentCustomerId === String(c.customerId) ? " active" : "") + '" data-id="' + c.customerId + '">' +
        '<div class="admin-chat-list-top"><span>' + escapeHtml(c.customerName) + '</span>' +
        (c.unreadCount > 0 ? '<span class="unread-badge">' + c.unreadCount + '</span>' : '') + '</div>' +
        '<div class="admin-chat-list-preview">' + preview + '</div>' +
        '<div class="admin-chat-list-time">' + formatDate(c.lastMessage.createdAt) + '</div>' +
        '</div>';
    }).join("");
    el.querySelectorAll(".admin-chat-list-item").forEach(function(item) {
      item.addEventListener("click", function() {
        el.querySelectorAll(".admin-chat-list-item").forEach(function(i) { i.classList.remove("active"); });
        item.classList.add("active");
        openThread(item.dataset.id);
      });
    });
  } catch(err) { document.getElementById("admin-chat-list").innerHTML = '<p class="admin-empty">Could not load conversations.</p>'; }
}

async function openThread(customerId) {
  currentCustomerId = customerId;
  document.getElementById("admin-chat-thread-header").style.display = "block";
  document.getElementById("admin-chat-input-row").style.display = "flex";
  var threadEl = document.getElementById("admin-chat-thread");
  try {
    var res = await fetch(API + "/chat/" + customerId, { headers: { "Authorization": "Bearer " + token } });
    var messages = await res.json();
    if (!messages.length) {
      threadEl.innerHTML = '<p class="admin-empty">No messages yet.</p>';
    } else {
      var wasAtBottom = threadEl.scrollTop + threadEl.clientHeight >= threadEl.scrollHeight - 30;
      threadEl.innerHTML = messages.map(chatBubbleHtml).join("");
      if (wasAtBottom || threadEl.scrollTop === 0) threadEl.scrollTop = threadEl.scrollHeight;
    }
    loadConversations();
  } catch(err) { threadEl.innerHTML = '<p class="admin-empty">Could not load thread.</p>'; }
}

function resizePhotoFile(file, callback) {
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var maxWidth = 700;
      var scale = Math.min(1, maxWidth / img.width);
      var canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      callback(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

document.getElementById("admin-chat-photo-btn").addEventListener("click", function() {
  document.getElementById("admin-chat-photo-input").click();
});
document.getElementById("admin-chat-photo-input").addEventListener("change", function() {
  var file = this.files[0];
  if (!file) return;
  resizePhotoFile(file, function(dataUrl) {
    chatAdminPhotoDataUrl = dataUrl;
    document.getElementById("admin-chat-photo-preview-img").src = dataUrl;
    document.getElementById("admin-chat-photo-preview").style.display = "flex";
  });
});
document.getElementById("admin-chat-photo-remove-btn").addEventListener("click", function() {
  chatAdminPhotoDataUrl = null;
  document.getElementById("admin-chat-photo-input").value = "";
  document.getElementById("admin-chat-photo-preview").style.display = "none";
});

async function sendAdminReply() {
  if (!currentCustomerId) return;
  var input = document.getElementById("admin-chat-text-input");
  var text = input.value.trim();
  if (!text && !chatAdminPhotoDataUrl) return;
  var sendBtn = document.getElementById("admin-chat-send-btn");
  sendBtn.disabled = true;
  try {
    var res = await fetch(API + "/chat/" + currentCustomerId + "/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ text: text, photo: chatAdminPhotoDataUrl })
    });
    if (res.ok) {
      input.value = "";
      chatAdminPhotoDataUrl = null;
      document.getElementById("admin-chat-photo-input").value = "";
      document.getElementById("admin-chat-photo-preview").style.display = "none";
      openThread(currentCustomerId);
    }
  } catch(err) { console.log("Could not send reply:", err); }
  finally { sendBtn.disabled = false; }
}

document.getElementById("admin-chat-send-btn").addEventListener("click", sendAdminReply);
document.getElementById("admin-chat-text-input").addEventListener("keydown", function(e) {
  if (e.key === "Enter") sendAdminReply();
});

// Poll for new messages every 6 seconds when chat tab is open
setInterval(function() {
  var chatTabActive = document.getElementById("admin-tab-chat").classList.contains("active");
  if (chatTabActive) {
    loadConversations();
    if (currentCustomerId) openThread(currentCustomerId);
  }
}, 6000);

// ============================================================
// REVIEWS
// ============================================================
async function loadReviews() {
  try {
    var res = await fetch(API + "/reviews/pending", { headers: { "Authorization": "Bearer " + token } });
    var reviews = await res.json();
    document.getElementById("pending-reviews-badge").textContent = reviews.length;
    document.getElementById("reviews-count").textContent = reviews.length + " pending";
    var el = document.getElementById("admin-reviews-list");
    if (!reviews.length) { el.innerHTML = '<p class="admin-empty">No pending reviews.</p>'; return; }
    el.innerHTML = reviews.map(function(r) {
      return '<div class="admin-review-card pending" data-id="' + r._id + '">' +
        '<div class="admin-review-top"><span><strong>' + escapeHtml(r.productName) + '</strong> — ' + escapeHtml(r.userName) + '</span>' +
        '<span class="admin-review-stars">' + "★".repeat(r.rating) + "☆".repeat(5 - r.rating) + '</span></div>' +
        (r.photo ? '<img class="admin-review-photo" src="' + r.photo + '" alt="Review photo" />' : '') +
        '<div class="admin-review-comment">' + escapeHtml(r.comment) + '</div>' +
        '<div class="admin-review-meta">' + formatDate(r.createdAt) + '</div>' +
        '<div class="admin-review-actions">' +
        '<button class="admin-review-approve" data-id="' + r._id + '">✅ Approve</button>' +
        '<button class="admin-review-reject" data-id="' + r._id + '">✕ Reject</button>' +
        '</div></div>';
    }).join("");
    el.querySelectorAll(".admin-review-approve").forEach(function(btn) {
      btn.addEventListener("click", async function() {
        await fetch(API + "/reviews/" + btn.dataset.id + "/approve", { method: "PATCH", headers: { "Authorization": "Bearer " + token } });
        loadReviews();
      });
    });
    el.querySelectorAll(".admin-review-reject").forEach(function(btn) {
      btn.addEventListener("click", async function() {
        await fetch(API + "/reviews/" + btn.dataset.id + "/reject", { method: "PATCH", headers: { "Authorization": "Bearer " + token } });
        loadReviews();
      });
    });
  } catch(err) { document.getElementById("admin-reviews-list").innerHTML = '<p class="admin-empty">Could not load reviews.</p>'; }
}

// ============================================================
// PRODUCTS
// ============================================================
async function loadProducts() {
  try {
    var res = await fetch(API + "/products/all", { headers: { "Authorization": "Bearer " + token } });
    var products = await res.json();
    document.getElementById("products-count").textContent = products.length + " products";
    var el = document.getElementById("admin-products-list");
    if (!products.length) { el.innerHTML = '<p class="admin-empty">No products yet. Add one!</p>'; return; }
    el.innerHTML = products.map(function(p) {
      return '<div class="admin-product-card">' +
        (p.img ? '<img src="' + p.img + '" class="admin-product-img" alt="' + escapeHtml(p.name) + '" />' : '<div class="admin-product-img-placeholder">No image</div>') +
        '<div class="admin-product-info">' +
        '<div class="admin-product-name">' + escapeHtml(p.name) + (p.active === false ? ' <span style="color:#e74c3c;font-size:.65rem;">(hidden)</span>' : '') + '</div>' +
        '<div class="admin-product-price">₦' + p.numericPrice.toLocaleString() + '</div>' +
        '<div class="admin-product-meta">' + escapeHtml(p.category) + (p.badge ? " · " + escapeHtml(p.badge) : "") + '</div>' +
        '</div>' +
        '<div class="admin-product-actions">' +
        '<button class="admin-product-edit-btn" data-id="' + p.id + '">✏️ Edit</button>' +
        '<button class="admin-product-delete-btn" data-id="' + p.id + '">🗑️ Delete</button>' +
        '</div></div>';
    }).join("");

    document.querySelectorAll(".admin-product-edit-btn").forEach(function(btn) {
      btn.addEventListener("click", function() {
        var p = products.find(function(prod) { return prod.id === btn.dataset.id; });
        if (!p) return;
        document.getElementById("product-modal-title").textContent = "Edit Product";
        document.getElementById("pf-original-id").value = p.id;
        document.getElementById("pf-id").value = p.id;
        document.getElementById("pf-name").value = p.name;
        document.getElementById("pf-category").value = p.category;
        document.getElementById("pf-numericPrice").value = p.numericPrice;
        document.getElementById("pf-oldPrice").value = p.oldPrice ? String(p.oldPrice).replace(/[^0-9]/g, "") : "";
        document.getElementById("pf-badge").value = p.badge || "";
        document.getElementById("pf-stock").value = p.stock || 0;
        document.getElementById("pf-desc").value = p.desc || "";
        document.getElementById("pf-featured").checked = !!p.featured;
        document.getElementById("pf-active").checked = p.active !== false;
        document.getElementById("pf-img").value = p.img || "";
        var preview = document.getElementById("pf-img-preview");
        if (p.img) { preview.src = p.img; preview.style.display = "block"; }
        else { preview.style.display = "none"; }
        document.getElementById("pf-specs").value = (p.specs || []).map(function(s) { return s.label + ": " + s.value; }).join("\n");
        document.getElementById("product-modal-overlay").style.display = "flex";
      });
    });

    document.querySelectorAll(".admin-product-delete-btn").forEach(function(btn) {
      btn.addEventListener("click", async function() {
        if (!confirm("Delete this product permanently? This cannot be undone.")) return;
        try {
          await fetch(API + "/products/" + btn.dataset.id, {
            method: "DELETE",
            headers: { "Authorization": "Bearer " + token }
          });
          loadProducts();
        } catch(err) { console.log("Could not delete product:", err); }
      });
    });
  } catch(err) { document.getElementById("admin-products-list").innerHTML = '<p class="admin-empty">Could not load products.</p>'; }
}

document.getElementById("add-product-btn").addEventListener("click", function() {
  document.getElementById("product-modal-title").textContent = "Add Product";
  document.getElementById("product-form").reset();
  document.getElementById("pf-img").value = "";
  document.getElementById("pf-img-preview").style.display = "none";
  document.getElementById("pf-original-id").value = "";
  document.getElementById("product-modal-overlay").style.display = "flex";
});

document.getElementById("product-modal-close").addEventListener("click", function() {
  document.getElementById("product-modal-overlay").style.display = "none";
});

document.getElementById("product-form-cancel").addEventListener("click", function() {
  document.getElementById("product-modal-overlay").style.display = "none";
});

document.getElementById("pf-img-file").addEventListener("change", function() {
  var file = this.files[0];
  if (!file) return;
  resizePhotoFile(file, function(dataUrl) {
    document.getElementById("pf-img").value = dataUrl;
    var preview = document.getElementById("pf-img-preview");
    preview.src = dataUrl;
    preview.style.display = "block";
    document.getElementById("pf-img-status").textContent = "✅ Image ready";
  });
});

document.getElementById("product-form").addEventListener("submit", async function(e) {
  e.preventDefault();
  var specsRaw = document.getElementById("pf-specs").value.trim();
  var specs = [];
  if (specsRaw) {
    specsRaw.split("\n").forEach(function(line) {
      var parts = line.split(":");
      if (parts.length >= 2) {
        specs.push({ label: parts[0].trim(), value: parts.slice(1).join(":").trim() });
      }
    });
  }
  var payload = {
    id: document.getElementById("pf-id").value.trim(),
    name: document.getElementById("pf-name").value.trim(),
    category: document.getElementById("pf-category").value.trim(),
    numericPrice: parseInt(document.getElementById("pf-numericPrice").value),
    oldPrice: document.getElementById("pf-oldPrice").value ? parseInt(document.getElementById("pf-oldPrice").value) : null,
    badge: document.getElementById("pf-badge").value.trim(),
    stock: parseInt(document.getElementById("pf-stock").value),
    desc: document.getElementById("pf-desc").value.trim(),
    specs: specs,
    img: document.getElementById("pf-img").value,
    featured: document.getElementById("pf-featured").checked,
    active: document.getElementById("pf-active").checked
  };
  var originalId = document.getElementById("pf-original-id").value;
  var url = originalId ? API + "/products/" + originalId : API + "/products";
  var method = originalId ? "PUT" : "POST";
  try {
    var res = await fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      document.getElementById("product-modal-overlay").style.display = "none";
      loadProducts();
    }
  } catch(err) { console.log("Could not save product:", err); }
});

// ============================================================
// INIT
// ============================================================
loadOrders();
loadConversations();
loadReviews();