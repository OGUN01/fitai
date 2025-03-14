module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Add React Native Reanimated plugin
      'react-native-reanimated/plugin',
      // Add a plugin to handle CJS files
      ['module-resolver', {
        alias: {
          // This creates an alias to handle the problematic formatRFC7231.cjs file
          './formatRFC7231.cjs': './node_modules/date-fns/_lib/format/formatters/index.js',
        },
      }],
    ],
  };
};
