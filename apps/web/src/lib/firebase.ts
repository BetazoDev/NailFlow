import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDi8FLD8Itnv93f7_AcCRQJZwNUBShx9dI",
  authDomain: "nail-demo-35d0a.firebaseapp.com",
  projectId: "nail-demo-35d0a",
  storageBucket: "nail-demo-35d0a.firebasestorage.app",
  messagingSenderId: "781585885007",
  appId: "1:781585885007:web:166baa36c2a01e2db2073a",
  measurementId: "G-5LRCWZQM3H"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
