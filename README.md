# Password Manager — Mobile

A lightweight Android password manager built with Ionic Angular + Capacitor. All passwords are encrypted with a master password — nothing is stored in plaintext.

## Download

**[PasswordManager_1.0.0.apk](https://github.com/talhacoban48/PasswordManager.MobileApp/releases/download/v1.0.0/PasswordManager_1.0.0.apk)**

---

## Features

- **Master password authentication** — PBKDF2-HMAC-SHA256 key derivation (480k iterations), canary-based verification (master password is never stored)
- **AES-256-GCM encryption** — every password in the database is encrypted at rest via Web Crypto API
- **Dark UI** — Ionic dark theme, mobile-first layout
- **Live search** — 300 ms debounced, case-insensitive search on app/site name
- **Import / Export** — CSV and Excel (`.xlsx`) support with merge logic (last-write-wins on `updatedDate`)
- **Password generator** — one-click random password generation
- **Active / Passive entries** — toggle visibility of deactivated records
- **Change master password** — re-encrypts the entire database with the new key
- **Lock button** — instantly lock the app and return to the login screen
- **Android back button** — exit confirmation on hardware back press

---

## Data storage

All data is stored in the app's private storage (no SD card, no cloud):

| Store | Contents |
|---|---|
| SQLite (`pwapp.db`) | Encrypted password entries |
| `localStorage` | Salt and canary used to verify the master password |

---

## Building a release APK

### Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | 18+ | Angular / npm |
| Angular CLI | 17+ | Build |
| Capacitor CLI | 8+ | Android sync |
| Android Studio | Latest | Gradle build + signing |
| Java JDK | 17+ | Required by Gradle |

### Steps

**1. Install dependencies**

```bash
npm install
```

**2. Build the web app**

```bash
npx ng build --configuration=production
```

**3. Sync to Android**

```bash
npx cap sync android
```

**4. Create a keystore (first time only)**

```bash
keytool -genkey -v -keystore release.keystore -alias pwapp -keyalg RSA -keysize 2048 -validity 10000
```

Keep `release.keystore` safe — you will need it for every future release. If you lose it, you cannot update the app on the same package ID.

**5. Build a signed release APK in Android Studio**

- Open the `android/` folder in Android Studio
- **Build → Generate Signed Bundle / APK**
- Choose **APK**
- Select your `release.keystore`, enter the alias and passwords
- Choose **release** build variant
- Click **Finish**

Output: `android/app/release/app-release.apk`

**Alternatively, build via command line:**

```bash
cd android
./gradlew assembleRelease
```

Then sign manually:

```bash
zipalign -v 4 app/build/outputs/apk/release/app-release-unsigned.apk PasswordManager_1.0.0.apk

apksigner sign --ks release.keystore --ks-key-alias pwapp --out PasswordManager_1.0.0.apk PasswordManager_1.0.0.apk
```

---

## Running in browser (development)

```bash
npm start
```

Opens at `http://localhost:4200`. SQLite runs via WASM (`sql.js`) in the browser — full functionality available for testing.

---

## Project structure

```
src/app/
├── models/
│   └── entry.model.ts          # Entry, EntryListItem interfaces
├── services/
│   ├── auth.service.ts         # Master password setup & login
│   ├── crypto.service.ts       # PBKDF2 key derivation, AES-GCM encrypt/decrypt
│   ├── database.service.ts     # SQLite CRUD + import/export
│   └── password-gen.service.ts # Random password generator
├── guards/
│   └── auth.guard.ts           # Route protection (redirects to login if not authenticated)
├── login/                      # Login + first-time setup screen
├── home/                       # Password list + search
├── entry-detail/               # Add / edit entry form
└── settings/                   # Change master password, import, export
```

---

## License

MIT
