// app.config.js — dynamic config that layers environment variables on top of
// the static app.json. This is the place to inject EXPO_PUBLIC_* vars that
// must be baked into the bundle at EAS build time.

/** @type {import('@expo/config').ExpoConfig} */
const baseConfig = require('./app.json').expo;

module.exports = ({ config: _config }) => {
  return {
    ...baseConfig,
    extra: {
      ...baseConfig.extra,
      clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '',
      apiUrl: process.env.EXPO_PUBLIC_API_URL ?? '',
    },
  };
};
