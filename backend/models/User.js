var mongoose = require("mongoose");
var userSchema = new mongoose.Schema({ name: { type: String, required: true, trim: true }, email: { type: String, required: true, unique: true, lowercase: true, trim: true }, phone: { type: String, trim: true }, password: { type: String, required: true }, role: { type: String, enum: ["customer", "admin"], default: "customer" }, createdAt: { type: Date, default: Date.now } });
module.exports = mongoose.model("User", userSchema);
