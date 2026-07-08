var mongoose = require("mongoose");

// A review is always tied to a real order, so customers can only
// review products they actually bought. "photo" stores a base64
// data URL — there's no file storage set up yet, and this keeps
// things simple for a store this size. Reviews start unapproved
// so the admin can moderate them before they go public.
var reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userName: { type: String, required: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  productName: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true },
  photo: { type: String },
  approved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Review", reviewSchema);
