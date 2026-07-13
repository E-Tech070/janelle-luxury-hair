var express = require("express");
var mongoose = require("mongoose");
var cors = require("cors");
var path = require("path");
var compression = require("compression");
require("dotenv").config();
var app = express();

// Render sits in front of this app as a proxy. Trusting it means
// req.protocol correctly reports "https" (needed for password reset
// links) and rate-limiting by IP sees the real visitor IP instead of
// Render's internal one.
app.set("trust proxy", 1);

app.use(cors());
app.use(compression());
app.use(express.json({ limit: "6mb" }));

// Escapes text before it goes into an HTML attribute, so a product
// name or description containing a quote or "&" can't break the
// surrounding markup. Same idea as the escapeHtml() helper already
// used throughout the frontend JS, just needed here server-side too.
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Intercepts requests for the product page BEFORE the static file
// server gets to it, so a shared product link (e.g. on WhatsApp) can
// show that product's real name, price and photo in the preview —
// not just the site's generic branding. Falls through to the normal
// static file (next()) whenever there's no id, or the product can't
// be found, so nothing breaks for a plain /product.html visit.
app.get("/product.html", async function (req, res, next) {
  try {
    var id = req.query.id;
    if (!id) return next();

    var Product = require("./models/Product");
    var product = await Product.findOne({ id: id, active: true }).lean();
    if (!product) return next();

    var fs = require("fs");
    var filePath = path.join(__dirname, "../public/product.html");
    var html = fs.readFileSync(filePath, "utf8");

    var siteUrl = req.protocol + "://" + req.get("host");
    var name = escapeHtml(product.name);
    var description = escapeHtml(
      (product.desc && product.desc.trim()) ||
        product.name +
          " — " +
          product.price +
          " at Janelle Luxury Hairs & Accessories.",
    ).substring(0, 200);
    var imageUrl =
      siteUrl + "/api/products/" + encodeURIComponent(product.id) + "/image";
    var pageUrl =
      siteUrl + "/product.html?id=" + encodeURIComponent(product.id);

    html = html
      .replace(
        "<title>Product – Janelle Luxury Hairs</title>",
        "<title>" + name + " – Janelle Luxury Hairs</title>",
      )
      .replace(
        '<meta name="description" content="Shop premium wigs, bundles, closures and accessories at Janelle Luxury Hairs. 100% human hair, delivered across Nigeria." />',
        '<meta name="description" content="' + description + '" />',
      )
      .replace(
        '<meta property="og:title" content="Shop at Janelle Luxury Hairs & Accessories" />',
        '<meta property="og:title" content="' + name + '" />',
      )
      .replace(
        '<meta property="og:description" content="Premium wigs, weaves, extensions, braids, closures, frontals and accessories." />',
        '<meta property="og:description" content="' + description + '" />',
      )
      .replace(
        '<meta property="og:image" content="https://janelle-luxury-hair.onrender.com/images/hair-products.jpg" />',
        '<meta property="og:image" content="' +
          imageUrl +
          '" /><meta property="og:url" content="' +
          pageUrl +
          '" />',
      );

    res.send(html);
  } catch (err) {
    next(); // any failure just falls back to the normal static page
  }
});

app.use(
  express.static(path.join(__dirname, "../public"), {
    maxAge: "1d",
    setHeaders: function (res, filePath) {
      // CSS and JS change often while we're actively building this site.
      // "no-cache" doesn't mean "never cache" — it means the browser must
      // check back with the server before reusing its cached copy, so
      // fixes show up immediately instead of being stuck for up to a day.
      if (filePath.endsWith(".css") || filePath.endsWith(".js")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  }),
);

// Lightweight endpoint for an uptime monitor (e.g. UptimeRobot) to
// ping every 5-10 minutes, so Render's free tier never sees 15
// minutes of silence and never spins the service down. No database
// call here on purpose — this should stay fast and cheap to hit.
app.get("/api/health", function (req, res) {
  res.json({ status: "ok" });
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/reviews", require("./routes/reviews"));
app.use("/api/chat", require("./routes/chat"));
app.use("/api/products", require("./routes/products"));
app.use("/api/ai", require("./routes/ai"));
app.use("/api/stats", require("./routes/stats"));

// Dynamic sitemap — built from the actual product list on every
// request, so it's never stale the way a hand-written static file
// would be as products get added or removed.
app.get("/sitemap.xml", async function (req, res) {
  try {
    var Product = require("./models/Product");
    var products = await Product.find({ active: true }).select("id").lean();
    var SITE = "https://janelle-luxury-hair.onrender.com";

    var urls = [
      SITE + "/",
      SITE + "/privacy-policy.html",
      SITE + "/terms-of-service.html",
      SITE + "/return-policy.html",
    ];
    products.forEach(function (p) {
      urls.push(SITE + "/product.html?id=" + p.id);
    });

    var xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    urls.forEach(function (u) {
      xml += "  <url><loc>" + u + "</loc></url>\n";
    });
    xml += "</urlset>";

    res.header("Content-Type", "application/xml");
    res.send(xml);
  } catch (err) {
    res.status(500).send("Could not generate sitemap");
  }
});
app.get("/{*splat}", function (req, res) {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});
mongoose
  .connect(process.env.MONGO_URI)
  .then(function () {
    console.log("✅ Connected to MongoDB");
    app.listen(process.env.PORT || 5000, function () {
      console.log("✅ Server running on port " + (process.env.PORT || 5000));
    });
  })
  .catch(function (err) {
    console.log("❌ MongoDB connection error:", err.message);
  });
