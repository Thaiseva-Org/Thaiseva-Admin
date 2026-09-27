// import InsertPhotoIcon from "@mui/icons-material/InsertPhoto";
// import { useContext, useEffect } from "react";
// import { useState } from "react";
// import { v4 as uuid } from "uuid";
// import {
//   Timestamp,
//   arrayUnion,
//   doc,
//   serverTimestamp,
//   updateDoc,
// } from "firebase/firestore";

// import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
// import { AdminChatContext } from "../../../contextAPIs/AdminChatProvider";
// import {
//   chatRoomsCollection,
//   chatsCollection,
//   storage,
// } from "../../../firebase/firebase.config";
// import { PartnerContext } from "../../../contextAPIs/PartnerProvider";

// const Input = ({ lastMessage, audioUrl, setAudioUrl }) => {
//   const [text, setText] = useState("");
//   const [loading, setLoading] = useState(false);
//   const { chatRoom } = useContext(PartnerContext);
//   const { data } = useContext(AdminChatContext);

//   useEffect(() => {
//     const sendAudio = async () => {
//       const audioMessage = {
//         id: uuid(),
//         audioUrl,
//         text: "",
//         senderId: "_CustomerSupport",
//         date: Timestamp.now(),
//       };

//       if (lastMessage?.serviceType) {
//         audioMessage.serviceType = lastMessage?.serviceType;
//       }

//       await updateDoc(doc(chatsCollection, data.chatId), {
//         messages: arrayUnion(audioMessage),
//       });
//       setAudioUrl("");
//     };

//     audioUrl && sendAudio();
//   }, [audioUrl]);

//   useEffect(() => {
//     const updateIsRead = async () => {
//       // console.log(!data.chatId.startsWith("undefined"));
//       if (data.chatId.length > 40) {
//         await updateDoc(doc(chatRoomsCollection, chatRoom), {
//           [data.chatId + ".isRead"]: true,
//         });
//       }
//     };

//     data.chatId.length > 40 && updateIsRead();
//   }, [data, chatRoom, lastMessage]);

//   const handleSend = async () => {
//     const newMessage = {
//       id: uuid(),
//       text,
//       senderId: "_CustomerSupport",
//       date: Timestamp.now(),
//       imageUrl: "",
//     };

//     if (lastMessage?.serviceType) {
//       newMessage.serviceType = lastMessage?.serviceType;
//     }

//     if (text.length > 0) {
//       await updateDoc(doc(chatsCollection, data.chatId), {
//         messages: arrayUnion(newMessage),
//       });
//     }

//     await updateDoc(doc(chatRoomsCollection, chatRoom), {
//       [data.chatId + ".lastMessage"]: {
//         text,
//       },
//       [data.chatId + ".audioUrl"]: false,
//       [data.chatId + ".imgUrl"]: false,
//       [data.chatId + ".date"]: serverTimestamp(),
//     });

//     setText("");
//   };

//   const handleSendImage = async (img) => {
//     if (img) {
//       setLoading(true);
//       const storageRef = ref(storage, uuid());
//       const uploadTask = await uploadBytesResumable(storageRef, img);

//       const imgURL = await getDownloadURL(uploadTask.ref);
//       if (imgURL) {
//         await updateDoc(doc(chatsCollection, data.chatId), {
//           messages: arrayUnion({
//             id: uuid(),
//             text: "",
//             senderId: "_CustomerSupport",
//             date: Timestamp.now(),
//             imageUrl: imgURL,
//           }),
//         }).then(() => setLoading(false));
//       }
//     }
//   };

//   const handleSendFile = async (file) => {
//     if (file) {
//       setLoading(true);
//       try {
//         const fileExtension = file.name.split(".").pop();
//         const fileType = file.type || getMimeType(fileExtension); // Fallback if file.type is missing

//         const storageRef = ref(storage, `uploads/${uuid()}.${fileExtension}`);
//         const uploadTask = await uploadBytesResumable(storageRef, file, {
//           contentType: fileType, // Ensure correct MIME type
//         });

//         const fileURL = await getDownloadURL(uploadTask.ref);
//         if (fileURL) {
//           await updateDoc(doc(chatsCollection, data.chatId), {
//             messages: arrayUnion({
//               id: uuid(),
//               text: "",
//               senderId: "_CustomerSupport",
//               date: Timestamp.now(),
//               fileUrl: fileURL,
//               fileType,
//               fileName: file.name,
//             }),
//           });
//         }
//       } catch (error) {
//         console.error("File upload error:", error);
//       } finally {
//         setLoading(false);
//       }
//     }
//   };

//   const getMimeType = (extension) => {
//     const mimeTypes = {
//       pdf: "application/pdf",
//       doc: "application/msword",
//       docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
//       xls: "application/vnd.ms-excel",
//       xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
//       jpg: "image/jpeg",
//       jpeg: "image/jpeg",
//       png: "image/png",
//     };
//     return mimeTypes[extension] || "application/octet-stream";
//   };

//   return (
//     <div className="h-12 bg-white p-3 flex items-center justify-between ">
//       <input
//         type="text"
//         placeholder="Type something..."
//         className="w-full border-none outline-none text-[#2f2d52] font-medium text-lg placeholder-[lightgray] px-2 bg-transparent"
//         value={text}
//         onChange={(e) => setText(e.target.value)}
//         onKeyDown={(e) => {
//           if (e.key === "Enter") {
//             handleSend();
//           }
//         }}
//       />
//       <div className="flex gap-2 items-center">
//         {loading && (
//           <span className="text-[var(--chat-btn-color)] text-xs block">
//             Sending file...
//           </span>
//         )}
//         <input
//           type="file"
//           name=""
//           id="img"
//           className="hidden"
//           onChange={(e) => handleSendFile(e.target.files[0])}
//         />
//         <label htmlFor="img">
//           <InsertPhotoIcon />
//         </label>
//         <button
//           className="text-white bg-[var(--button-bg-color)] hover:bg-[var(--button-hover-bg-color)] py-1 px-2 rounded"
//           onClick={handleSend}
//         >
//           Send
//         </button>
//       </div>
//     </div>
//   );
// };

// export default Input;
import { InsertPhotoIcon } from "@icons";
import { useContext, useEffect } from "react";
import { useState } from "react";
import { v4 as uuid } from "uuid";
import {
  Timestamp,
  arrayUnion,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { AdminChatContext } from "../../../contextAPIs/AdminChatProvider";
import {
  chatRoomsCollection,
  chatsCollection,
  storage,
} from "../../../firebase/firebase.config";
import { PartnerContext } from "../../../contextAPIs/PartnerProvider";

const Input = ({ lastMessage, audioUrl, setAudioUrl }) => {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const { chatRoom } = useContext(PartnerContext);
  const { data } = useContext(AdminChatContext);

  useEffect(() => {
    const sendAudio = async () => {
      const audioMessage = {
        id: uuid(),
        audioUrl,
        text: "",
        senderId: "_CustomerSupport",
        date: Timestamp.now(),
        isRead: false, // 👈 added
      };

      if (lastMessage?.serviceType) {
        audioMessage.serviceType = lastMessage?.serviceType;
      }

      await updateDoc(doc(chatsCollection, data.chatId), {
        messages: arrayUnion(audioMessage),
      });
      setAudioUrl("");
    };

    audioUrl && sendAudio();
  }, [audioUrl]);

  useEffect(() => {
    const updateIsRead = async () => {
      if (data.chatId.length > 40) {
        await updateDoc(doc(chatRoomsCollection, chatRoom), {
          [data.chatId + ".isRead"]: true,
        });
      }
    };

    data.chatId.length > 40 && updateIsRead();
  }, [data, chatRoom, lastMessage]);

  const handleSend = async () => {
    const newMessage = {
      id: uuid(),
      text,
      senderId: "_CustomerSupport",
      date: Timestamp.now(),
      imageUrl: "",
      isRead: false, // 👈 added
    };

    if (lastMessage?.serviceType) {
      newMessage.serviceType = lastMessage?.serviceType;
    }

    if (text.length > 0) {
      await updateDoc(doc(chatsCollection, data.chatId), {
        messages: arrayUnion(newMessage),
      });
    }

    await updateDoc(doc(chatRoomsCollection, chatRoom), {
      [data.chatId + ".lastMessage"]: {
        text,
      },
      [data.chatId + ".audioUrl"]: false,
      [data.chatId + ".imgUrl"]: false,
      [data.chatId + ".date"]: serverTimestamp(),
    });

    setText("");
  };

  const handleSendImage = async (img) => {
    if (img) {
      setLoading(true);
      const storageRef = ref(storage, uuid());
      const uploadTask = await uploadBytesResumable(storageRef, img);

      const imgURL = await getDownloadURL(uploadTask.ref);
      if (imgURL) {
        await updateDoc(doc(chatsCollection, data.chatId), {
          messages: arrayUnion({
            id: uuid(),
            text: "",
            senderId: "_CustomerSupport",
            date: Timestamp.now(),
            imageUrl: imgURL,
            isRead: false, // 👈 added
          }),
        }).then(() => setLoading(false));
      }
    }
  };

  const handleSendFile = async (file) => {
    if (file) {
      setLoading(true);
      try {
        const fileExtension = file.name.split(".").pop();
        const fileType = file.type || getMimeType(fileExtension);

        const storageRef = ref(storage, `uploads/${uuid()}.${fileExtension}`);
        const uploadTask = await uploadBytesResumable(storageRef, file, {
          contentType: fileType,
        });

        const fileURL = await getDownloadURL(uploadTask.ref);
        if (fileURL) {
          await updateDoc(doc(chatsCollection, data.chatId), {
            messages: arrayUnion({
              id: uuid(),
              text: "",
              senderId: "_CustomerSupport",
              date: Timestamp.now(),
              fileUrl: fileURL,
              fileType,
              fileName: file.name,
              isRead: false, // 👈 added
            }),
          });
        }
      } catch (error) {
        console.error("File upload error:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  const getMimeType = (extension) => {
    const mimeTypes = {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
    };
    return mimeTypes[extension] || "application/octet-stream";
  };

  return (
    <div className="bg-white border-t border-neutral-200 p-4">
      <div className="flex items-center gap-3">
        {/* File Upload Button */}
        <div className="relative group">
          <input
            type="file"
            id="img"
            className="hidden"
            onChange={(e) => handleSendFile(e.target.files[0])}
          />
          <label
            htmlFor="img"
            className="flex items-center justify-center w-11 h-11 rounded-xl bg-neutral-100 hover:bg-primary-50 
                     text-neutral-600 hover:text-primary-600 cursor-pointer transition-all duration-200 
                     hover:scale-105 active:scale-95"
          >
            <InsertPhotoIcon />
          </label>
        </div>

        {/* Text Input */}
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Type a message..."
            className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none 
                     focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-200 
                     transition-all duration-200 text-neutral-800 placeholder-neutral-400"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSend();
              }
            }}
          />
          {loading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-600 text-xs font-medium">
              Sending...
            </span>
          )}
        </div>

        {/* Send Button */}
        <button
          className="flex items-center justify-center px-6 h-11 bg-gradient-to-r from-primary-500 to-primary-600 
                   hover:from-primary-600 hover:to-primary-700 text-white font-semibold rounded-xl 
                   shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95
                   disabled:from-neutral-300 disabled:to-neutral-400 disabled:cursor-not-allowed 
                   disabled:hover:scale-100"
          onClick={handleSend}
          disabled={!text.trim() || loading}
        >
          <span className="hidden sm:inline">Send</span>
          <span className="sm:hidden">📤</span>
        </button>
      </div>
    </div>
  );
};

export default Input;
