// Optional helper: run `node apply-update.js` from the repository root
// after copying this update's js/ and supabase/ folders into the project.
const fs = require("fs");
const path = require("path");

const indexPath = path.resolve(process.cwd(), "index.html");
const scriptLine = '<script src="js/admin-star-delete.js?v=35-1"></script>';

if (!fs.existsSync(indexPath)) {
  console.error("index.html was not found in the current folder.");
  process.exit(1);
}

let html = fs.readFileSync(indexPath, "utf8");
if (html.includes("js/admin-star-delete.js")) {
  console.log("The administrator star-delete script is already installed.");
  process.exit(0);
}

const appScriptPattern = /(<script\s+src=["'][^"']*js\/app\.js[^"']*["']\s*><\/script>)/i;
if (!appScriptPattern.test(html)) {
  console.error("Could not find the js/app.js script in index.html.");
  process.exit(1);
}

html = html.replace(appScriptPattern, `$1\n  ${scriptLine}`);
fs.writeFileSync(indexPath, html, "utf8");
console.log("index.html updated successfully.");
