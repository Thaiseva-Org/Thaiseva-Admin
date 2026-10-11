import { getAuth } from "firebase/auth";
import { InsertPhotoIcon } from "@icons";
import { useContext, useEffect } from "react";
import { useState } from "react";
import { v4 as uuid } from "uuid";
import {
  Timestamp,
  arrayUnion,
  doc,
  setDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { AuthContext } from "../../../../contextAPIs/AuthProvider";
import { PartnerChatContext } from "../../../../contextAPIs/PartnerChatProvider";
import {
  chatRoomsCollection,
  chatsCollection,
  storage,
} from "../../../../firebase/firebase.config";

const PartnerChatInput = ({ audioUrl, setAudioUrl }) => {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, userData } = useContext(AuthContext);
  const { data } = useContext(PartnerChatContext);
  let chatRoom = "";

  if (data) {
    chatRoom = data?.oppositeUser?.uid?.split("_")[1];
  }
  useEffect(() => {
    const sendAudio = async () => {
      const audioMessage = {
        id: uuid(),
        audioUrl,
        text: "",
        senderId: user.uid,
        date: Timestamp.now(),
        isRead: false,
      };

      await updateDoc(doc(chatsCollection, data.chatId), {
        messages: arrayUnion(audioMessage),
      }).then(async () => {
        setAudioUrl("");
        await updateDoc(doc(chatRoomsCollection, chatRoom), {
          [data.chatId + ".lastMessage"]: "",
          [data.chatId + ".audioUrl"]: true,
          [data.chatId + ".imgUrl"]: false,
          [data.chatId + ".isRead"]: false,
          [data.chatId + ".userInfo"]: {
            displayName: userData?.displayName,
            phoneNumber: userData?.phoneNo,
            photoURL: userData?.photoURL,
            uid: userData?.uid,
          },
          [data.chatId + ".date"]: serverTimestamp(),
        });
      });
    };

    audioUrl && sendAudio();
  }, [audioUrl]);

  const handleSend = async () => {
    let newMessage = {
      id: uuid(),
      text,
      senderId: user.uid,
      date: Timestamp.now(),
      imageUrl: "",
      isRead: false,
    };

    if (text.length > 0) {
      await setDoc(
        doc(chatsCollection, data.chatId),
        {
          messages: arrayUnion(newMessage),
        },
        { merge: true }
      );
    }

    // adding the last message to the thaiseva admin conversation
    await updateDoc(doc(chatRoomsCollection, chatRoom), {
      [data.chatId + ".lastMessage"]: {
        text: text,
      },
      [data.chatId + ".imgUrl"]: false,
      [data.chatId + ".audioUrl"]: false,
      [data.chatId + ".isRead"]: false,
      [data.chatId + ".userInfo"]: {
        displayName: userData?.displayName,
        phoneNumber: userData?.phoneNo || "",
        photoURL: userData?.photoURL,
        uid: userData?.uid,
      },
      [data.chatId + ".date"]: serverTimestamp(),
    });

    setText("");
  };

  // const handleSendImage = async (img) => {
  //   if (img) {
  //     setLoading(true);
  //     const storageRef = ref(storage, uuid());
  //     const uploadTask = await uploadBytesResumable(storageRef, img);

  //     const imgURL = await getDownloadURL(uploadTask.ref);
  //     if (imgURL) {
  //       await updateDoc(doc(chatsCollection, data.chatId), {
  //         messages: arrayUnion({
  //           id: uuid(),
  //           text: "",
  //           senderId: user.uid,
  //           date: Timestamp.now(),
  //           imageUrl: imgURL,
  //         }),
  //       }).then(async () => {
  //         setLoading(false);
  //         await updateDoc(doc(chatRoomsCollection, chatRoom), {
  //           [data.chatId + ".lastMessage"]: "",
  //           [data.chatId + ".imgUrl"]: true,
  //           [data.chatId + ".audioUrl"]: false,
  //           [data.chatId + ".isRead"]: false,
  //           [data.chatId + ".userInfo"]: {
  //             displayName: user?.displayName,
  //             phoneNumber: user?.phoneNo,
  //             photoURL: user?.photoURL,
  //             uid: user?.uid,
  //           },
  //           [data.chatId + ".date"]: serverTimestamp(),
  //         });
  //       });
  //     }
  //   }
  // };

  const handleSendFile = async (file) => {
    if (file) {
      setLoading(true);
      try {
        const fileExtension = file.name.split(".").pop();
        const fileType = file.type || getMimeType(fileExtension); // Fallback if file.type is missing

        const storageRef = ref(storage, `chat/${getAuth().currentUser.uid}/${uuid()}.${fileExtension}`);
        const uploadTask = await uploadBytesResumable(storageRef, file, {
          contentType: fileType, // Ensure correct MIME type
        });

        const fileURL = await getDownloadURL(uploadTask.ref);
        if (fileURL) {
          await updateDoc(doc(chatsCollection, data.chatId), {
            messages: arrayUnion({
              id: uuid(),
              text: "",
              senderId: user.uid,
              date: Timestamp.now(),
              fileUrl: fileURL,
              fileType,
              fileName: file.name,
              isRead: false,
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
    <div className="h-12 bg-white p-3 flex items-center justify-between ">
      <input
        type="text"
        placeholder="Type something..."
        className="w-full border-none outline-none text-[#2f2d52] text-lg placeholder-[lightgray] px-2 bg-transparent"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleSend();
          }
        }}
      />
      <div className="flex gap-2 items-center">
        {loading && (
          <span className="text-orange-500 text-xs block">Sending file...</span>
        )}
        <input
          type="file"
          name=""
          id="img"
          className="hidden"
          onChange={(e) => handleSendFile(e.target.files[0])}
        />
        <label htmlFor="img">
          <InsertPhotoIcon />
        </label>
        <button
          className="text-white bg-[var(--button-bg-color)] hover:bg-[var(--button-hover-bg-color)] py-1 px-2 rounded"
          onClick={handleSend}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default PartnerChatInput;
