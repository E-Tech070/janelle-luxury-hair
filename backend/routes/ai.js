var express = require("express");
var router = express.Router();
var Anthropic = require("@anthropic-ai/sdk");
var Product = require("../models/Product");
var sendServerError = require("../utils/errorResponse");

var anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ============================================================
// SIMPLE ABUSE PROTECTION
// No login is required for this route (anonymous visitors can chat),
// so instead of tying limits to a user account we track by IP.
// This is in-memory, so it resets if the server restarts — that's
// fine for our traffic level, no need for a database table just
// to count messages.
// ============================================================
var RATE_LIMIT_MAX = 20; // messages allowed...
var RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // ...per hour, per IP
var MAX_MESSAGE_LENGTH = 500;
var MAX_HISTORY_MESSAGES = 8;

var requestLog = {}; // { ip: [timestamp, timestamp, ...] }

function isRateLimited(ip) {
  var now = Date.now();
  var timestamps = requestLog[ip] || [];
  // Drop anything older than the window before counting
  timestamps = timestamps.filter(function (t) {
    return now - t < RATE_LIMIT_WINDOW_MS;
  });
  requestLog[ip] = timestamps;
  if (timestamps.length >= RATE_LIMIT_MAX) return true;
  timestamps.push(now);
  return false;
}

// Every so often, clear out IPs with no recent activity so this
// object doesn't grow forever on a long-running server.
setInterval(
  function () {
    var now = Date.now();
    for (var ip in requestLog) {
      requestLog[ip] = requestLog[ip].filter(function (t) {
        return now - t < RATE_LIMIT_WINDOW_MS;
      });
      if (requestLog[ip].length === 0) delete requestLog[ip];
    }
  },
  30 * 60 * 1000,
);

// Builds a compact, token-friendly text block listing what's
// actually in stock, so the AI recommends real products instead
// of making things up.
function buildProductContext(products) {
  if (!products.length) return "No products are currently available.";
  return products
    .map(function (p) {
      var line = "- " + p.name + " (" + p.category + ") — " + p.price;
      if (p.oldPrice) line += " (was " + p.oldPrice + ")";
      line += p.stock > 0 ? " — in stock" : " — OUT OF STOCK";
      if (p.featured) line += " — featured";
      if (p.desc) line += "\n  " + p.desc.substring(0, 140);
      return line;
    })
    .join("\n");
}

function buildSystemPrompt(productContext) {
  return (
    "You are the friendly, knowledgeable hair consultant for Janelle Luxury Hairs & Accessories, " +
    "a Nigerian hair e-commerce store. You help customers find the right wig, bundle, closure, or " +
    "accessory for their needs.\n\n" +
    "CURRENT PRODUCTS IN OUR CATALOG:\n" +
    productContext +
    "\n\n" +
    "HOW TO HELP:\n" +
    "- Only recommend products from the list above, by their real name and price. Never invent products or prices.\n" +
    "- Ask a quick clarifying question when it helps narrow things down — budget, hair type/texture, occasion, " +
    "or whether they want a wig vs bundles vs a closure.\n" +
    "- Be warm and conversational, not robotic. Keep replies fairly short — a few sentences, not an essay.\n" +
    "- Once a customer seems ready to buy, or asks something you can't fully resolve in chat, point them to " +
    "WhatsApp at +2348107796481 or encourage them to place the order directly on the site.\n" +
    "- If nothing in the catalog fits what they're asking for, say so honestly and suggest WhatsApp instead of guessing.\n" +
    "- Never make up delivery times, discounts, or policies that aren't given to you here."
  );
}

router.post("/chat", async function (req, res) {
  try {
    var ip =
      req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    if (isRateLimited(ip)) {
      return res
        .status(429)
        .json({
          message:
            "Too many messages — please try again in a bit, or chat with us on WhatsApp at +2348107796481.",
        });
    }

    var message = req.body.message;
    var conversationHistory = Array.isArray(req.body.conversationHistory)
      ? req.body.conversationHistory
      : [];

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ message: "Message can't be empty." });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res
        .status(400)
        .json({
          message:
            "Message is too long (max " + MAX_MESSAGE_LENGTH + " characters).",
        });
    }

    // Only trust role + content from history, cap length, and keep
    // just the most recent few messages so this can't be used to
    // stuff the request with junk.
    var safeHistory = conversationHistory
      .filter(function (m) {
        return (
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string"
        );
      })
      .slice(-MAX_HISTORY_MESSAGES)
      .map(function (m) {
        return {
          role: m.role,
          content: m.content.substring(0, MAX_MESSAGE_LENGTH),
        };
      });

    var products = await Product.find({ active: true })
      .select("name category price oldPrice desc stock featured")
      .limit(60)
      .lean();

    var systemPrompt = buildSystemPrompt(buildProductContext(products));

    var apiResponse = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 500,
      system: systemPrompt,
      messages: safeHistory.concat([{ role: "user", content: message }]),
    });

    var reply = apiResponse.content
      .filter(function (block) {
        return block.type === "text";
      })
      .map(function (block) {
        return block.text;
      })
      .join("\n")
      .trim();

    if (!reply) {
      return res
        .status(502)
        .json({ message: "The AI didn't return a reply. Please try again." });
    }

    res.json({ reply: reply });
  } catch (err) {
    console.log("❌ AI chat error:", err.message);
    sendServerError(res, err);
  }
});

module.exports = router;