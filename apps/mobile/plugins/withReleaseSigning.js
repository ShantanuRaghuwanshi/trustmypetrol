// Adds a release signingConfig to android/app/build.gradle that reads the
// upload keystore from apps/mobile/credentials/keystore.properties.
// The android/ directory is generated (gitignored) — this plugin makes the
// signing setup survive every `expo prebuild`.
// Falls back to debug signing when no credentials are present (e.g. CI
// builds that only need an installable artifact).
const { withAppBuildGradle } = require("expo/config-plugins");

const LOADER = `
def keystorePropertiesFile = file("../../credentials/keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystorePropertiesFile.withInputStream { keystoreProperties.load(it) }
}
`;

const RELEASE_CONFIG = `        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file("../../credentials/" + keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
`;

function applySigning(gradle) {
  if (gradle.includes("keystore.properties")) return gradle;

  gradle = gradle.replace(/^android \{/m, `${LOADER}\nandroid {`);
  gradle = gradle.replace(
    /(signingConfigs \{\n)/,
    `$1${RELEASE_CONFIG}`
  );
  gradle = gradle.replace(
    /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
    "$1signingConfig(keystorePropertiesFile.exists() ? signingConfigs.release : signingConfigs.debug)"
  );
  return gradle;
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      throw new Error("withReleaseSigning expects a groovy build.gradle");
    }
    config.modResults.contents = applySigning(config.modResults.contents);
    return config;
  });
};
