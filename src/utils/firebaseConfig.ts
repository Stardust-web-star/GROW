/**
 * Firebase Configuration for GROW PLN ULP Baguala
 * Direct Cloud Connection for Google AI Studio <-> Vercel Two-Way Realtime Sync
 */

export interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
  storageBucket: string;
  messagingSenderId: string;
  measurementId?: string;
}

export const firebaseConfig: FirebaseAppletConfig = {
  projectId: "gothic-flare-j6shk",
  appId: "1:926653573616:web:dd3bcbabc35f054fa31535",
  apiKey: "AIzaSyCNN-9_XuCvMY1smbYSg6_yAmkHZkZ8gBs",
  authDomain: "gothic-flare-j6shk.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-grow-f1556d5b-af8d-48b4-80a4-0db6695697aa",
  storageBucket: "gothic-flare-j6shk.firebasestorage.app",
  messagingSenderId: "926653573616",
  measurementId: ""
};
