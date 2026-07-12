var mongoose = require("mongoose");
var orderItemSchema = new mongoose.Schema({
  productId: { type: String },
  name: { type: String, required: true },
  price: { type: String, required: true },
  numericPrice: { type: Number, required: true },
  qty: { type: Number, required: true },
  img: { type: String },
});
var shippingAddressSchema = new mongoose.Schema(
  {
    address: { type: String },
    city: { type: String },
    state: { type: String },
  },
  { _id: false },
);
var orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userName: { type: String, required: true },
  userEmail: { type: String, required: true },
  userPhone: { type: String },
  items: [orderItemSchema],
  total: { type: Number, required: true },
  status: {
    type: String,
    enum: [
      "pending",
      "awaiting_payment",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ],
    default: "awaiting_payment",
  },
  deliveryMethod: {
    type: String,
    enum: ["delivery", "pickup"],
    default: "delivery",
  },
  shippingAddress: shippingAddressSchema,
  note: { type: String },
  paymentProof: { type: String },
  paymentStatus: {
    type: String,
    enum: ["unpaid", "proof_submitted", "confirmed"],
    default: "unpaid",
  },
  createdAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model("Order", orderSchema);
