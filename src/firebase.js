import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase } from "firebase/database"; 

const firebaseConfig = {
  apiKey: "AIzaSyBWj6fLHxgmNdXAGP3FEEa5Vjh3ievjk8o",
  authDomain: "primerdb2.firebaseapp.com",
  databaseURL: "https://primerdb2-default-rtdb.firebaseio.com",
  projectId: "primerdb2",
  storageBucket: "primerdb2.firebasestorage.app",
  messagingSenderId: "1055563458097",
  appId: "1:1055563458097:web:6756f9fb6c618597415710",
  measurementId: "G-9VY6B5JB1P"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// 2. Initialize and Export the Database
export const db = getDatabase(app);

// 3. Re-export 'ref' so your components can find it here
export { 
  ref, 
  set, 
  onValue, 
  push, 
  off, 
  get, 
  update, 
  remove, 
  query, 
  orderByChild, 
  orderByKey, 
  orderByValue, 
  limitToFirst, 
  limitToLast, 
  startAt, 
  endAt, 
  equalTo 
} from "firebase/database";