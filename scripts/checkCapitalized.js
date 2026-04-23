
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

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

const checkCapitalized = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "DeletionRequests"));
    console.log(`Found ${querySnapshot.size} documents in 'DeletionRequests' (Capitalized):`);
    querySnapshot.forEach((doc) => {
      console.log(doc.id, " => ", JSON.stringify(doc.data(), null, 2));
    });
    process.exit(0);
  } catch (e) {
    console.error("Error listing documents: ", e);
    process.exit(1);
  }
};

checkCapitalized();
