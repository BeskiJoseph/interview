
// Firebase configuration
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
// Empty/placeholder values will disable firebase but not crash the app
const firebaseConfig = {
  apiKey: "AIzaSyC3ZgOEv89-C1mtXie7cAdKDarXip9b2Wc",
  authDomain: "interview-app-8dbf3.firebaseapp.com",
  projectId: "interview-app-8dbf3",
  storageBucket: "interview-app-8dbf3.firebasestorage.app",
  messagingSenderId: "1019359434170",
  appId: "1:1019359434170:web:c05ef3d926634d44b17983",
  measurementId: "G-S1H77ZSLHG"
};

// Check if we're using placeholder Firebase config
export const isFirebaseConfigured = firebaseConfig.apiKey !== "AIzaSyDummyKey-ThisIsAPlaceholder";

let app;
let db;
let storage;

try {
  // Initialize Firebase only if we have valid config
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  storage = getStorage(app);
  
  // Log Firebase initialization
  if (storage) {
    console.log("Firebase initialized");
    
    // Log whether we're in development or production
    const isLocalhost = window.location.hostname === "localhost" || 
                         window.location.hostname === "127.0.0.1";
    
    if (isLocalhost) {
      console.log("Running in development mode - CORS issues with Firebase Storage may occur");
      console.log("For production, ensure your Firebase Storage CORS configuration is properly set");
      console.log("CORS Setup: In Firebase console → Storage → Rules, ensure proper CORS configuration");
      console.log("Example rule for development: gsutil cors set cors.json gs://YOUR-BUCKET-NAME");
    }
  }
} catch (error) {
  console.error("Firebase initialization error:", error);
  // Create mock objects to prevent app from crashing
  app = null;
  db = null; 
  storage = null;
}

export { app, db, storage };
