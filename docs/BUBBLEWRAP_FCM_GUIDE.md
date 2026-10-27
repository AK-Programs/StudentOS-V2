# Bubblewrap TWA & Firebase Cloud Messaging (FCM) Integration Guide

This guide details how Firebase Cloud Messaging (FCM) is integrated into the StudentOS Android Trusted Web Activity (TWA) application generated using Bubblewrap CLI or Android Studio.

---

## 1. Bubblewrap Configuration (`twa-manifest.json`)

The `twa-manifest.json` file in the project root is configured with notification features and the Firebase GCM Sender ID (`940502459076`):

```json
{
  "packageId": "org.studentos.pwa",
  "host": "studentos.app",
  "name": "StudentOS Suite",
  "shortName": "StudentOS",
  "themeColor": "#0F172A",
  "navigationColor": "#0F172A",
  "backgroundColor": "#0F172A",
  "enableNotifications": true,
  "gcmSenderId": "940502459076",
  "startUrl": "/",
  "iconUrl": "https://studentos.app/icons/icon-512.png",
  "maskableIconUrl": "https://studentos.app/icons/icon-512.png",
  "appVersion": "3.15.0",
  "appVersionCode": 31500,
  "generatorApp": "bubblewrap-cli",
  "webManifestUrl": "https://studentos.app/manifest.json",
  "fallbackType": "customtabs",
  "features": {
    "locationDelegation": {
      "enabled": true
    }
  },
  "alphaDependencies": {
    "enabled": true
  }
}
```

---

## 2. Android Native Setup (`google-services.json`)

When compiling the native APK/AAB from Bubblewrap or Android Studio:

1. Download `google-services.json` from the Firebase Console (`gen-lang-client-0785563242`).
2. Place `google-services.json` inside the `app/` directory of the generated Android project.
3. In `app/build.gradle`, include:
   ```groovy
   apply plugin: 'com.google.gms.google-services'

   dependencies {
       implementation 'com.google.firebase:firebase-messaging:23.4.0'
   }
   ```

---

## 3. Web App Notification Architecture

1. **Permission Request**: `requestFCMPermission()` runs on app start in `App.tsx`.
2. **Token Storage**: FCM tokens are saved directly to Firestore collection `fcmTokens` (`/fcmTokens/{tokenId}`).
3. **Cloud Function**: `sendPush` in `functions/index.js` fetches all tokens from `fcmTokens` and dispatches multicast push notifications.
4. **Closed App Push Delivery**: `/sw.js` and `/firebase-messaging-sw.js` handle background push events (`self.addEventListener('push')`) and display native system tray notifications (`self.registration.showNotification`) even when the app is completely closed.
