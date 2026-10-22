const { withAndroidManifest } = require('expo/config-plugins');

const allowCleartext = process.env.AURASUTRA_ALLOW_CLEARTEXT !== 'false';

module.exports = function withCleartextTraffic(config) {
  if (!allowCleartext) return config;

  return withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults?.manifest?.application?.[0];
    if (!application) return cfg;
    application.$ = { ...application.$, 'android:usesCleartextTraffic': 'true' };
    return cfg;
  });
};
