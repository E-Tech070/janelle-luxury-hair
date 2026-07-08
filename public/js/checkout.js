var API = "http://localhost:5000/api";
var proofBase64 = null;

function getCheckoutCart() {
  var raw = localStorage.getItem("janelle_cart");
  if (!raw) return [];
  try { var parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; }
  catch(err) { return []; }
}

function renderOrderSummary() {
  var cart = getCheckoutCart();
  var itemsEl = document.getElementById("checkout-items");
  var subtotalEl = document.getElementById("checkout-subtotal");
  var totalEl = document.getElementById("checkout-total");
  var payAmountEl = document.getElementById("pay-amount");
  if (cart.length === 0) {
    document.getElementById("checkout-empty").style.display = "block";
    document.getElementById("checkout-body").style.display = "none";
    return;
  }
  var html = "";
  var subtotal = 0;
  for (var i = 0; i < cart.length; i++) {
    var item = cart[i];
    var lineTotal = item.numericPrice * item.qty;
    subtotal += lineTotal;
    html += '<div class="checkout-item">' +
      '<img class="checkout-item-img" src="' + item.img + '" alt="' + item.name + '" />' +
      '<div class="checkout-item-body">' +
      '<div class="checkout-item-name">' + item.name + '</div>' +
      '<div class="checkout-item-meta">Qty ' + item.qty + ' x ' + item.price + '</div>' +
      '</div><div class="checkout-item-line-total">₦' + lineTotal.toLocaleString() + '</div></div>';
  }
  itemsEl.innerHTML = html;
  subtotalEl.textContent = "₦" + subtotal.toLocaleString();
  totalEl.textContent = "₦" + subtotal.toLocaleString();
  if (payAmountEl) payAmountEl.textContent = "₦" + subtotal.toLocaleString();
}

function showCheckoutError(msg) {
  var el = document.getElementById("checkout-error");
  el.textContent = msg;
  el.style.display = "block";
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}

function prefillCustomerDetails(user) {
  if (!user) return;
  document.getElementById("co-name").value = user.name || "";
  document.getElementById("co-email").value = user.email || "";
  document.getElementById("co-phone").value = user.phone || "";
}

function resizeImageToBase64(file, callback) {
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var canvas = document.createElement("canvas");
      var MAX = 1200;
      var w = img.width; var h = img.height;
      if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
      if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

document.addEventListener("DOMContentLoaded", function() {
  var token = localStorage.getItem("janelle_token");
  var user = JSON.parse(localStorage.getItem("janelle_user") || "null");
  if (!token || !user) {
    localStorage.setItem("janelle_redirect_after_login", "checkout.html");
    window.location.href = "login.html";
    return;
  }
  renderOrderSummary();
  prefillCustomerDetails(user);

  var copyBtn = document.getElementById("copy-acct-btn");
  if (copyBtn) {
    copyBtn.addEventListener("click", function() {
      navigator.clipboard.writeText("9060264597").then(function() {
        copyBtn.textContent = "✅ Copied!";
        setTimeout(function() { copyBtn.textContent = "📋 Copy"; }, 2000);
      });
    });
  }

  var deliveryFields = document.getElementById("delivery-address-fields");
  var pickupNote = document.getElementById("pickup-note");
  var methodRadios = document.querySelectorAll("input[name='delivery-method']");

  function updateDeliveryMethodUI() {
    var isPickup = document.getElementById("co-method-pickup").checked;
    deliveryFields.style.display = isPickup ? "none" : "block";
    pickupNote.style.display = isPickup ? "block" : "none";
    document.getElementById("co-address").required = !isPickup;
    document.getElementById("co-city").required = !isPickup;
    document.getElementById("co-state").required = !isPickup;
  }
  methodRadios.forEach(function(radio) { radio.addEventListener("change", updateDeliveryMethodUI); });
  updateDeliveryMethodUI();

  var proofInput = document.getElementById("proof-input");
  var proofUploadBtn = document.getElementById("proof-upload-btn");
  var proofPreviewWrap = document.getElementById("proof-preview-wrap");
  var proofPreview = document.getElementById("proof-preview");
  var proofRemoveBtn = document.getElementById("proof-remove-btn");
  var proofFilename = document.getElementById("proof-filename");

  proofUploadBtn.addEventListener("click", function() { proofInput.click(); });

  proofInput.addEventListener("change", function() {
    var file = proofInput.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showCheckoutError("Image too large. Use an image under 10MB."); return; }
    resizeImageToBase64(file, function(base64) {
      proofBase64 = base64;
      proofPreview.src = base64;
      proofPreviewWrap.style.display = "flex";
      proofFilename.textContent = "📎 " + file.name;
      proofUploadBtn.textContent = "✅ Receipt uploaded — change?";
    });
  });

  proofRemoveBtn.addEventListener("click", function() {
    proofBase64 = null;
    proofInput.value = "";
    proofPreviewWrap.style.display = "none";
    proofFilename.textContent = "";
    proofUploadBtn.innerHTML = '<i class="bi bi-upload"></i> Choose Receipt Image';
  });

  var submitBtn = document.getElementById("checkout-submit-btn");
  submitBtn.addEventListener("click", async function() {
    var form = document.getElementById("checkout-form");
    if (!form.checkValidity()) { form.reportValidity(); return; }
    var cart = getCheckoutCart();
    if (!cart.length) { showCheckoutError("Your cart is empty."); return; }
    if (!proofBase64) {
      showCheckoutError("Please upload your payment receipt before placing the order.");
      proofUploadBtn.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    var total = 0;
    for (var i = 0; i < cart.length; i++) total += cart[i].numericPrice * cart[i].qty;
    var isPickup = document.getElementById("co-method-pickup").checked;
    var payload = {
      items: cart, total: total,
      userName: document.getElementById("co-name").value.trim(),
      userEmail: document.getElementById("co-email").value.trim(),
      userPhone: document.getElementById("co-phone").value.trim(),
      deliveryMethod: isPickup ? "pickup" : "delivery",
      shippingAddress: isPickup ? {} : {
        address: document.getElementById("co-address").value.trim(),
        city: document.getElementById("co-city").value.trim(),
        state: document.getElementById("co-state").value.trim()
      },
      note: document.getElementById("co-notes").value.trim(),
      paymentProof: proofBase64
    };
    submitBtn.textContent = "Placing order...";
    submitBtn.disabled = true;
    try {
      var res = await fetch(API + "/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify(payload)
      });
      var data = await res.json();
      if (res.ok) {
        localStorage.setItem("janelle_cart", "[]");
        window.location.href = "account.html?order=success";
      } else {
        showCheckoutError(data.message || "Could not place your order. Please try again.");
        submitBtn.textContent = "✅ Place Order & Submit Proof";
        submitBtn.disabled = false;
      }
    } catch(err) {
      showCheckoutError("Connection error. Make sure the server is running.");
      submitBtn.textContent = "✅ Place Order & Submit Proof";
      submitBtn.disabled = false;
    }
  });
});
