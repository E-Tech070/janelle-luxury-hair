var user = JSON.parse(localStorage.getItem("janelle_user") || "null");
var link = document.getElementById("account-header-link");
if (link) {
  if (user) { link.href = user.role === "admin" ? "admin.html" : "account.html"; link.title = user.name; }
  else { link.href = "login.html"; link.title = "Login / Sign Up"; }
}
