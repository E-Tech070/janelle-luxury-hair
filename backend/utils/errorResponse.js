
function sendServerError(res, err) {
  console.log("❌ Server error:", err.message);
  res.status(500).json({ message: "Something went wrong. Please try again." });
}

module.exports = sendServerError;