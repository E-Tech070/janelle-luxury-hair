var chatOpen = false;
var messages = [];

var btn = document.createElement("div");
btn.id = "jl-chat-btn";
btn.textContent = "💬";
btn.style.cssText = "position:fixed;bottom:1.5rem;right:1.5rem;width:54px;height:54px;border-radius:50%;background:#c9a84c;color:#080808;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:9999;box-shadow:0 4px 20px rgba(201,168,76,0.45);font-size:1.4rem;";
document.body.appendChild(btn);

var panel = document.createElement("div");
panel.id = "jl-chat-panel";
panel.style.cssText = "display:none;position:fixed;bottom:5.5rem;right:1.5rem;width:340px;max-width:calc(100vw - 2rem);background:#111;border:1px solid #2a2a2a;border-radius:16px;z-index:9999;box-shadow:0 20px 60px rgba(0,0,0,0.6);overflow:hidden;";
panel.innerHTML = '<div style="background:#c9a84c;padding:1rem 1.25rem;display:flex;justify-content:space-between;align-items:center;"><div><div style="font-family:Playfair Display,serif;font-weight:700;font-size:1rem;color:#080808;">Janelle Assistant</div><div style="font-size:.72rem;color:#333;">Ask me anything about our products</div></div><button id="jl-chat-close" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:#080808;">✕</button></div><div id="jl-chat-messages" style="height:280px;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.75rem;"></div><div style="padding:.75rem;border-top:1px solid #2a2a2a;display:flex;gap:.5rem;"><input id="jl-chat-input" placeholder="Type your question..." style="flex:1;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:.6rem .9rem;color:#fff;font-size:.85rem;outline:none;font-family:Jost,sans-serif;"/><button id="jl-chat-send" style="background:#c9a84c;color:#080808;border:none;border-radius:8px;padding:.6rem 1rem;font-weight:700;cursor:pointer;font-size:.85rem;">Send</button></div>';
document.body.appendChild(panel);

var faqs = {
  "price": "Our prices range from ₦1,200 for accessories to ₦115,000 for premium wigs. HD lace wigs from ₦85,000, bundles from ₦45,000, braided wigs from ₦55,000, closures from ₦28,000.",
  "wig": "We have HD lace wigs, glueless wigs, body wave, bone straight, curly and braided wigs. Prices start from ₦55,000. Chat us on WhatsApp to order!",
  "delivery": "We offer same-day delivery in Lagos and 2-3 business days nationwide across Nigeria.",
  "order": "To place an order, click the WhatsApp button on any product or chat us directly at +2348107796481.",
  "payment": "We accept bank transfer and payment on delivery (Lagos only). Contact us on WhatsApp for payment details.",
  "bundle": "We have Brazilian, Peruvian and Malaysian hair bundles in straight, wavy and curly. Bundles start from ₦45,000.",
  "closure": "We stock 4x4, 5x5 and 6x6 HD lace closures and 13x4, 13x6 frontals. Closures from ₦28,000.",
  "accessory": "We have hair clips, bobby pins, headbands, scrunchies, claw clips, hair bows, scarves, tiaras and more from ₦1,200.",
  "human hair": "Yes! All our wigs and bundles are 100% human hair — no synthetic blends.",
  "contact": "You can reach us on WhatsApp at +2348107796481 or use the Contact Us form after logging in.",
  "hello": "Hi! How can I help you today? You can ask me about our products, prices, delivery or how to place an order.",
  "hi": "Hello! Welcome to Janelle Luxury Hairs. Ask me about our wigs, bundles, accessories or delivery.",
  "service": "We offer hair dyeing, colouring, frontal wigging, hair revamping, braided wigs and professional training. Book via WhatsApp."
};

function getReply(text) {
  var lower = text.toLowerCase();
  for (var key in faqs) {
    if (lower.indexOf(key) !== -1) return faqs[key];
  }
  return "Great question! For the most accurate answer, please chat with us directly on WhatsApp at +2348107796481 and we will respond immediately.";
}

function addMsg(role, text) {
  var el = document.getElementById("jl-chat-messages");
  var div = document.createElement("div");
  div.style.cssText = role === "user"
    ? "align-self:flex-end;background:#c9a84c;color:#080808;padding:.5rem .9rem;border-radius:12px 12px 2px 12px;font-size:.83rem;max-width:80%;font-family:Jost,sans-serif;"
    : "align-self:flex-start;background:#1a1a1a;color:#e8e8e8;padding:.5rem .9rem;border-radius:12px 12px 12px 2px;font-size:.83rem;max-width:85%;line-height:1.5;font-family:Jost,sans-serif;";
  div.textContent = text;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function sendMessage(text) {
  addMsg("user", text);
  setTimeout(function() {
    addMsg("assistant", getReply(text));
  }, 600);
}

btn.addEventListener("click", function() {
  chatOpen = !chatOpen;
  panel.style.display = chatOpen ? "block" : "none";
  if (chatOpen && document.getElementById("jl-chat-messages").children.length === 0) {
    addMsg("assistant", "Hi! Welcome to Janelle Luxury Hairs. I can help you with products, pricing, delivery and how to order. What would you like to know?");
  }
});

document.addEventListener("click", function(e) {
  if (e.target.id === "jl-chat-close") { chatOpen = false; panel.style.display = "none"; }
  if (e.target.id === "jl-chat-send") {
    var input = document.getElementById("jl-chat-input");
    var text = input.value.trim();
    if (!text) return;
    input.value = "";
    sendMessage(text);
  }
});

document.addEventListener("keydown", function(e) {
  if (e.key === "Enter" && document.activeElement.id === "jl-chat-input") {
    document.getElementById("jl-chat-send").click();
  }
});
