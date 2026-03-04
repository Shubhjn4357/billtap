// app.config.js

// Grab the GitHub Run Number from the environment variables we set in the YAML.
// If it doesn't exist (like when you run `npx expo start` locally), it defaults to 1.
const ciBuildNumber = process.env.GITHUB_RUN_NUMBER ? parseInt(process.env.GITHUB_RUN_NUMBER) : 1;

export default {
  expo: {
    name: "vahi",
    slug: "vahi",
    version: "4.1.0", // This is your public version (what users see)
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "vahi",
    userInterfaceStyle: "automatic",
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.blockbucket.vahi",
      icon: "./assets/images/adaptive-icon.png",
      googleServicesFile: "./GoogleService-Info.plist",
      // Apple expects buildNumber as a string
      buildNumber: ciBuildNumber.toString() 
    },
    android: {
      package: "com.blockbucket.vahi",
      googleServicesFile: "./google-services.json",
      // Android expects versionCode as an integer
      versionCode: ciBuildNumber, 
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      predictiveBackGestureEnabled: false,
      permissions: [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO"
      ]
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          backgroundColor: "#208AEF",
          android: {
            image: "./assets/images/splash-icon.png",
            resizeMode: "contain",
            backgroundColor: "#ffffff",
            radius: 8,
            borderless: true
          },
          ios: {
            image: "./assets/images/splash-icon.png",
            resizeMode: "contain",
            backgroundColor: "#ffffff",
            radius: 8,
            borderless: true
          }
        }
      ],
      "expo-secure-store",
      [
        "expo-camera",
        {
          cameraPermission: "Allow Vahi to access your camera for barcode and QR scanning."
        }
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/images/icon.png",
          color: "#007B83"
        }
      ],
      [
        "expo-sqlite",
        {
          enableFTS: true
        }
      ],
      [
        "@react-native-google-signin/google-signin",
        {
          iosUrlScheme: "com.googleusercontent.apps.762596815663-nhqic0h9egjmn0isugid7acuddpv1afu"
        }
      ],
      "expo-sharing",
      [
        "expo-dev-client",
        {
          launchMode: "most-recent"
        }
      ]
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true
    },
    extra: {
      router: {},
      eas: {
        projectId: "8d9f7993-9f06-4416-99c7-a6c67854721c"
      }
    },
    owner: "blockbucket"
  }
};