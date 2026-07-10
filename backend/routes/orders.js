var express = require("express");
var router = express.Router();
var jwt = require("jsonwebtoken");
var Order = require("../models/Order");

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

router.post("/", authMiddleware, async function (req, res) {
  try {
    var {
      items,
      total,
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
    var method = deliveryMethod === "pickup" ? "pickup" : "delivery";
    if (
      method === "delivery" &&
      (!shippingAddress || !shippingAddress.address)
    ) {
      return res.status(400).json({ message: "Delivery address is required" });
    }
    var order = new Order({
      user: req.user.id,
      userName,
      userEmail,
      userPhone,
      items,
      total,
      deliveryMethod: method,
      shippingAddress: shippingAddress || {},
      note,
      paymentProof: paymentProof || null,
      paymentStatus: paymentProof ? "proof_submitted" : "unpaid",
      status: paymentProof ? "pending" : "awaiting_payment",
    });
    await order.save();
    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
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
    res.status(500).json({ message: "Server error", error: err.message });
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
      res.status(500).json({ message: "Server error", error: err.message });
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
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.get("/all", authMiddleware, adminOnly, async function (req, res) {
  try {
    var orders = await Order.find().sort({ createdAt: -1 }).lean();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.patch(
  "/:id/status",
  authMiddleware,
  adminOnly,
  async function (req, res) {
    try {
      var order = await Order.findByIdAndUpdate(
        req.params.id,
        { status: req.body.status },
        { returnDocument: "after" },
      );
      if (!order) return res.status(404).json({ message: "Order not found" });
      res.json(order);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  },
);

module.exports = router;
