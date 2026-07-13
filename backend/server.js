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
