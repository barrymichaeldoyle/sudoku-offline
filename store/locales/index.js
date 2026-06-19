const fs = require("fs");
const path = require("path");

/** @returns {Record<string, import('./en-US.json')>} */
function loadLocales() {
  const localesDir = __dirname;
  /** @type {Record<string, import('./en-US.json')>} */
  const info = {};

  for (const file of fs.readdirSync(localesDir)) {
    if (!file.endsWith(".json") || file.startsWith("_")) {
      continue;
    }

    const locale = file.replace(/\.json$/, "");
    info[locale] = require(path.join(localesDir, file));
  }

  return info;
}

module.exports = loadLocales();
