# BillTap Client

Cross-platform mobile and web application built with Expo (React Native).

## 🚀 Tech Stack

- **Framework**: Expo SDK 54
- **Navigation**: Expo Router (file-based routing)
- **State Management**: Zustand
- **Styling**: React Native Paper + Custom theme system
- **Auth**: Google OAuth + Phone OTP
- **Offline Support**: AsyncStorage with queue-based sync
- **Testing**: Vitest

## 📋 Prerequisites

- Node.js 18+ and pnpm
- [Expo account](https://expo.dev) (free)
- Android Studio (for Android builds)
- Xcode (for iOS builds, macOS only)
- Backend API deployed (see [backend README](../backend/README.md))
- Google Cloud Console project with OAuth credentials

## 🛠️ Local Setup

### 1. Install Dependencies

```bash
cd client
pnpm install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your values:

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `EXPO_PUBLIC_API_BASE_URL` | Backend API base URL | ✅ Yes | `https://your-backend.vercel.app/api` |
| `EXPO_PUBLIC_ENABLE_LIVE_PAYMENTS` | Enable real payment processing | No | `false` (default) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google OAuth Web Client ID | ✅ Yes | `123-abc.apps.googleusercontent.com` |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Google OAuth Android Client ID | For Android | `123-xyz.apps.googleusercontent.com` |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google OAuth iOS Client ID | For iOS | `123-ios.apps.googleusercontent.com` |

### 3. Run Development Server

```bash
# Start Expo dev server
pnpm start

# Run on specific platform
pnpm android    # Android
pnpm ios        # iOS (macOS only)
pnpm web        # Web browser
```

## 🔑 Google OAuth Setup

### Create OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Enable **Google+ API**
4. Go to **APIs & Services → Credentials**
5. Click **Create Credentials → OAuth 2.0 Client ID**

### Web Client ID (Required for all platforms)

1. Application type: **Web application**
2. Authorized JavaScript origins:
   - `http://localhost:3000` (for local dev)
   - `https://your-backend.vercel.app` (your deployed backend)
3. Authorized redirect URIs:
   - `https://your-backend.vercel.app/api/auth/google`
4. Copy **Client ID** → use as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`

### Android Client ID (For Android app)

1. Application type: **Android**
2. Get your SHA-1 fingerprint:
   ```bash
   # For development
   keytool -keystore ~/.android/debug.keystore -list -v -alias androiddebugkey
   # Password: android
   
   # For production (after creating release keystore)
   keytool -keystore path/to/release.keystore -list -v
   ```
3. Enter your package name (from `app.json`: `android.package`)
4. Enter SHA-1 fingerprint
5. Copy **Client ID** → use as `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`

### iOS Client ID (For iOS app)

1. Application type: **iOS**
2. Enter iOS Bundle ID (from `app.json`: `ios.bundleIdentifier`)
3. Copy **Client ID** → use as `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`

## 📱 Build & Deploy

### Web Build

```bash
# Build static web app
pnpm build:web

# Output in: /dist
# Deploy to: Vercel, Netlify, or any static host
```

#### Deploy Web to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Build first
pnpm build:web

# Deploy dist folder
cd dist
vercel
```

### Android Build

#### Development Build

```bash
# Install Expo CLI
npm i -g eas-cli

# Login to Expo
eas login

# Configure EAS Build
eas build:configure

# Build development APK (for testing)
eas build --profile development --platform android
```

#### Production Build

```bash
# Build production APK
eas build --profile production --platform android --local

# OR build AAB for Google Play Store
eas build --profile production --platform android
```

#### Manual Android Build (Alternative)

```bash
# Prebuild native Android project
npx expo prebuild --platform android

# Open in Android Studio
cd android
./gradlew assembleRelease

# APK location: android/app/build/outputs/apk/release/app-release.apk
```

### iOS Build (macOS only)

```bash
# Build development
eas build --profile development --platform ios

# Build for App Store
eas build --profile production --platform ios

# OR build locally
eas build --profile production --platform ios --local
```

## 🧪 Testing & Quality

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Run tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage

# Health check
pnpm doctor
```

## 📡 API Configuration

The app communicates with the backend via REST API. All endpoints are defined in `src/api/`.

### API Services

- **authService.ts** - Authentication (Google, Phone OTP)
- **userService.ts** - User profile management
- **itemService.ts** - Inventory CRUD
- **billService.ts** - Bill/order creation
- **paymentService.ts** - Subscription payments
- **marketingService.ts** - Plans and offers
- **analyticsService.ts** - Event tracking
- **adminService.ts** - Admin operations
- **offlineSyncService.ts** - Queue-based offline sync

### Verify API Connection

```bash
# Test backend health
curl https://your-backend.vercel.app/api/health

# Should return:
# {"ok":true,"service":"billtap-api","now":"..."}
```

## 🌐 Platform-Specific Configuration

### Android (`app.json`)

```json
{
  "expo": {
    "android": {
      "package": "com.yourcompany.billtap",
      "versionCode": 1,
      "permissions": [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ]
    }
  }
}
```

### iOS (`app.json`)

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.yourcompany.billtap",
      "buildNumber": "1",
      "infoPlist": {
        "NSCameraUsageDescription": "Scan barcodes for inventory items",
        "NSPhotoLibraryUsageDescription": "Save and share bills as images"
      }
    }
  }
}
```

## 📚 Project Structure

```
client/
├── app/                    # Expo Router pages
│   ├── (auth)/            # Auth screens (login, signup)
│   ├── (onboarding)/      # Onboarding flow
│   ├── (tabs)/            # Main tabs (home, items, bills, etc.)
│   ├── admin/             # Admin screens
│   └── _layout.tsx        # Root layout
├── src/
│   ├── api/               # API service layer
│   ├── components/        # Reusable components
│   ├── constants/         # App constants
│   ├── hooks/             # Custom React hooks
│   ├── screens/           # Screen components
│   ├── store/             # Zustand stores
│   ├── types/             # TypeScript types
│   └── utils/             # Utility functions
├── assets/                # Images, fonts, etc.
└── .env                   # Environment variables
```

## 🔧 Troubleshooting

### Backend Connection Failed

- Verify `EXPO_PUBLIC_API_BASE_URL` is correct
- Check backend is deployed and accessible
- Test: `curl https://your-backend.vercel.app/api/health`

### Google Sign-In Not Working

- Verify Web Client ID is correct
- Check authorized origins include backend URL
- For Android: Verify SHA-1 fingerprint matches
- For iOS: Verify bundle identifier matches

### Build Errors

```bash
# Clear caches
npx expo start -c

# Reset and reinstall
rm -rf node_modules
pnpm install

# For Android native issues
cd android
./gradlew clean
```

## 📝 Development Commands

- `pnpm start` - Start Expo dev server
- `pnpm android` - Run on Android
- `pnpm ios` - Run on iOS
- `pnpm web` - Run in web browser
- `pnpm lint` - Lint code
- `pnpm typecheck` - Type checking
- `pnpm test` - Run tests
- `pnpm doctor` - Diagnose issues
- `pnpm build:web` - Build web app

## 📚 Additional Documentation

- [SETUP.md](../SETUP.md) - Complete setup guide
- [DEPLOYMENT.md](../DEPLOYMENT.md) - Deployment guide
- [API_REFERENCE.md](../API_REFERENCE.md) - API documentation
- [ENV_VARIABLES.md](../ENV_VARIABLES.md) - Environment variables

## 🎯 Next Steps

1. ✅ Configure environment variables
2. ✅ Set up Google OAuth credentials
3. ✅ Verify backend connection
4. 🔨 Test on development device
5. 🚀 Build for production
6. 📦 Deploy/publish to stores

## 💡 Notes

- **Offline Support**: App caches data locally and syncs when online
- **Payment Demo**: Payments in demo mode unless backend has real provider configured
- **First User = Admin**: First user to sign up gets admin role
- **Expo Updates**: OTA updates enabled for quick fixes without store approval
