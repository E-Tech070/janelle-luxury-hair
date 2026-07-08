# What changed in this round (CHANGELOG-round2.md)

Read this before merging — it explains 3 real bugs I found in your current
code plus the 3 features you asked for (photo reviews, sale price badges,
self-pickup checkout).

## 🐛 Bugs found and fixed

### 1. Cart was broken when adding from the product detail page
`product.js`'s "Add to Cart" button saved items to a localStorage key called
`janelle_pending_cart`. But the real cart — the one the header icon, drawer,
and checkout page all use — is keyed under `janelle_cart` (defined in
`cart.js`). These never talked to each other. Anything added from a product
page silently disappeared: it never showed up in the cart drawer, badge, or
checkout, and could never actually be ordered.

**Fix:** `product.js` now calls the same `addToCart()` function everything
else uses. `product.html` also now includes `cart.js`, `cart.css`, and the
header cart icon, so it behaves exactly like the homepage.

### 2. Duplicate `data-product-id` attributes (invalid HTML)
Two image tags in the Accessories section had the attribute written twice
with different values (`data-product-id="bobby-pins-acc" data-product-id=
"bobby-pins"`, and similarly for Decorative Pins). This is invalid HTML —
browsers pick one or the other inconsistently, which meant clicking that
card could open the wrong product page.

**Fix:** removed the incorrect duplicate on each, keeping whichever id
actually matches that card's image in your product data.

### 3. Four nearly-identical, copy-pasted click handlers in `script.js`
There were four separate `DOMContentLoaded` blocks all trying to make
product cards clickable, each a slightly different rewrite of the last
(you can see them named "PRODUCT CARD CLICK", "...CLICK FIX", "ACC-CARD
CLICK", "FINAL CARD CLICK" in the old file). This is the exact same pattern
that caused your original Place Order bug — leftover attempts never
cleaned up, silently overriding each other.

**Fix:** consolidated into one handler that covers the shop grid, new
arrivals, and accessories cards.

### 4. Extracted product data into one shared file
`product.js` had its own hardcoded array of all 44 products. I moved that
into `js/products-data.js` so it's the single source of truth — both
`product.js` and the new sale-badges script read from it. If you ever add a
new product, you now only need to update it in one place instead of risking
the two lists drifting apart.

## ✨ New features

### Photo reviews (verified purchases only)
- Customers can only leave a review for a product from an order that's
  actually marked **delivered** — this is enforced on the backend
  (`POST /api/reviews` checks the order belongs to them, is delivered, and
  contains that product), not just hidden in the UI.
- On the account page, delivered order items now show a "⭐ Leave a Review"
  button — star picker, comment box, optional photo (auto-resized in the
  browser before upload so it doesn't bloat the database).
- Reviews start **unapproved**. You approve or delete them from a new
  **Reviews** tab in the admin dashboard, with a pending-count badge.
- Approved reviews show up as a star rating + review count under each
  product's name on the shop grid and product page — click it to open a
  modal with the individual reviews and photos.

### Sale price badges
- Two products (`Glueless HD Lace Bone Straight Wig`, `Deep Wave Bundle
  Deal`) already had an `oldPrice` field sitting unused in your product
  data. `sale-badges.js` now finds any product with an `oldPrice` and
  automatically shows the old price struck through plus a "Save X%" tag —
  no HTML editing needed. To put something else on sale, just add an
  `oldPrice` to its entry in `js/products-data.js`.

### Self-pickup at checkout
- Checkout now has a Delivery vs. Self-Pickup (Lagos) toggle. Picking
  pickup hides the address fields and shows a short note instead. The
  order's delivery method is saved and shown on both the customer's
  account page and the admin order list, so staff know whether to ship or
  prep for pickup.

## Files changed

**New:**
- `backend/models/Review.js`
- `backend/routes/reviews.js`
- `public/js/products-data.js`
- `public/js/sale-badges.js`
- `public/js/reviews.js`
- `public/css/sale-badges.css`
- `public/css/reviews.css`

**Modified:**
- `public/index.html` — new script/css tags, fixed duplicate attributes
- `public/product.html` — added cart icon + cart.js/css, shared product data
- `public/js/product.js` — uses shared product data, fixed cart bug
- `public/js/script.js` — consolidated 4 duplicate click handlers into 1
- `public/js/cart.js` — `addToCart()` now accepts a quantity
- `public/checkout.html` / `checkout.css` / `checkout.js` — pickup option
- `public/js/account.js` / `account.css` — review submission UI
- `public/js/admin.js` / `admin.css` / `admin.html` — review moderation tab
- `backend/server.js` — registered reviews route, raised JSON body limit to
  6mb (needed for base64 review photos)
- `backend/models/Order.js` / `backend/routes/orders.js` — added
  `deliveryMethod`

## How to test

1. `cd backend && npm install && npm start`
2. **Product page cart fix:** open a product detail page, add to cart, confirm
   it shows up in the header cart badge/drawer (previously it wouldn't).
3. **Sale badges:** check the "Glueless HD Lace Bone Straight Wig" and "Deep
   Wave Bundle Deal" cards on the shop grid — should show a struck-through
   old price and a "Save X%" tag.
4. **Self-pickup:** go to checkout, switch to "Self-Pickup", confirm the
   address fields disappear and the note appears; place an order and check
   it shows correctly on the account page and in the admin order list.
5. **Reviews:** as admin, mark an order "delivered". Log in as that customer,
   go to My Orders, leave a review with a photo. As admin, go to the new
   Reviews tab and approve it. Back on the shop grid, that product should
   now show a star rating — click it to see the review and photo.
