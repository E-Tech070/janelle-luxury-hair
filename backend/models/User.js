var mongoose = require("mongoose");

var userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  phone: { type: String, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["customer", "admin"], default: "customer" },
  createdAt: { type: Date, default: Date.now },
  // Password reset — we only ever store a HASH of the reset token, never
  // the raw token itself. That way, even if the database were somehow
  // exposed, nobody could use the stored value to reset an account —
  // only the raw token emailed to the user (which we never save) works.
  resetTokenHash: { type: String },
  resetTokenExpires: { type: Date },
});

module.exports = mongoose.model("User", userSchema);
