// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// expo-sqlite's web build imports a .wasm module; Metro must treat it as an asset.
config.resolver.assetExts.push("wasm");

module.exports = withNativewind(config, {
  // inline variables break PlatformColor in CSS variables
  inlineVariables: false,
  // We add className support manually via the wrappers in src/tw
  globalClassNamePolyfill: false,
});
