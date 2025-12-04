// import { doc, updateDoc } from "firebase/firestore";
// import { db } from "./firebase/firebase.config.js";

// async function pushCustomerSupportData() {
//   const userId = "o4uJGTsYupdCTnwNRMhsUBBmLMr2";
//   const documentPath = "chatRooms/CustomerSupport";
//   const fieldKey = `${userId}_CustomerSupport`;

//   const demoData = {
//     date: new Date().toISOString(),
//     isRead: false,
//     audioUrl: false,
//     imgUrl: false,
//     lastMessage: {
//       text: "Hello, how can I help you?",
//     },
//     userInfo: {
//       displayName: "Customer Support",
//       phoneNumber: "01725790334",
//       photoURL: "https://example.com/photo.jpg",
//     },
//     uid: userId,
//   };

//   try {
//     // Use updateDoc to set demoData as a map within the specified field key
//     await updateDoc(doc(db, documentPath), {
//       [fieldKey]: demoData,
//     });
//     console.log("Customer support data added as a map successfully");
//   } catch (error) {
//     console.error("Error adding data:", error);
//   }
// }

// pushCustomerSupportData();

import { doc, setDoc, arrayUnion } from "firebase/firestore";
import { db } from "./firebase/firebase.config.js";
import { v4 as uuidv4 } from "uuid"; // Import for generating unique message IDs

async function pushMessageToCustomerSupportChat() {
  const userId = "o4uJGTsYupdCTnwNRMhsUBBmLMr2";
  const chatPath = `chats/${userId}_CustomerSupport`;

  // Sample message data to be added to the messages array
  const messageData = {
    date: new Date(), // Current timestamp
    id: uuidv4(), // Unique ID for the message
    imageUrl: "", // Placeholder for image URL if required
    senderId: userId, // ID of the message sender
    text: "Hi, how can I assist you?", // Sample message text
  };

  try {
    // Initialize the document if it doesn't exist and add the message to the messages array
    await setDoc(doc(db, chatPath), { messages: arrayUnion(messageData) }, { merge: true });
    console.log("Message added to Customer Support chat successfully");
  } catch (error) {
    console.error("Error adding message:", error);
  }
}

pushMessageToCustomerSupportChat();
