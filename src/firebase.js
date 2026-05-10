// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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