var chatOpen = false;
var messages = [];
var conversationHistory = []; // last few {role, content} pairs sent to the AI for context
var MAX_HISTORY = 8;
var isWaitingForReply = false;

var btn = document.createElement("div");
btn.id = "jl-chat-btn";
btn.textContent = "💬";
btn.style.cssText =
  "position:fixed;bottom:1.5rem;right:1.5rem;width:54px;height:54px;border-radius:50%;background:#c9a84c;color:#080808;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:9999;box-shadow:0 4px 20px rgba(201,168,76,0.45);font-size:1.4rem;";
document.body.appendChild(btn);

var panel = document.createElement("div");
panel.id = "jl-chat-panel";
panel.style.cssText =
  "display:none;position:fixed;bottom:5.5rem;right:1.5rem;width:340px;max-width:calc(100vw - 2rem);background:#111;border:1px solid #2a2a2a;border-radius:16px;z-index:9999;box-shadow:0 20px 60px rgba(0,0,0,0.6);overflow:hidden;";
panel.innerHTML =
  '<div style="background:#c9a84c;padding:1rem 1.25rem;display:flex;justify-content:space-between;align-items:center;"><div><div style="font-family:Playfair Display,serif;font-weight:700;font-size:1rem;color:#080808;">Janelle Assistant</div><div style="font-size:.72rem;color:#333;">Ask me anything about our products</div></div><button id="jl-chat-close" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:#080808;">✕</button></div><div id="jl-chat-messages" style="height:280px;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.75rem;"></div><div style="padding:.75rem;border-top:1px solid #2a2a2a;display:flex;gap:.5rem;"><input id="jl-chat-input" placeholder="Type your question..." style="flex:1;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:.6rem .9rem;color:#fff;font-size:.85rem;outline:none;font-family:Jost,sans-serif;"/><button id="jl-chat-send" style="background:#c9a84c;color:#080808;border:none;border-radius:8px;padding:.6rem 1rem;font-weight:700;cursor:pointer;font-size:.85rem;">Send</button></div>';
document.body.appendChild(panel);

function addMsg(role, text) {
  var el = document.getElementById("jl-chat-messages");
  var div = document.createElement("div");
  div.style.cssText =
    role === "user"
      ? "align-self:flex-end;background:#c9a84c;color:#080808;padding:.5rem .9rem;border-radius:12px 12px 2px 12px;font-size:.83rem;max-width:80%;font-family:Jost,sans-serif;"
      : "align-self:flex-start;background:#1a1a1a;color:#e8e8e8;padding:.5rem .9rem;border-radius:12px 12px 12px 2px;font-size:.83rem;max-width:85%;line-height:1.5;font-family:Jost,sans-serif;";
  div.textContent = text;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  return div;
}

// Shows a small "..." bubble while we wait on the API, in the same
// style as an assistant message so it doesn't look out of place.
function addTypingIndicator() {
  var el = document.getElementById("jl-chat-messages");
  var div = document.createElement("div");
  div.id = "jl-chat-typing";
  div.style.cssText =
    "align-self:flex-start;background:#1a1a1a;color:#888;padding:.5rem .9rem;border-radius:12px 12px 12px 2px;font-size:.83rem;font-family:Jost,sans-serif;letter-spacing:2px;";
  div.textContent = "...";
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function removeTypingIndicator() {
  var el = document.getElementById("jl-chat-typing");
  if (el) el.remove();
}

async function sendMessage(text) {
  if (isWaitingForReply) return; // avoid piling up requests if they hit enter twice
  addMsg("user", text);
  isWaitingForReply = true;
  addTypingIndicator();

  try {
    var res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        conversationHistory: conversationHistory,
      }),
    });
    var data = await res.json();

    removeTypingIndicator();

    if (!res.ok) {
      addMsg(
        "assistant",
        data.message ||
          "Sorry, I'm having trouble right now — please chat with us on WhatsApp at +2348107796481.",
      );
      isWaitingForReply = false;
      return;
    }

    addMsg("assistant", data.reply);

    // Keep a short rolling history so follow-up questions have context,
    // without letting the payload grow forever.
    conversationHistory.push({ role: "user", content: text });
    conversationHistory.push({ role: "assistant", content: data.reply });
    if (conversationHistory.length > MAX_HISTORY) {
      conversationHistory = conversationHistory.slice(-MAX_HISTORY);
    }
  } catch (err) {
    removeTypingIndicator();
    addMsg(
      "assistant",
      "Sorry, I'm having trouble right now — please chat with us on WhatsApp at +2348107796481.",
    );
  }

  isWaitingForReply = false;
}

btn.addEventListener("click", function () {
  chatOpen = !chatOpen;
  panel.style.display = chatOpen ? "block" : "none";
  if (
    chatOpen &&
    document.getElementById("jl-chat-messages").children.length === 0
  ) {
    addMsg(
      "assistant",
      "Hi! Welcome to Janelle Luxury Hairs. I can help you find the right wig, bundle, closure or accessory. What are you looking for today?",
    );
  }
});

document.addEventListener("click", function (e) {
  if (e.target.id === "jl-chat-close") {
    chatOpen = false;
    panel.style.display = "none";
  }
  if (e.target.id === "jl-chat-send") {
    var input = document.getElementById("jl-chat-input");
    var text = input.value.trim();
    if (!text) return;
    input.value = "";
    sendMessage(text);
  }
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && document.activeElement.id === "jl-chat-input") {
    document.getElementById("jl-chat-send").click();
  }
});
