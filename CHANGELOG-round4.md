# CHANGELOG-round4.md — Order confirmation emails

## What's new

When a customer places an order, they now get an automatic confirmation
email (order items, total, and delivery/pickup info) sent via **Resend**
(resend.com) — a transactional email API with a generous free tier
(3,000 emails/month), and no fragile Gmail-app-password setup to babysit.

Sending the email never blocks or breaks placing the order — if Resend is
misconfigured, down, or the API key is missing, the order still saves
normally and the failure is just logged on the server, not shown to the
customer.

## ⚠️ You need to do 2 things before this works

### 1. Get a free Resend API key
- Go to resend.com and sign up (free)
- In the dashboard, go to **API Keys** → create one
- Copy the key (starts with `re_...`)

### 2. Add it to your `.env` file
Open `backend/.env` and add this line:
```
RESEND_API_KEY=re_your_key_here
```

That's it for testing — Resend lets you send from `onboarding@resend.dev`
without any extra setup, which is what this uses by default.

**Later, once you have your own domain** (e.g. `janelleluxuryhairs.com`),
verify it in the Resend dashboard (Domains → Add Domain, then add a couple
of DNS records they give you), and add this line to `.env` too:
```
FROM_EMAIL=Janelle Luxury Hairs <orders@janelleluxuryhairs.com>
```
This makes emails look properly branded and improves the chance they land
in the inbox instead of spam. Not required to get started, but worth doing
before you're sending emails at real volume.

## Files changed

**New:**
- `backend/utils/email.js` — builds the email HTML and sends it via Resend

**Modified:**
- `backend/routes/orders.js` — calls the email helper right after an order
  saves
- `backend/package.json` — added `resend` as a dependency

## How to test

1. Add `RESEND_API_KEY` to `.env` (see above)
2. `cd backend && npm install` (pulls in the new `resend` package)
3. `npm start` — watch the terminal for either:
   - `✅ Order confirmation email sent to ...` (it worked)
   - `⚠️  RESEND_API_KEY not set — skipping...` (you forgot step 1)
   - `❌ Could not send order confirmation email: ...` (something's wrong
     with the key or Resend — the error message will say what)
4. Place a test order using your own email address and check your inbox
   (and spam folder, especially before you verify your own domain)
