// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add resolution for date-fns CJS modules
config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs'];

module.exports = config;
