# Play Store release guide

## What's already set up

- **App identity** — package `in.trustmypetrol.app`, version `1.0.0`, `versionCode 1`
  in [app.json](../apps/mobile/app.json). Bump **both** for every store upload
  (`versionCode` must strictly increase).
- **Icons & splash** — generated in [apps/mobile/assets/](../apps/mobile/assets/)
  (launcher icon, adaptive icon + Android 13 monochrome/themed icon, splash).
  Play-listing artwork (512 icon, 1024×500 feature graphic) is in
  [apps/mobile/store-assets/](../apps/mobile/store-assets/).
- **Permissions** — only `CAMERA` and `ACCESS_FINE_LOCATION` (+ coarse, implied).
  `RECORD_AUDIO` (pulled in by expo-camera) is explicitly blocked so the Data
  safety form stays simple.
- **Release signing** — an upload keystore lives in `apps/mobile/credentials/`
  (gitignored). The config plugin
  [plugins/withReleaseSigning.js](../apps/mobile/plugins/withReleaseSigning.js)
  wires it into every `expo prebuild`, so the generated `android/` dir stays
  disposable.

  > ⚠️ **Back up `apps/mobile/credentials/` now** (password manager / encrypted
  > drive). With Play App Signing Google can reset a lost *upload* key, but it's
  > a support process you don't want.

## Building the release bundle

```bash
cd apps/mobile
npx expo prebuild -p android --no-install   # regenerates android/ from app.json
cd android
JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew :app:bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```

Supabase config is baked in at build time from `apps/mobile/.env`
(`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) — make sure it
points at the **production** project before building.

EAS Build is also configured ([eas.json](../apps/mobile/eas.json)) if you'd
rather build in the cloud: `npx eas build -p android --profile production`.

## 🚧 Blockers to clear before submitting

1. **Google Maps API key** — `react-native-maps` on Android renders a blank
   map without one.
   - Google Cloud console → enable *Maps SDK for Android* → create API key.
   - Restrict it to Android apps: package `in.trustmypetrol.app` + the SHA-1s
     of (a) the upload key — `keytool -list -v -keystore
     apps/mobile/credentials/upload-keystore.jks -alias upload` — and (b) the
     **Play App Signing** key (Play Console → Setup → App signing, available
     after first upload).
   - Put `GOOGLE_MAPS_API_KEY=...` in `apps/mobile/.env`, then re-run prebuild
     + the gradle build (the key is injected into AndroidManifest by
     [app.config.js](../apps/mobile/app.config.js)).
2. **Privacy policy URL** — mandatory (camera + precise location + accounts).
   Host it on the web app (e.g. `trustmypetrol.in/privacy`).
3. **Account deletion URL** — Play requires a web link where users can request
   account + data deletion, since the app supports sign-in. Add a simple page
   to the Next.js app.
4. **Replace seed pump data** — pump names/dealer codes are fictional
   placeholders; swap in real OMC locator data before public release
   (defamation risk otherwise).
5. **Screenshots** — at least 2 phone screenshots (16:9 or 9:16, 320–3840 px).
   Capture from a device/emulator once the map key works.

## Play Console walkthrough (first release)

1. [play.google.com/console](https://play.google.com/console) — one-time $25
   developer registration (personal accounts need identity verification and,
   for new accounts, a 12-tester/14-day closed test before production access).
2. **Create app** → name *TrustMyPetrol*, default language English (India),
   App, Free.
3. **App content** (all required):
   - Privacy policy URL (blocker #2)
   - Data safety form — declare: *Location (precise)* — collected, required,
     app functionality; *Photos* — collected, app functionality (report
     evidence); *Email / phone number* — collected, account management. All
     encrypted in transit; deletion via blocker #3's URL.
   - Ads: none. Content rating questionnaire: utility app → Everyone.
   - Target audience: 18+ (drivers), not child-directed.
   - Government app: no. Financial features: none.
4. **Store listing** — short + full description, icon and feature graphic from
   `apps/mobile/store-assets/`, screenshots (blocker #5).
5. **Release** → *Internal testing* first: upload `app-release.aab`, add your
   own email as tester, install via the opt-in link and smoke-test
   (auth → map → report flow, camera + location grants).
6. Promote the same build Internal → Closed → Production once it checks out.

## Every subsequent release

1. Bump `version` + `android.versionCode` in `app.json`.
2. Rebuild the `.aab` (section above) and upload to a testing track.
3. Keep release notes; promote when stable.
