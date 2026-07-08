var mongoose = require("mongoose");
var messageSchema = new mongoose.Schema({ user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, userName: { type: String, required: true }, userEmail: { type: String, required: true }, userPhone: { type: String }, subject: { type: String, required: true }, body: { type: String, required: true }, read: { type: Boolean, default: false }, replied: { type: Boolean, default: false }, createdAt: { type: Date, default: Date.now } });
module.exports = mongoose.model("Message", messageSchema);
