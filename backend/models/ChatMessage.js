var mongoose = require("mongoose");

// One conversation per customer. Every message — whether the
// customer sent it or the admin replied — points at the same
// "customer" field, so a thread is just "all messages where
// customer = this person", sorted by time. Much simpler than a
// separate Conversation model with a list of participants.
var chatMessageSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  sender: { type: String, enum: ["customer", "admin"], required: true },
  text: { type: String },
  photo: { type: String },
  readByCustomer: { type: Boolean, default: false },
  readByAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
