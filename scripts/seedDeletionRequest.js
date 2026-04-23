
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC7fCcIT4XE4BYGQCjlQ7DpToF4J5DpOqk",
  authDomain: "gothai-ffea1.firebaseapp.com",
  projectId: "gothai-ffea1",
  storageBucket: "gothai-ffea1.firebasestorage.app",
  messagingSenderId: "46959975552",
  appId: "1:46959975552:web:5e9c3d90c5ecb4a3dc9a65",
  measurementId: "G-CG6LQ6F68G",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const seedData = async () => {
  try {
    const docRef = await addDoc(collection(db, "deletionRequests"), {
      createdAt: serverTimestamp(),
      email: "the0thinker0s@gmail.com",
      reason: "Service not needed",
      source: "WEB",
      status: "Pending",
      verifiedViaGoogle: true,
      uid: "yrXFPYhPZnFKsMN96vfY",
      method: "GOOGLE_OIDC"
    });
    console.log("Document written with ID: ", docRef.id);
    process.exit(0);
  } catch (e) {
    console.error("Error adding document: ", e);
    process.exit(1);
  }
};

seedData();
