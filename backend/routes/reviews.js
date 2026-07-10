var express = require("express");
var router = express.Router();
var jwt = require("jsonwebtoken");
var Review = require("../models/Review");
var Order = require("../models/Order");

function authMiddleware(req, res, next) {
  var token = req.headers.authorization && req.headers.authorization.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch(err) {
    res.status(401).json({ message: "Invalid token" });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admin only" });
  next();
}

// SUBMIT A REVIEW — only allowed for a product from one of the
// customer's own DELIVERED orders. This is what makes it a real
// "verified purchase" review instead of an open text box anyone
// can fill in.
router.post("/", authMiddleware, async function(req, res) {
  try {
    var { orderId, productName, rating, comment, photo } = req.body;

    if (!orderId || !productName || !rating || !comment) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }
    if (comment.length > 1000) {
      return res.status(400).json({ message: "Comment is too long (max 1000 characters)" });
    }
    if (photo && photo.indexOf("data:image/") !== 0) {
      return res.status(400).json({ message: "Invalid photo format" });
    }

    var order = await Order.findOne({ _id: orderId, user: req.user.id });
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.status !== "delivered") {
      return res.status(400).json({ message: "You can only review items from a delivered order" });
    }

    var itemInOrder = order.items.some(function(item) { return item.name === productName; });
    if (!itemInOrder) {
      return res.status(400).json({ message: "That product isn't in this order" });
    }

    var alreadyReviewed = await Review.findOne({ order: orderId, productName: productName, user: req.user.id });
    if (alreadyReviewed) {
      return res.status(400).json({ message: "You've already reviewed this item" });
    }

    var review = new Review({
      user: req.user.id,
      userName: order.userName,
      order: orderId,
      productName: productName,
      rating: rating,
      comment: comment,
      photo: photo || undefined
    });
    await review.save();
    res.status(201).json({ message: "Thanks! Your review will appear once it's been checked.", review: review });
  } catch(err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// MY REVIEWS (customer) — so account.js knows which delivered
// items have already been reviewed, and can hide that button.
router.get("/my", authMiddleware, async function(req, res) {
  try {
    var reviews = await Review.find({ user: req.user.id }).lean();
    res.json(reviews);
  } catch(err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// PUBLIC — approved reviews for one product (shown in a modal
// when a shopper clicks the rating on a product card)
router.get("/product/:name", async function(req, res) {
  try {
    var reviews = await Review.find({ productName: req.params.name, approved: true }).sort({ createdAt: -1 }).lean();
    res.json(reviews);
  } catch(err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// PUBLIC — average rating + count for every product that has at
// least one approved review, so the shop grid can show star
// badges without one request per product.
router.get("/summary", async function(req, res) {
  try {
    var summary = await Review.aggregate([
      { $match: { approved: true } },
      { $group: { _id: "$productName", avgRating: { $avg: "$rating" }, count: { $sum: 1 } } }
    ]);
    var result = {};
    summary.forEach(function(row) {
      result[row._id] = { avg: Math.round(row.avgRating * 10) / 10, count: row.count };
    });
    res.json(result);
  } catch(err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ADMIN — see all reviews, optionally filtered by status
router.get("/all", authMiddleware, adminOnly, async function(req, res) {
  try {
    var filter = {};
    if (req.query.status === "pending") filter.approved = false;
    if (req.query.status === "approved") filter.approved = true;
    var reviews = await Review.find(filter).sort({ createdAt: -1 }).lean();
    res.json(reviews);
  } catch(err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ADMIN — approve a review so it becomes public
router.patch("/:id/approve", authMiddleware, adminOnly, async function(req, res) {
  try {
    var review = await Review.findByIdAndUpdate(req.params.id, { approved: true }, { returnDocument: "after" });
    if (!review) return res.status(404).json({ message: "Review not found" });
    res.json(review);
  } catch(err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ADMIN — reject/delete a review
router.delete("/:id", authMiddleware, adminOnly, async function(req, res) {
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.json({ message: "Review deleted" });
  } catch(err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;