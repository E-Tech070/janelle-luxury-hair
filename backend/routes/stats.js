var express = require("express");
var router = express.Router();
var jwt = require("jsonwebtoken");
var Order = require("../models/Order");
var sendServerError = require("../utils/errorResponse");

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

// Everything here is read-only aggregation over existing orders —
// no new data is stored, this just summarizes what's already there.
router.get("/dashboard", authMiddleware, adminOnly, async function (req, res) {
  try {
    var startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    var results = await Promise.all([
      // Real revenue = payments actually confirmed by the admin, not
      // just orders placed (an order sitting at "awaiting proof"
      // hasn't actually been paid for yet).
      Order.aggregate([
        { $match: { paymentStatus: "confirmed" } },
        {
          $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } },
        },
      ]),
      Order.aggregate([
        {
          $match: {
            paymentStatus: "confirmed",
            createdAt: { $gte: startOfMonth },
          },
        },
        {
          $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } },
        },
      ]),
      Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      // Best sellers by quantity, counting any order that wasn't
      // cancelled — a placed order reflects real demand even before
      // payment is confirmed.
      Order.aggregate([
        { $match: { status: { $ne: "cancelled" } } },
        { $unwind: "$items" },
        { $group: { _id: "$items.name", totalQty: { $sum: "$items.qty" } } },
        { $sort: { totalQty: -1 } },
        { $limit: 5 },
      ]),
      Order.distinct("user"),
    ]);

    var revenueAgg = results[0][0];
    var monthAgg = results[1][0];
    var statusCounts = results[2];
    var topProducts = results[3];
    var distinctCustomers = results[4];

    var totalRevenue = revenueAgg ? revenueAgg.total : 0;
    var totalConfirmedOrders = revenueAgg ? revenueAgg.count : 0;

    var statusBreakdown = {};
    statusCounts.forEach(function (s) {
      statusBreakdown[s._id] = s.count;
    });

    res.json({
      totalRevenue: totalRevenue,
      avgOrderValue: totalConfirmedOrders
        ? Math.round(totalRevenue / totalConfirmedOrders)
        : 0,
      monthRevenue: monthAgg ? monthAgg.total : 0,
      monthOrders: monthAgg ? monthAgg.count : 0,
      statusBreakdown: statusBreakdown,
      topProducts: topProducts.map(function (p) {
        return { name: p._id, qty: p.totalQty };
      }),
      totalCustomers: distinctCustomers.length,
    });
  } catch (err) {
    sendServerError(res, err);
  }
});

module.exports = router;
