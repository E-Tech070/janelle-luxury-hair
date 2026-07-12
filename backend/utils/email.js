var Resend = require("resend").Resend;

// You'll need a free Resend account (resend.com) and an API key in
// .env as RESEND_API_KEY. Until you verify your own domain with
// Resend, emails send from "onboarding@resend.dev" — that's fine
// for testing, but switch FROM_EMAIL below to something on your
// own domain once it's verified, so emails look properly branded
// and land in inboxes (not spam) more reliably.
var FROM_EMAIL =
  process.env.FROM_EMAIL || "Janelle Luxury Hairs <onboarding@resend.dev>";

function getResendClient() {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

function formatMoney(n) {
  return "₦" + Number(n).toLocaleString();
}

function buildOrderEmailHtml(order) {
  var itemsHtml = "";
  order.items.forEach(function (item) {
    itemsHtml +=
      "<tr>" +
      '<td style="padding:8px 0;color:#e8e8e8;">' +
      item.name +
      " x" +
      item.qty +
      "</td>" +
      '<td style="padding:8px 0;text-align:right;color:#c9a84c;">' +
      item.price +
      "</td>" +
      "</tr>";
  });

  var deliveryLine =
    order.deliveryMethod === "pickup"
      ? "🛍️ Self-Pickup (Lagos) — we'll send the pickup address to your phone once confirmed."
      : "🚚 Delivery to: " +
        (order.shippingAddress
          ? order.shippingAddress.address +
            ", " +
            order.shippingAddress.city +
            ", " +
            order.shippingAddress.state
          : "");

  return (
    '<div style="background:#0d0d0d;padding:2rem;font-family:sans-serif;">' +
    '<div style="max-width:480px;margin:0 auto;background:#161616;border:1px solid #2a2a2a;border-radius:12px;padding:2rem;color:#e8e8e8;">' +
    '<h2 style="color:#c9a84c;margin-top:0;">Thank you for your order!</h2>' +
    "<p>Hi " +
    order.userName +
    ", we've received your order and it's being processed.</p>" +
    '<p style="color:#888;font-size:14px;">Order #' +
    String(order._id).slice(-6).toUpperCase() +
    "</p>" +
    '<table style="width:100%;border-collapse:collapse;margin:1.5rem 0;">' +
    itemsHtml +
    "</table>" +
    '<div style="border-top:1px solid #2a2a2a;padding-top:1rem;font-weight:bold;color:#c9a84c;">Total: ' +
    formatMoney(order.total) +
    "</div>" +
    '<p style="margin-top:1.5rem;font-size:14px;color:#ccc;">' +
    deliveryLine +
    "</p>" +
    '<p style="margin-top:1.5rem;font-size:13px;color:#666;">You can track your order status any time from your account page.</p>' +
    "</div>" +
    "</div>"
  );
}

// Sends the order confirmation email. Never throws — if email
// sending fails for any reason (bad API key, Resend is down,
// no internet), it just logs the error. An order should never
// fail to save just because the confirmation email couldn't send.
async function sendOrderConfirmationEmail(order) {
  var resend = getResendClient();
  if (!resend) {
    console.log(
      "⚠️  RESEND_API_KEY not set — skipping order confirmation email.",
    );
    return;
  }
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: order.userEmail,
      subject: "Your Janelle Luxury Hairs order is confirmed 💛",
      html: buildOrderEmailHtml(order),
    });
    console.log("✅ Order confirmation email sent to " + order.userEmail);
  } catch (err) {
    console.log("❌ Could not send order confirmation email:", err.message);
  }
}

// Sends the password reset email. Same "never throws" rule as the
// order email — but here a silent failure actually matters to the
// customer (they're stuck if it doesn't arrive), so the route calling
// this checks the return value and tells the user if sending failed.
async function sendPasswordResetEmail(user, resetLink) {
  var resend = getResendClient();
  if (!resend) {
    console.log("⚠️  RESEND_API_KEY not set — skipping password reset email.");
    return false;
  }
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: user.email,
      subject: "Reset your Janelle Luxury Hairs password",
      html: buildPasswordResetEmailHtml(user, resetLink),
    });
    console.log("✅ Password reset email sent to " + user.email);
    return true;
  } catch (err) {
    console.log("❌ Could not send password reset email:", err.message);
    return false;
  }
}

function buildPasswordResetEmailHtml(user, resetLink) {
  return (
    '<div style="background:#0d0d0d;padding:2rem;font-family:sans-serif;">' +
    '<div style="max-width:480px;margin:0 auto;background:#161616;border:1px solid #2a2a2a;border-radius:12px;padding:2rem;color:#e8e8e8;">' +
    '<h2 style="color:#c9a84c;margin-top:0;">Reset your password</h2>' +
    "<p>Hi " +
    user.name +
    ", we received a request to reset your password.</p>" +
    '<p style="margin:1.5rem 0;">' +
    '<a href="' +
    resetLink +
    '" style="background:#c9a84c;color:#080808;padding:0.9rem 1.5rem;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">Reset Password</a>' +
    "</p>" +
    "<p style=\"font-size:13px;color:#888;\">This link expires in 1 hour. If you didn't request this, you can safely ignore this email — your password won't be changed.</p>" +
    "</div>" +
    "</div>"
  );
}

module.exports = {
  sendOrderConfirmationEmail: sendOrderConfirmationEmail,
  sendPasswordResetEmail: sendPasswordResetEmail,
};
