import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, off, get, set, update, push, remove, query, orderByChild, equalTo, child } from 'firebase/database';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://primerdb2-default-rtdb.firebaseio.com",
  projectId: "primerdb2",
  storageBucket: "primerdb2.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export { ref, onValue, off, get, set, update, push, remove, query, orderByChild, equalTo, child };