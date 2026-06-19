const baseConfig = require("./store.config.json");
const locales = require("./store/locales");

const year = new Date().getFullYear();

/** @param {Record<string, Record<string, unknown>>} info */
function applyUrlOverrides(info) {
  const supportUrl = process.env.STORE_SUPPORT_URL;
  const privacyPolicyUrl = process.env.STORE_PRIVACY_URL;
  if (!supportUrl && !privacyPolicyUrl) {
    return info;
  }

  /** @type {Record<string, Record<string, unknown>>} */
  const updated = {};

  for (const [locale, copy] of Object.entries(info)) {
    updated[locale] = { ...copy };
    if (supportUrl) {
      updated[locale].supportUrl = supportUrl;
    }
    if (privacyPolicyUrl) {
      updated[locale].privacyPolicyUrl = privacyPolicyUrl;
    }
  }

  return updated;
}

module.exports = {
  ...baseConfig,
  apple: {
    ...baseConfig.apple,
    copyright: `${year} Barry Michael Doyle`,
    info: applyUrlOverrides(locales),
  },
};
