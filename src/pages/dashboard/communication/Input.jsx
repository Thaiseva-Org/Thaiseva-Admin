import { getAuth } from "firebase/auth";
/**
 * @file Input.jsx
 * @description Rich communication composer supporting real-time text, voice memos, and document attachments.
 *
 * Architecture & Features:
 * - Real-time message dispatch to active chat document `chats/{chatId}` via Firestore `arrayUnion`
 * - Automatic update of parent thread summary in `chatRooms/{chatRoom}` (`lastMessage`, timestamps, read receipts)
 * - Voice audio recording integration: automatically transmits audio memos once uploaded by the recorder
 * - Universal file uploader: binary stream to Firebase Storage (`uploads/`) with automatic MIME detection
 * - Read receipt automation: flags conversation as read upon operator focus
 *
 * @module Communication/Input
 */

import { InsertPhotoIcon } from "@icons";
import PropTypes from "prop-types";
import { useContext, useEffect, useState } from "react";
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

/**
 * Resolves standard MIME type for uploaded document extensions.
 *
 * @param {string} extension - File suffix (e.g. "pdf", "jpg", "docx").
 * @returns {string} Recognized MIME content-type.
 */
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
    webp: "image/webp",
  };
  return mimeTypes[extension?.toLowerCase()] || "application/octet-stream";
};

/**
 * Input Component.
 *
 * Bottom chat composer bar providing text input, file attachment, and voice transmission.
 */
const Input = ({ lastMessage, audioUrl, setAudioUrl }) => {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const { chatRoom } = useContext(PartnerContext);
  const { data } = useContext(AdminChatContext);

  // Automatically transmit voice memo once uploaded to storage
  useEffect(() => {
    const sendAudio = async () => {
      if (!audioUrl || !data?.chatId) return;

      const audioMessage = {
        id: uuid(),
        audioUrl,
        text: "",
        senderId: "_CustomerSupport",
        date: Timestamp.now(),
        isRead: false,
      };

      if (lastMessage?.serviceType) {
        audioMessage.serviceType = lastMessage.serviceType;
      }

      await updateDoc(doc(chatsCollection, data.chatId), {
        messages: arrayUnion(audioMessage),
      });
      setAudioUrl("");
    };

    if (audioUrl && data?.chatId) {
      sendAudio();
    }
  }, [audioUrl, data?.chatId, lastMessage?.serviceType, setAudioUrl]);

  // Mark chat room as read when opened
  useEffect(() => {
    const updateIsRead = async () => {
      if (data?.chatId && data.chatId.length > 40 && chatRoom) {
        await updateDoc(doc(chatRoomsCollection, chatRoom), {
          [`${data.chatId}.isRead`]: true,
        });
      }
    };

    if (data?.chatId && data.chatId.length > 40 && chatRoom) {
      updateIsRead();
    }
  }, [data?.chatId, chatRoom, lastMessage]);

  /**
   * Dispatches text message to active chat document and updates room summary.
   *
   * @async
   * @returns {Promise<void>}
   */
  const handleSend = async () => {
    if (!data?.chatId || !text.trim()) return;

    const currentText = text.trim();
    const newMessage = {
      id: uuid(),
      text: currentText,
      senderId: "_CustomerSupport",
      date: Timestamp.now(),
      imageUrl: "",
      isRead: false,
    };

    if (lastMessage?.serviceType) {
      newMessage.serviceType = lastMessage.serviceType;
    }

    setText("");

    await updateDoc(doc(chatsCollection, data.chatId), {
      messages: arrayUnion(newMessage),
    });

    if (chatRoom) {
      await updateDoc(doc(chatRoomsCollection, chatRoom), {
        [`${data.chatId}.lastMessage`]: {
          text: currentText,
        },
        [`${data.chatId}.audioUrl`]: false,
        [`${data.chatId}.imgUrl`]: false,
        [`${data.chatId}.date`]: serverTimestamp(),
      });
    }
  };

  /**
   * Uploads binary document or image attachment to Firebase Storage and appends message.
   *
   * @async
   * @param {File} file - Attachment selected by the user.
   * @returns {Promise<void>}
   */
  const handleSendFile = async (file) => {
    if (!file || !data?.chatId) return;

    setLoading(true);
    try {
      const fileExtension = file.name.split(".").pop();
      const fileType = file.type || getMimeType(fileExtension);

      const storageRef = ref(storage, `chat/${getAuth().currentUser.uid}/${uuid()}.${fileExtension}`);
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
            isRead: false,
          }),
        });
      }
    } catch (error) {
      console.error("File upload error:", error);
    } finally {
      setLoading(false);
    }
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

Input.propTypes = {
  lastMessage: PropTypes.object,
  audioUrl: PropTypes.string,
  setAudioUrl: PropTypes.func.isRequired,
};

export default Input;
