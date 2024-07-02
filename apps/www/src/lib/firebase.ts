import { initializeApp } from "firebase/app";
import { Analytics, getAnalytics } from "firebase/analytics";

let analytics: Analytics;

const firebaseConfig = {
  apiKey: "AIzaSyCqW6WYm0Tra6Kcp2sgeHrLPqPboyCJInY",
  authDomain: "umamin-v2.firebaseapp.com",
  projectId: "umamin-v2",
  storageBucket: "umamin-v2.appspot.com",
  messagingSenderId: "1093852617153",
  appId: "1:1093852617153:web:5547a874c4a61bb9dbb740",
  measurementId: "G-E7V75FEX43",
};

const app = initializeApp(firebaseConfig);

if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
}

export { analytics };
