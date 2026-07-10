var express = require("express");
var router = express.Router();
var jwt = require("jsonwebtoken");
var ChatMessage = require("../models/ChatMessage");
var User = require("../models/User");

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

function validateMessageBody(req, res, next) {
  var text = req.body.text;
  var photo = req.body.photo;
  if ((!text || !text.trim()) && !photo) {
    return res.status(400).json({ message: "Message can't be empty" });
  }
  if (text && text.length > 2000) {
    return res
      .status(400)
      .json({ message: "Message is too long (max 2000 characters)" });
  }
  if (photo && photo.indexOf("data:image/") !== 0) {
    return res.status(400).json({ message: "Invalid photo format" });
  }
  next();
}

// ============================================================
// CUSTOMER SIDE
// ============================================================

// Send a message (customer -> admin)
router.post(
  "/send",
  authMiddleware,
  validateMessageBody,
  async function (req, res) {
    try {
      var msg = new ChatMessage({
        customer: req.user.id,
        sender: "customer",
        text: req.body.text,
        photo: req.body.photo,
        readByCustomer: true,
        readByAdmin: false,
      });
      await msg.save();
      res.status(201).json(msg);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  },
);

// Get my whole conversation with the admin, oldest first.
// Also marks any admin replies as read now that the customer is
// viewing them.
router.get("/my", authMiddleware, async function (req, res) {
  try {
    await ChatMessage.updateMany(
      { customer: req.user.id, sender: "admin", readByCustomer: false },
      { readByCustomer: true },
    );
    var messages = await ChatMessage.find({ customer: req.user.id })
      .sort({ createdAt: 1 })
      .lean();
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Quick unread count, for a small badge on the account nav —
// lighter than fetching the whole thread just to count.
router.get("/my/unread-count", authMiddleware, async function (req, res) {
  try {
    var count = await ChatMessage.countDocuments({
      customer: req.user.id,
      sender: "admin",
      readByCustomer: false,
    });
    res.json({ count: count });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ============================================================
// ADMIN SIDE
// ============================================================

// One row per customer who has ever messaged: their info, the
// most recent message, and how many of their messages are unread.
router.get(
  "/conversations",
  authMiddleware,
  adminOnly,
  async function (req, res) {
    try {
      var conversations = await ChatMessage.aggregate([
        // Drop the (often large) base64 photo before sorting/grouping —
        // the conversation list only ever shows text + a "📷 Photo" tag,
        // it never renders the actual image, so hauling it through this
        // whole pipeline for every message was just wasted time/bandwidth.
        {
          $project: {
            customer: 1,
            sender: 1,
            text: 1,
            createdAt: 1,
            readByAdmin: 1,
            readByCustomer: 1,
            hasPhoto: { $cond: [{ $ifNull: ["$photo", false] }, true, false] },
          },
        },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: "$customer",
            lastMessage: { $first: "$$ROOT" },
            unreadCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$sender", "customer"] },
                      { $eq: ["$readByAdmin", false] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        { $sort: { "lastMessage.createdAt": -1 } },
      ]).allowDiskUse(true);

      var customerIds = conversations.map(function (c) {
        return c._id;
      });
      var users = await User.find({ _id: { $in: customerIds } }, "name email");
      var userMap = {};
      users.forEach(function (u) {
        userMap[u._id.toString()] = u;
      });

      var result = conversations.map(function (c) {
        var user = userMap[c._id.toString()];
        return {
          customerId: c._id,
          customerName: user ? user.name : "Unknown customer",
          customerEmail: user ? user.email : "",
          lastMessage: c.lastMessage,
          unreadCount: c.unreadCount,
        };
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  },
);

// Total unread across every conversation, for the admin nav badge
router.get(
  "/unread-count",
  authMiddleware,
  adminOnly,
  async function (req, res) {
    try {
      var count = await ChatMessage.countDocuments({
        sender: "customer",
        readByAdmin: false,
      });
      res.json({ count: count });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  },
);

// Full thread with one specific customer. Marks their messages
// as read by admin now that the admin is viewing this thread.
router.get(
  "/:customerId",
  authMiddleware,
  adminOnly,
  async function (req, res) {
    try {
      await ChatMessage.updateMany(
        {
          customer: req.params.customerId,
          sender: "customer",
          readByAdmin: false,
        },
        { readByAdmin: true },
      );
      var messages = await ChatMessage.find({ customer: req.params.customerId })
        .sort({ createdAt: 1 })
        .lean();
      res.json(messages);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  },
);

// Admin replies into a specific customer's thread
router.post(
  "/:customerId/send",
  authMiddleware,
  adminOnly,
  validateMessageBody,
  async function (req, res) {
    try {
      var customer = await User.findById(req.params.customerId);
      if (!customer)
        return res.status(404).json({ message: "Customer not found" });

      var msg = new ChatMessage({
        customer: req.params.customerId,
        sender: "admin",
        text: req.body.text,
        photo: req.body.photo,
        readByAdmin: true,
        readByCustomer: false,
      });
      await msg.save();
      res.status(201).json(msg);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  },
);

module.exports = router;
