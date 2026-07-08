var API = "/api";

function showError(msg) {
  var el = document.getElementById("auth-error");
  if (el) { el.textContent = msg; el.style.display = "block"; }
}

var loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async function(e) {
    e.preventDefault();
    var btn = document.getElementById("login-btn");
    btn.textContent = "Signing in...";
    btn.disabled = true;
    var email = document.getElementById("login-email").value.trim();
    var password = document.getElementById("login-password").value;
    try {
      var res = await fetch(API + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      var data = await res.json();
      if (!res.ok) { showError(data.message || "Login failed"); btn.textContent = "Sign In"; btn.disabled = false; return; }
      localStorage.setItem("janelle_token", data.token);
      localStorage.setItem("janelle_user", JSON.stringify(data.user));

      // If the user was sent here from checkout (cart not empty), send them back.
      var redirectTo = localStorage.getItem("janelle_redirect_after_login");
      localStorage.removeItem("janelle_redirect_after_login");
      if (redirectTo) {
        window.location.href = redirectTo;
      } else if (data.user.role === "admin") {
        window.location.href = "admin.html";
      } else {
        window.location.href = "account.html";
      }
    } catch(err) {
      showError("Connection error. Make sure the server is running.");
      btn.textContent = "Sign In"; btn.disabled = false;
    }
  });
}

var signupForm = document.getElementById("signup-form");
if (signupForm) {
  signupForm.addEventListener("submit", async function(e) {
    e.preventDefault();
    var btn = document.getElementById("signup-btn");
    var name = document.getElementById("signup-name").value.trim();
    var email = document.getElementById("signup-email").value.trim();
    var phone = document.getElementById("signup-phone").value.trim();
    var password = document.getElementById("signup-password").value;
    var confirm = document.getElementById("signup-confirm").value;
    if (password !== confirm) { showError("Passwords do not match"); return; }
    if (password.length < 6) { showError("Password must be at least 6 characters"); return; }
    btn.textContent = "Creating account...";
    btn.disabled = true;
    try {
      var res = await fetch(API + "/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, phone, password }) });
      var data = await res.json();
      if (!res.ok) { showError(data.message || "Registration failed"); btn.textContent = "Create Account"; btn.disabled = false; return; }
      localStorage.setItem("janelle_token", data.token);
      localStorage.setItem("janelle_user", JSON.stringify(data.user));
      window.location.href = "account.html";
    } catch(err) {
      showError("Connection error. Make sure the server is running.");
      btn.textContent = "Create Account"; btn.disabled = false;
    }
  });
}
