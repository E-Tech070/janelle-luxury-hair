# CHANGELOG-round7.md — Live two-way chat (customer ↔ admin)

## What's new

Replaced the old one-way "Contact Us" form + read-only "Messages" tab with
a real back-and-forth chat, right on the site:

- **Customer side** (account page): a single "Chat with Us" tab with a
  message thread (their messages on the right, admin replies on the left —
  same layout convention as WhatsApp/iMessage), a text box, and a photo
  attach button. Checks for new messages every 6 seconds while the page is
  open, and shows an unread-count badge on the nav button even when you're
  on a different tab.
- **Admin side**: the old "Inbox" tab is now "Chat" — a two-pane inbox.
  Left side lists every customer who's messaged (name, last message
  preview, unread count). Click one to open the full thread on the right
  and reply directly. Also polls every 6 seconds for new messages.
- **Photos** work both directions — attach a photo (auto-resized in the
  browser before sending, same approach as the review photos) alongside or
  instead of text.

## ⚠️ Videos are not supported (and why)

There's no file-storage service (like Cloudinary or S3) set up in this
project. Photos work as base64 text stored directly in MongoDB, which is
fine for images but would be a bad idea for video — even a few seconds of
video is usually several megabytes, base64-encoding inflates that by ~33%,
and MongoDB documents cap out at 16MB. Trying to cram video in this way
would be slow and unreliable.

**If you want video support**, the real fix is adding a media hosting
service (Cloudinary has a solid free tier and is the natural next step) —
customers/admin would upload directly to that service, and only the
resulting URL gets stored in your database. That's a distinct, separate
piece of work — let me know if you want it built.

## What happened to the old Contact/Messages system

Nothing was deleted from your database — old contact messages (with
subject/body) are still sitting in MongoDB exactly as before, just no
longer shown in the UI (which now uses the new `ChatMessage` model
instead). If you ever need to see that old data, it's still queryable
directly, just not through the site anymore.

## Files changed

**New:**
- `backend/models/ChatMessage.js`
- `backend/routes/chat.js` (this reuses the `/api/chat` path — the old,
  unused AI chatbot route that lived there before round 3 is long gone;
  this is an unrelated, actually-used feature)

**Modified:**
- `backend/server.js` — registered the new chat route
- `public/account.html` — "Messages" + "Contact Us" tabs replaced with one
  "Chat with Us" tab
- `public/js/account.js` — old one-way message/contact code replaced with
  live chat (send, poll, render bubbles, photo attach)
- `public/css/account.css` — chat bubble/thread/input styling
- `public/admin.html` — "Inbox" tab replaced with a two-pane "Chat" tab
- `public/js/admin.js` — old inbox code replaced with conversation list +
  open-thread view + reply box
- `public/css/admin.css` — two-pane chat layout + shared bubble styling

## How to test

1. `cd backend && npm install && npm start` (no new dependencies, so this
   is just a normal restart)
2. As a customer, go to account → **Chat with Us**, send a message with
   and without a photo attached
3. As admin, go to the **Chat** tab — you should see that customer listed
   with an unread badge and a preview of their message
4. Click the conversation, type a reply, send it
5. Back on the customer's account page (within ~6 seconds, or refresh),
   the reply should appear on the left side of the thread
6. Try sending a message from a second customer account and confirm both
   conversations show up correctly and independently for the admin
