import { initializeApp } from 'firebase/app';
import { Analytics, getAnalytics } from 'firebase/analytics';

// eslint-disable-next-line import/no-mutable-exports
let analytics: Analytics;

const app = initializeApp({
  apiKey: 'AIzaSyCFDyEq6l8Zd-WlC6ZzHCUC8Slnxe_SXfY',
  authDomain: 'umamin-app.firebaseapp.com',
  projectId: 'umamin-app',
  storageBucket: 'umamin-app.appspot.com',
  messagingSenderId: '496522144815',
  appId: '1:496522144815:web:d094c6e28f7b1f9a8e2ada',
  measurementId: 'G-2DE4XWGBJP',
});

if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

export { analytics };
