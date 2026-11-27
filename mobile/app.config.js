// app.config.js — dynamic config that layers environment variables on top of
// the static app.json.

module.exports = ({ config }) => {
  return {
    ...config,
    extra: {
      ...config?.extra,
      clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '',
      apiUrl: process.env.EXPO_PUBLIC_API_URL ?? '',
    },
  };
};

