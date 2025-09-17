// Firebase configuration
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import { getDatabase, Database } from 'firebase/database';

// Check if required environment variables are present
const requiredEnvVars = [
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_AUTH_DOMAIN',
  'REACT_APP_FIREBASE_PROJECT_ID'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required Firebase environment variables:', missingEnvVars);
  console.error('Please create a .env file with your Firebase configuration.');
  console.error('See .env.example for the required variables.');
}

export const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "",
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL || "",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "",
};

// Debug: Log the database URL to verify it's correct
console.log('🔍 Firebase Database URL from env:', process.env.REACT_APP_FIREBASE_DATABASE_URL);
console.log('🔍 Firebase Config Database URL:', firebaseConfig.databaseURL);

// Initialize Firebase only if we have the required config
let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let database: Database | undefined;
let googleProvider: GoogleAuthProvider | undefined;

try {
  if (firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    database = getDatabase(app);
    googleProvider = new GoogleAuthProvider();
    console.log('✅ Firebase initialized successfully');
  } else {
    console.error('❌ Firebase configuration incomplete. Please check your .env file.');
  }
} catch (error) {
  console.error('❌ Error initializing Firebase:', error);
}

export { auth, database, googleProvider };
export default app;