# Tiled Android APK

A thin Android WebView shell that ships the Tiled site inside the APK.
The website itself is unchanged — the GitHub Actions workflow copies the
existing HTML/JSX/CSS/icons into `app/src/main/assets/site/` before
building, and `MainActivity` loads `file:///android_asset/site/Tiled.html`.

## Downloading

Every push to a build branch produces a fresh APK. Grab it from either:

- **Rolling release** (stable link) — <https://github.com/amosley0221/Tiled/releases/tag/android-latest>
- **Workflow artifact** — Actions → *Android APK* → latest run → *Tiled-APK*.

Open the `.apk` on your Android phone and confirm the "install from
unknown source" prompt. The APK is signed with the Android debug key so
it will install without extra configuration; treat it as a preview build.

## What runs offline vs. online

The HTML, JSX, CSS, icons, and service-worker file are bundled — the
site loads with no network. Everything else still uses the network:

- Supabase auth, storage, and realtime.
- React / ReactDOM / Babel Standalone / Supabase JS from the CDN
  (`unpkg.com`, `jsdelivr.net`). If you want a fully-offline app,
  vendor those scripts into the repo and reference them relatively.
- Google Fonts.
- Web Push subscription — the service worker cannot register under
  `file://`, so push notifications inside the APK are disabled. The
  hosted PWA continues to receive push as before.

## Local build

```sh
cd android
# Copy the site into the assets folder the way CI does:
mkdir -p app/src/main/assets/site
cp ../*.{html,jsx,css,js,webmanifest,svg,png,ico} app/src/main/assets/site/
# Build (Gradle will download the wrapper it needs):
gradle :app:assembleRelease
# APK lands at:
ls app/build/outputs/apk/release/*.apk
```

Requires JDK 17 and the Android SDK (`ANDROID_SDK_ROOT`).
