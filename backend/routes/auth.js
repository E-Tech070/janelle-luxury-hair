var express = require("express");
var router = express.Router();
var bcrypt = require("bcryptjs");
var jwt = require("jsonwebtoken");
var User = require("../models/User");

function generateToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

// REGISTER
router.post("/register", async function(req, res) {
  try {
    var { name, email, phone, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "Name, email and password are required" });
    var existing = await User.findOne({ email: email });
    if (existing) return res.status(400).json({ message: "Email already registered" });
    var hashed = await bcrypt.hash(password, 10);
    var user = new User({ name, email, phone, password: hashed });
    await user.save();
    var token = generateToken(user);
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role } });
  } catch(err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// LOGIN
router.post("/login", async function(req, res) {
  try {
    var { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });
    var user = await User.findOne({ email: email });
    if (!user) return res.status(400).json({ message: "Invalid email or password" });
    var match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid email or password" });
    var token = generateToken(user);
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role } });
  } catch(err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET CURRENT USER
router.get("/me", async function(req, res) {
  try {
    var token = req.headers.authorization && req.headers.authorization.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token" });
    var decoded = jwt.verify(token, process.env.JWT_SECRET);
    var user = await User.findById(decoded.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch(err) {
    res.status(401).json({ message: "Invalid token" });
  }
});

module.exports = router;
