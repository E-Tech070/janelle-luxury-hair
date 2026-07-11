var express = require("express");
var mongoose = require("mongoose");
var cors = require("cors");
var path = require("path");
var compression = require("compression");
require("dotenv").config();
var app = express();
app.use(cors());
app.use(compression());
app.use(express.json({ limit: "6mb" }));
app.use(express.static(path.join(__dirname, "../public"), { maxAge: "1d" }));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/reviews", require("./routes/reviews"));
app.use("/api/chat", require("./routes/chat"));
app.use("/api/products", require("./routes/products"));
app.use("/api/ai", require("./routes/ai"));
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