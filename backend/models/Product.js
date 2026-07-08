var mongoose = require("mongoose");

// A product spec row, e.g. { label: "Hair Type", value: "100% Human Hair" }
var specSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    value: { type: String, required: true },
  },
  { _id: false },
);

var productSchema = new mongoose.Schema({
  // "id" is the slug used everywhere in the frontend (data-product-id,
  // product.html?id=..., cart items). Keeping it separate from Mongo's
  // own _id means we don't have to touch any frontend URLs or cart code.
  id: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  price: { type: String, required: true },
  numericPrice: { type: Number, required: true },
  oldPrice: { type: String },
  badge: { type: String, default: "" },
  img: { type: String, required: true },
  desc: { type: String, default: "" },
  specs: [specSchema],
  stock: { type: Number, default: 0 },
  featured: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Product", productSchema);
