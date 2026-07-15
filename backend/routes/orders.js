var express = require("express");
var router = express.Router();
var jwt = require("jsonwebtoken");
var Order = require("../models/Order");
var Product = require("../models/Product");
var emailUtils = require("../utils/email");
var sendOrderConfirmationEmail = emailUtils.sendOrderConfirmationEmail;
var sendNewOrderAlertEmail = emailUtils.sendNewOrderAlertEmail;
var sendLowStockAlertEmail = emailUtils.sendLowStockAlertEmail;
var sendServerError = require("../utils/errorResponse");

// Matches the "Only X left" threshold already shown to shoppers on
// the shop grid and product page, so the admin gets alerted at the
// same point a customer would start seeing the low-stock warning.
var LOW_STOCK_THRESHOLD = 5;

function authMiddleware(req, res, next) {
  var token =
    req.headers.authorization && req.headers.authorization.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin")
    return res.status(403).json({ message: "Admin only" });
  next();
}

// ============================================================
// STOCK RESERVATION — runs right before an order is saved.
// Each reservation is a single atomic update ({ id, stock: {$gte: qty} }
// + $inc), so two customers buying the last item at the same moment
// can't both succeed — MongoDB only lets one of those updates match.
// If any item in the cart fails (not enough left), we put back
// whatever we already reserved for the earlier items and reject the
// whole order, so a customer's order is never left half-fulfilled.
//
// Cart items with no productId (e.g. an old cart saved in someone's
// browser before this feature existed) are skipped rather than
// rejected — same as before this feature, just no stock is tracked
// for that particular line item.
// ============================================================
async function reserveStock(items) {
  var reserved = [];
  var lowStockProducts = [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var productId = item.productId || item.id;
    if (!productId) continue;

    // findOneAndUpdate returns the document as it was BEFORE this
    // update by default, so "updated.stock" here is the pre-order
    // count — subtracting qty gives us the real count after.
    var updated = await Product.findOneAndUpdate(
      { id: productId, stock: { $gte: item.qty } },
      { $inc: { stock: -item.qty } }
    );

    if (!updated) {
      await releaseStock(reserved);
      return { ok: false, message: "Sorry, \"" + item.name + "\" doesn't have enough stock left. Please update your cart and try again." };
    }
    reserved.push({ productId: productId, qty: item.qty });

    // Alert on two distinct moments: first time it crosses INTO low
    // stock, and separately, first time it hits exactly zero — those
    // are both worth knowing about even if the item was already low
    // from an earlier order (selling out completely is more urgent
    // than "still has a couple left").
    var stockAfter = updated.stock - item.qty;
    var crossesLow = updated.stock > LOW_STOCK_THRESHOLD && stockAfter <= LOW_STOCK_THRESHOLD;
    var crossesZero = updated.stock > 0 && stockAfter === 0;
    if (crossesLow || crossesZero) {
      lowStockProducts.push({ name: updated.name, stock: stockAfter });
    }
  }
  return { ok: true, lowStockProducts: lowStockProducts };
}

async function releaseStock(reserved) {
  for (var i = 0; i < reserved.length; i++) {
    await Product.updateOne({ id: reserved[i].productId }, { $inc: { stock: reserved[i].qty } });
  }
}

// Every item must be a real, sane line item before we trust it for
// stock reservation or pricing. This also is what makes it safe to
// recompute the order total ourselves below, instead of trusting
// whatever total the client sent — a client could otherwise submit
// real products with a manipulated (near-zero) total and pay
// whatever price they chose.
function validateOrderItems(items) {
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (!item || typeof item.name !== "string" || !item.name.trim()) {
      return "Every item needs a valid name.";
    }
    if (typeof item.numericPrice !== "number" || item.numericPrice <= 0) {
      return "\"" + item.name + "\" has an invalid price.";
    }
    if (!Number.isInteger(item.qty) || item.qty <= 0 || item.qty > 50) {
      return "\"" + item.name + "\" has an invalid quantity.";
    }
  }
  return null;
}

router.post("/", authMiddleware, async function (req, res) {
  try {
    var {
      items,
      note,
      userName,
      userEmail,
      userPhone,
      shippingAddress,
      deliveryMethod,
      paymentProof,
    } = req.body;
    if (!items || !items.length)
      return res.status(400).json({ message: "No items in order" });
    if (!userName || !userEmail)
      return res.status(400).json({ message: "Missing customer details" });

    var itemError = validateOrderItems(items);
    if (itemError) return res.status(400).json({ message: itemError });

    var method = deliveryMethod === "pickup" ? "pickup" : "delivery";
    if (
      method === "delivery" &&
      (!shippingAddress || !shippingAddress.address)
    ) {
      return res.status(400).json({ message: "Delivery address is required" });
    }

    var stockResult = await reserveStock(items);
    if (!stockResult.ok) {
      return res.status(400).json({ message: stockResult.message });
    }

    // Cart items arrive with an "id" field (matching how the rest of
    // the storefront refers to products); the Order schema calls the
    // same thing "productId" for clarity on the admin/order side.
    // Rebuilding the array here also means we only ever save the
    // fields we actually expect, not whatever else a client sends.
    var orderItems = items.map(function(it) {
      return {
        productId: it.productId || it.id || undefined,
        name: it.name,
        price: it.price,
        numericPrice: it.numericPrice,
        qty: it.qty,
        img: it.img
      };
    });

    // Server computes the real total from validated items — the
    // client's number is never trusted for what actually gets charged.
    var total = orderItems.reduce(function(sum, it) { return sum + (it.numericPrice * it.qty); }, 0);

    var order;
    try {
      order = new Order({
        user: req.user.id,
        userName,
        userEmail,
        userPhone,
        items: orderItems,
        total,
        deliveryMethod: method,
        shippingAddress: shippingAddress || {},
        note,
        paymentProof: paymentProof || null,
        paymentStatus: paymentProof ? "proof_submitted" : "unpaid",
        status: paymentProof ? "pending" : "awaiting_payment",
      });
      await order.save();
    } catch (saveErr) {
      // The order itself failed to save after stock was already
      // reserved — give the stock back so it isn't lost.
      var toRelease = items.filter(function(it) { return it.productId || it.id; }).map(function(it) { return { productId: it.productId || it.id, qty: it.qty }; });
      await releaseStock(toRelease);
      throw saveErr;
    }

    // Both of these never throw on their own (same rule as the
    // customer confirmation email above) — a notification failing
    // to send can never cause the order itself to fail.
    await sendOrderConfirmationEmail(order);
    await sendNewOrderAlertEmail(order);
    for (var j = 0; j < stockResult.lowStockProducts.length; j++) {
      await sendLowStockAlertEmail(stockResult.lowStockProducts[j]);
    }

    res.status(201).json(order);
  } catch (err) {
    sendServerError(res, err);
  }
});

router.patch("/:id/proof", authMiddleware, async function (req, res) {
  try {
    var order = await Order.findOne({ _id: req.params.id, user: req.user.id });
    if (!order) return res.status(404).json({ message: "Order not found" });
    order.paymentProof = req.body.paymentProof;
    order.paymentStatus = "proof_submitted";
    if (order.status === "awaiting_payment") order.status = "pending";
    await order.save();
    res.json(order);
  } catch (err) {
    sendServerError(res, err);
  }
});

router.patch(
  "/:id/payment",
  authMiddleware,
  adminOnly,
  async function (req, res) {
    try {
      var order = await Order.findByIdAndUpdate(
        req.params.id,
        { paymentStatus: "confirmed", status: "confirmed" },
        { returnDocument: "after" },
      );
      if (!order) return res.status(404).json({ message: "Order not found" });
      res.json(order);
    } catch (err) {
      sendServerError(res, err);
    }
  },
);

router.get("/my", authMiddleware, async function (req, res) {
  try {
    var orders = await Order.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json(orders);
  } catch (err) {
    sendServerError(res, err);
  }
});

router.get("/all", authMiddleware, adminOnly, async function (req, res) {
  try {
    var page = Math.max(parseInt(req.query.page) || 1, 1);
    var limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);
    var skip = (page - 1) * limit;

    var totalOrders = await Order.countDocuments();
    var orders = await Order.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      orders: orders,
      currentPage: page,
      totalPages: Math.max(Math.ceil(totalOrders / limit), 1),
      totalOrders: totalOrders
    });
  } catch (err) {
    sendServerError(res, err);
  }
});

router.patch(
  "/:id/status",
  authMiddleware,
  adminOnly,
  async function (req, res) {
    try {
      var existing = await Order.findById(req.params.id);
      if (!existing) return res.status(404).json({ message: "Order not found" });

      // Cancelling an order means those items are back in stock —
      // but only restore once, so cancelling an already-cancelled
      // order twice doesn't accidentally add stock that was never
      // actually returned.
      if (req.body.status === "cancelled" && existing.status !== "cancelled") {
        var toRelease = existing.items.filter(function(it) { return it.productId; }).map(function(it) { return { productId: it.productId, qty: it.qty }; });
        await releaseStock(toRelease);
      }

      existing.status = req.body.status;
      await existing.save();
      res.json(existing);
    } catch (err) {
      sendServerError(res, err);
    }
  },
);

module.exports = router;