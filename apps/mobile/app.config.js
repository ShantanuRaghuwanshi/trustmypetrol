// Extends app.json with values that must come from the environment.
// GOOGLE_MAPS_API_KEY is a build-time secret (goes into AndroidManifest.xml
// via prebuild) — set it in apps/mobile/.env or the shell before building.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    config: {
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
      },
    },
  },
});
