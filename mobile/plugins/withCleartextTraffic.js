let withAndroidManifest;
try {
  withAndroidManifest = require('@expo/config-plugins').withAndroidManifest;
} catch {
  try {
    withAndroidManifest = require('expo/config-plugins').withAndroidManifest;
  } catch {
    withAndroidManifest = null;
  }
}

const allowCleartext = process.env.AURASUTRA_ALLOW_CLEARTEXT !== 'false';

module.exports = function withCleartextTraffic(config) {
  if (!allowCleartext || !withAndroidManifest) return config;

  return withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults?.manifest?.application?.[0];
    if (!application) return cfg;
    application.$ = { ...application.$, 'android:usesCleartextTraffic': 'true' };
    return cfg;
  });
};
