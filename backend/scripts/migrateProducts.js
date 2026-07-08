// ============================================================
// ONE-TIME MIGRATION SCRIPT
// Reads your existing public/js/products-data.js and seeds every
// product into MongoDB. Safe to run more than once — it skips any
// product whose "id" already exists in the database.
//
// HOW TO RUN (from the backend folder):
//   node scripts/migrateProducts.js
// ============================================================

var mongoose = require("mongoose");
var fs = require("fs");
var path = require("path");
require("dotenv").config();
var Product = require("../models/Product");

// products-data.js defines "var PRODUCTS = [...]" for the browser.
// We can't require() it directly in Node because it's not a module,
// so we read the file as text and pull the array out safely.
function loadProducts() {
  var filePath = path.join(__dirname, "../../public/js/products-data.js");
  var fileText = fs.readFileSync(filePath, "utf8");
  var startIndex = fileText.indexOf("[");
  var endIndex = fileText.lastIndexOf("]");
  var arrayText = fileText.substring(startIndex, endIndex + 1);
  var products = eval(arrayText);
  return products;
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    var products = loadProducts();
    console.log("Found " + products.length + " products in products-data.js");

    var created = 0;
    var skipped = 0;

    for (var i = 0; i < products.length; i++) {
      var p = products[i];
      var existing = await Product.findOne({ id: p.id });
      if (existing) {
        skipped = skipped + 1;
        continue;
      }
      await Product.create({
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.price,
        numericPrice: p.numericPrice,
        oldPrice: p.oldPrice,
        badge: p.badge || "",
        img: p.img,
        desc: p.desc || "",
        specs: p.specs || [],
        stock: 50,
        featured: false,
      });
      created = created + 1;
    }

    console.log(
      "✅ Migration complete: " +
        created +
        " created, " +
        skipped +
        " skipped (already existed)",
    );
    process.exit(0);
  } catch (err) {
    console.log("❌ Migration failed:", err.message);
    process.exit(1);
  }
}

run();
