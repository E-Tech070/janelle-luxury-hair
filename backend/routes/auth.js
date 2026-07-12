var express = require("express");
var router = express.Router();
var bcrypt = require("bcryptjs");
var jwt = require("jsonwebtoken");
var crypto = require("crypto");
var rateLimit = require("express-rate-limit");
var User = require("../models/User");
var sendPasswordResetEmail = require("../utils/email").sendPasswordResetEmail;
var sendServerError = require("../utils/errorResponse");

function generateToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

// ============================================================
// RATE LIMITING — protects against brute-force password guessing
// and account-creation spam. Counted per IP (server.js has
// "trust proxy" set so this sees the real visitor IP behind Render).
// ============================================================

// Login/register: a real customer mistyping their password a few
// times should never get blocked, but dozens of attempts in a few
// minutes is a brute-force attempt, not a typo.
var authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please wait a few minutes and try again." }
});

// Password reset requests are rare for a legitimate user — a tighter
// limit here mainly stops someone using the form to spam an inbox
// with reset emails, or hammering the reset-token endpoint.
var resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many password reset attempts. Please try again in an hour." }
});

var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// REGISTER
router.post("/register", authLimiter, async function(req, res) {
  try {
    var { name, email, phone, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "Name, email and password are required" });
    email = email.toLowerCase().trim();
    if (!EMAIL_RE.test(email)) return res.status(400).json({ message: "Please enter a valid email address" });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
    var existing = await User.findOne({ email: email });
    if (existing) return res.status(400).json({ message: "Email already registered" });
    var hashed = await bcrypt.hash(password, 10);
    var user = new User({ name: name.trim(), email, phone, password: hashed });
    await user.save();
    var token = generateToken(user);
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role } });
  } catch(err) {
    sendServerError(res, err);
  }
});

// LOGIN
router.post("/login", authLimiter, async function(req, res) {
  try {
    var { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });
    // Emails are stored lowercased (see User model), so without this
    // normalization here too, a customer who registered lowercase
    // but happens to type "Name@Example.com" at login would get
    // "invalid email or password" even with the right password.
    email = email.toLowerCase().trim();
    var user = await User.findOne({ email: email });
    if (!user) return res.status(400).json({ message: "Invalid email or password" });
    var match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid email or password" });
    var token = generateToken(user);
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role } });
  } catch(err) {
    sendServerError(res, err);
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

// FORGOT PASSWORD — always responds with the same generic message,
// whether or not that email is actually registered. If we said
// "email not found" instead, anyone could use this form to check
// which emails have an account here — that's a real privacy leak
// for a store with real customers, so we deliberately don't reveal it.
router.post("/forgot-password", resetLimiter, async function(req, res) {
  try {
    var email = req.body.email;
    if (!email) return res.status(400).json({ message: "Email is required" });

    var genericMessage = "If that email is registered, a password reset link has been sent.";
    var user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.json({ message: genericMessage });

    var rawToken = crypto.randomBytes(32).toString("hex");
    // Store only a hash of the token — see the comment on the User
    // model for why. The raw token only ever lives in the email link.
    user.resetTokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    var resetLink = req.protocol + "://" + req.get("host") + "/reset-password.html?token=" + rawToken;
    var sent = await sendPasswordResetEmail(user, resetLink);
    if (!sent) {
      // The token is already saved either way, but let the customer
      // know so they're not left waiting on an email that never comes.
      return res.json({ message: "We couldn't send the reset email right now. Please try again shortly or contact us on WhatsApp." });
    }

    res.json({ message: genericMessage });
  } catch(err) {
    sendServerError(res, err);
  }
});

// RESET PASSWORD
router.post("/reset-password", resetLimiter, async function(req, res) {
  try {
    var token = req.body.token;
    var password = req.body.password;
    if (!token || !password) return res.status(400).json({ message: "Token and new password are required" });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

    var tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    var user = await User.findOne({ resetTokenHash: tokenHash, resetTokenExpires: { $gt: new Date() } });
    if (!user) return res.status(400).json({ message: "This reset link is invalid or has expired. Please request a new one." });

    user.password = await bcrypt.hash(password, 10);
    user.resetTokenHash = undefined;
    user.resetTokenExpires = undefined;
    await user.save();

    res.json({ message: "Password reset successfully. You can now sign in." });
  } catch(err) {
    sendServerError(res, err);
  }
});

module.exports = router;