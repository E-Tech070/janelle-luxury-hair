var express = require("express");
var router = express.Router();
var bcrypt = require("bcryptjs");
var jwt = require("jsonwebtoken");
var crypto = require("crypto");
var User = require("../models/User");
var sendPasswordResetEmail = require("../utils/email").sendPasswordResetEmail;

function generateToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

// REGISTER
router.post("/register", async function (req, res) {
  try {
    var { name, email, phone, password } = req.body;
    if (!name || !email || !password)
      return res
        .status(400)
        .json({ message: "Name, email and password are required" });
    var existing = await User.findOne({ email: email });
    if (existing)
      return res.status(400).json({ message: "Email already registered" });
    var hashed = await bcrypt.hash(password, 10);
    var user = new User({ name, email, phone, password: hashed });
    await user.save();
    var token = generateToken(user);
    res
      .status(201)
      .json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
      });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// LOGIN
router.post("/login", async function (req, res) {
  try {
    var { email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    var user = await User.findOne({ email: email });
    if (!user)
      return res.status(400).json({ message: "Invalid email or password" });
    var match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(400).json({ message: "Invalid email or password" });
    var token = generateToken(user);
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET CURRENT USER
router.get("/me", async function (req, res) {
  try {
    var token =
      req.headers.authorization && req.headers.authorization.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token" });
    var decoded = jwt.verify(token, process.env.JWT_SECRET);
    var user = await User.findById(decoded.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
});

// FORGOT PASSWORD — always responds with the same generic message,
// whether or not that email is actually registered. If we said
// "email not found" instead, anyone could use this form to check
// which emails have an account here — that's a real privacy leak
// for a store with real customers, so we deliberately don't reveal it.
router.post("/forgot-password", async function (req, res) {
  try {
    var email = req.body.email;
    if (!email) return res.status(400).json({ message: "Email is required" });

    var genericMessage =
      "If that email is registered, a password reset link has been sent.";
    var user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.json({ message: genericMessage });

    var rawToken = crypto.randomBytes(32).toString("hex");
    // Store only a hash of the token — see the comment on the User
    // model for why. The raw token only ever lives in the email link.
    user.resetTokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    var resetLink =
      req.protocol +
      "://" +
      req.get("host") +
      "/reset-password.html?token=" +
      rawToken;
    var sent = await sendPasswordResetEmail(user, resetLink);
    if (!sent) {
      // The token is already saved either way, but let the customer
      // know so they're not left waiting on an email that never comes.
      return res.json({
        message:
          "We couldn't send the reset email right now. Please try again shortly or contact us on WhatsApp.",
      });
    }

    res.json({ message: genericMessage });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// RESET PASSWORD
router.post("/reset-password", async function (req, res) {
  try {
    var token = req.body.token;
    var password = req.body.password;
    if (!token || !password)
      return res
        .status(400)
        .json({ message: "Token and new password are required" });
    if (password.length < 6)
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });

    var tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    var user = await User.findOne({
      resetTokenHash: tokenHash,
      resetTokenExpires: { $gt: new Date() },
    });
    if (!user)
      return res
        .status(400)
        .json({
          message:
            "This reset link is invalid or has expired. Please request a new one.",
        });

    user.password = await bcrypt.hash(password, 10);
    user.resetTokenHash = undefined;
    user.resetTokenExpires = undefined;
    await user.save();

    res.json({ message: "Password reset successfully. You can now sign in." });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
