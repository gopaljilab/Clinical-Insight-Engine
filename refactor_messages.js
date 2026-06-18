const fs = require('fs');
const path = require('path');

const routesDir = path.join(process.cwd(), 'server', 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts'));

function stringToKey(str) {
  if (str.includes("timed out")) return "api.errors.timeout";
  if (str.includes("Invalid input")) return "api.errors.invalid_input";
  if (str.includes("Internal server error")) return "api.errors.internal_error";
  if (str.includes("Authentication required") || str.includes("Unauthorized")) return "api.errors.unauthorized";
  if (str.includes("Forbidden")) return "api.errors.forbidden";
  if (str.includes("not found")) return "api.errors.not_found";
  if (str.includes("failed")) return "api.errors.operation_failed";
  
  let key = str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (key.length > 20) key = key.substring(0, 20).replace(/_$/, '');
  return "api.errors." + key;
}

const regexMessage = /(message|error):\s*["']([^"']+)["']/g;

files.forEach(file => {
  const filePath = path.join(routesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  content = content.replace(regexMessage, (match, keyName, text) => {
    if (text.startsWith('api.errors.') || text.startsWith('validation.')) {
      return match;
    }
    if (text === "success" || text === "error") {
      return match;
    }
    
    changed = true;
    const key = stringToKey(text);
    return keyName + ": '" + key + "'";
  });

  const regexZod = /(message|error):\s*err\.errors\[0\]\?\.message\s*\?\?\s*["']([^"']+)["']/g;
  content = content.replace(regexZod, (match, keyName, text) => {
    changed = true;
    const key = stringToKey(text);
    return keyName + ": err.errors[0]?.message ?? '" + key + "'";
  });

  // some files might have res.status(400).send("...") but we mostly use json. let's check send
  const regexSend = /send\(\s*["']([^"']+)["']\s*\)/g;
  content = content.replace(regexSend, (match, text) => {
    if (text.startsWith('api.errors.') || text.startsWith('validation.')) return match;
    changed = true;
    return "send('" + stringToKey(text) + "')";
  });

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Updated " + file);
  }
});
