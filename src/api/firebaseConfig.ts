
import { FirebaseApp, initializeApp, getApps, getApp } from 'firebase/app';
import {
    Firestore,
    getFirestore,
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager
} from 'firebase/firestore';
import { Auth, getAuth } from 'firebase/auth';
import { Platform } from 'react-native';

const DUMMY_FIREBASE_CONFIG = {
    apiKey: 'AIzaSyD-EXAMPLE-KEY-FOR-CI-BUILD-000000',
    authDomain: 'dummy-project.firebaseapp.com',
    projectId: 'dummy-project',
    storageBucket: 'dummy-project.appspot.com',
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:0000000000000000000000',
    measurementId: 'G-0000000000',
} as const;

const isPlaceholderValue = (value?: string) => {
    if (!value) return true;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return true;
    return (
        normalized.startsWith('your_') ||
        normalized.includes('your_project_id') ||
        normalized.includes('your_api_key') ||
        normalized.includes('placeholder')
    );
};

const envFirebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const shouldUseDummyFirebaseConfig =
    isPlaceholderValue(envFirebaseConfig.apiKey) ||
    isPlaceholderValue(envFirebaseConfig.authDomain) ||
    isPlaceholderValue(envFirebaseConfig.projectId) ||
    isPlaceholderValue(envFirebaseConfig.appId);

const firebaseConfig = shouldUseDummyFirebaseConfig
    ? DUMMY_FIREBASE_CONFIG
    : {
        apiKey: envFirebaseConfig.apiKey!,
        authDomain: envFirebaseConfig.authDomain!,
        projectId: envFirebaseConfig.projectId!,
        storageBucket: envFirebaseConfig.storageBucket!,
        messagingSenderId: envFirebaseConfig.messagingSenderId!,
        appId: envFirebaseConfig.appId!,
        measurementId: envFirebaseConfig.measurementId,
    };

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (!getApps().length) {
    app = initializeApp(firebaseConfig);

    // Initialize Auth
    auth = getAuth(app);

    // Initialize Firestore
    const isWebBrowser = Platform.OS === 'web' && typeof window !== 'undefined';
    if (isWebBrowser) {
        db = initializeFirestore(app, {
            localCache: persistentLocalCache({
                tabManager: persistentMultipleTabManager()
            })
        });
    } else {
        db = getFirestore(app);
    }

} else {
    app = getApp();
    auth = getAuth(app);
    db = getFirestore(app);
}

export { auth, db, app };
