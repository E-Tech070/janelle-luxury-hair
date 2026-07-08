var express = require("express");
var router = express.Router();
var jwt = require("jsonwebtoken");
var Message = require("../models/Message");

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

// SEND MESSAGE
router.post("/", authMiddleware, async function(req, res) {
  try {
    var { subject, body, userName, userEmail, userPhone } = req.body;
    if (!subject || !body) return res.status(400).json({ message: "Subject and message are required" });
    if (subject.length > 150) return res.status(400).json({ message: "Subject is too long (max 150 characters)" });
    if (body.length > 2000) return res.status(400).json({ message: "Message is too long (max 2000 characters)" });
    var message = new Message({ user: req.user.id, userName, userEmail, userPhone, subject, body });
    await message.save();
    res.status(201).json(message);
  } catch(err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET MY MESSAGES (customer)
router.get("/my", authMiddleware, async function(req, res) {
  try {
    var messages = await Message.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(messages);
  } catch(err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET ALL MESSAGES (admin)
router.get("/all", authMiddleware, adminOnly, async function(req, res) {
  try {
    var messages = await Message.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch(err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// MARK AS READ (admin)
router.patch("/:id/read", authMiddleware, adminOnly, async function(req, res) {
  try {
    var message = await Message.findByIdAndUpdate(req.params.id, { read: true }, { returnDocument: "after" });
    if (!message) return res.status(404).json({ message: "Message not found" });
    res.json(message);
  } catch(err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
