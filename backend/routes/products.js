var express = require("express");
var router = express.Router();
var jwt = require("jsonwebtoken");
var Product = require("../models/Product");
var multer = require("multer");
var path = require("path");
var fs = require("fs");
var sendServerError = require("../utils/errorResponse");

// Where uploaded product photos get saved. They land in
// public/images/products/ so they're served automatically by
// express.static in server.js — no extra route needed to view them.
var uploadDir = path.join(__dirname, "../../public/images/products");
fs.mkdirSync(uploadDir, { recursive: true });

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    var unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

var upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    if (!file.mimetype.startsWith("image/"))
      return cb(new Error("Only image files are allowed"));
    cb(null, true);
  },
});

function authMiddleware(req, res, next) {
  var token =
    req.headers.authorization && req.headers.authorization.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin")
    return res.status(403).json({ message: "Admin only" });
  next();
}

// UPLOAD PRODUCT IMAGE (admin) — returns the path to save into pf-img
router.post(
  "/upload",
  authMiddleware,
  adminOnly,
  upload.single("image"),
  function (req, res) {
    if (!req.file)
      return res.status(400).json({ message: "No image uploaded" });
    res.json({ url: "images/products/" + req.file.filename });
  },
);

// GET ALL PRODUCTS (public — used by the storefront)
router.get("/", async function (req, res) {
  try {
    var products = await Product.find({ active: true })
      .sort({ createdAt: -1 })
      .lean();
    res.json(products);
  } catch (err) {
    sendServerError(res, err);
  }
});

// GET ALL PRODUCTS (admin — includes inactive/out of stock ones too)
router.get("/all", authMiddleware, adminOnly, async function (req, res) {
  try {
    var products = await Product.find().sort({ createdAt: -1 }).lean();
    res.json(products);
  } catch (err) {
    sendServerError(res, err);
  }
});

// GET ONE PRODUCT BY SLUG (public — used by product.html)
router.get("/:id", async function (req, res) {
  try {
    var product = await Product.findOne({ id: req.params.id });
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    sendServerError(res, err);
  }
});

// Serves the product photo as a real image, decoded from the base64
// stored on the product. This exists specifically so link previews
// (WhatsApp, Facebook, etc.) have an actual image URL to fetch —
// those platforms can't render a base64 string as a preview photo.
router.get("/:id/image", async function (req, res) {
  try {
    var product = await Product.findOne({ id: req.params.id })
      .select("img")
      .lean();
    if (!product || !product.img || product.img.indexOf("data:") !== 0) {
      return res.status(404).send("Image not found");
    }
    // A stored value looks like "data:image/jpeg;base64,<data>" —
    // split it into its mime type and the actual image bytes.
    var match = product.img.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
    if (!match) return res.status(404).send("Image not found");
    var buffer = Buffer.from(match[2], "base64");
    res.set("Content-Type", match[1]);
    res.set("Cache-Control", "public, max-age=86400"); // product photos rarely change day-to-day
    res.send(buffer);
  } catch (err) {
    sendServerError(res, err);
  }
});

// CREATE PRODUCT (admin)
router.post("/", authMiddleware, adminOnly, async function (req, res) {
  try {
    var body = req.body;
    if (
      !body.id ||
      !body.name ||
      !body.category ||
      !body.numericPrice ||
      !body.img
    ) {
      return res.status(400).json({
        message: "id, name, category, numericPrice and img are required",
      });
    }
    if (typeof body.numericPrice !== "number" || body.numericPrice <= 0) {
      return res
        .status(400)
        .json({ message: "Price must be a positive number" });
    }
    if (
      body.stock !== undefined &&
      (!Number.isInteger(body.stock) || body.stock < 0)
    ) {
      return res
        .status(400)
        .json({ message: "Stock must be a whole number, 0 or more" });
    }
    var existing = await Product.findOne({ id: body.id });
    if (existing)
      return res
        .status(400)
        .json({ message: "A product with that id already exists" });

    var product = new Product({
      id: body.id,
      name: body.name,
      category: body.category,
      price: body.price || "₦" + Number(body.numericPrice).toLocaleString(),
      numericPrice: body.numericPrice,
      oldPrice: body.oldPrice,
      badge: body.badge || "",
      img: body.img,
      desc: body.desc || "",
      specs: body.specs || [],
      stock: body.stock || 0,
      featured: !!body.featured,
    });
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    sendServerError(res, err);
  }
});

// UPDATE PRODUCT (admin)
router.put("/:id", authMiddleware, adminOnly, async function (req, res) {
  try {
    var body = req.body;
    if (
      body.numericPrice !== undefined &&
      (typeof body.numericPrice !== "number" || body.numericPrice <= 0)
    ) {
      return res
        .status(400)
        .json({ message: "Price must be a positive number" });
    }
    if (
      body.stock !== undefined &&
      (!Number.isInteger(body.stock) || body.stock < 0)
    ) {
      return res
        .status(400)
        .json({ message: "Stock must be a whole number, 0 or more" });
    }
    var update = {};
    [
      "name",
      "category",
      "price",
      "numericPrice",
      "oldPrice",
      "badge",
      "img",
      "desc",
      "specs",
      "stock",
      "featured",
      "active",
    ].forEach(function (field) {
      if (body[field] !== undefined) update[field] = body[field];
    });
    var product = await Product.findOneAndUpdate(
      { id: req.params.id },
      update,
      { new: true },
    );
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    sendServerError(res, err);
  }
});

// DELETE PRODUCT (admin)
router.delete("/:id", authMiddleware, adminOnly, async function (req, res) {
  try {
    var product = await Product.findOneAndDelete({ id: req.params.id });
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deleted" });
  } catch (err) {
    sendServerError(res, err);
  }
});

module.exports = router;
