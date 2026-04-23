import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// 从环境变量读取配置，这样其他人 clone 代码后需要填入他们自己的 Firebase 配置
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC9nunFQTi7vfX5ntmMW3S9yfLD52DRvEI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "magic-music-db.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "magic-music-db",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "magic-music-db.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "818527585074",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:818527585074:web:aa74dd8dc81571512e8d2b"
};

// 初始化 Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
