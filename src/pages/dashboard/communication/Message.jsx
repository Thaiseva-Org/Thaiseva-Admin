import { useContext } from "react";
import { AdminChatContext } from "../../../contextAPIs/AdminChatProvider";
import { DownloadForOfflineRoundedIcon } from "@icons";
import { DeleteIcon } from "@icons";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../../firebase/firebase.config";
import { PartnerContext } from "../../../contextAPIs/PartnerProvider";

const Message = ({ message }) => {
  const { data } = useContext(AdminChatContext);
  const { logo } = useContext(PartnerContext);

  let date;
  let time;

  if (message) {
    const seconds = new Date(message?.date?.seconds * 1000);
    date = seconds.toLocaleDateString();
    time = seconds?.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const handleDeleteMessage = async (id) => {
    const dod = doc(db, "chats", data.chatId);
    const res = await getDoc(dod);
    const { messages } = res.data();
    const remaining = messages.filter((message) => message?.id !== id);
    await updateDoc(dod, { messages: remaining });
  };

  const GetLocationMessage = ({ message }) => {
    const urlRegex = /(https?:\/\/[^\s]+)/;
    const match = message.match(urlRegex);
    const link = match ? match[0] : null;
    const text = link ? message.split(link)[0].trim() : message;
    return (
      <span>
        {text}{" "}
        {link && (
          <a
            href={link}
            target="_blank"
            className="underline text-blue-600"
            rel="noopener noreferrer"
          >
            {link}
          </a>
        )}
      </span>
    );
  };

  return message?.type !== "heading" ? (
    <div
      className={`flex gap-3 relative group ${
        message?.senderId === "_CustomerSupport" ? "flex-row-reverse" : ""
      }`}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        <img
          loading="lazy"
          src={
            message?.senderId === "_CustomerSupport"
              ? logo
              : data.oppositeUser.photoURL
          }
          alt=""
          className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-md"
        />
      </div>

      {/* Message Content */}
      <div
        className={`flex flex-col gap-2 max-w-[75%] md:max-w-[60%] ${
          message?.senderId === "_CustomerSupport" ? "items-end" : "items-start"
        }`}
      >
        {/* Timestamp */}
        <div className="flex items-center gap-2 px-2">
          <span className="text-xs text-neutral-500">{date}</span>
          <span className="text-xs text-neutral-400">{time}</span>
        </div>

        {/* Text Message */}
        {message?.text && (
          <div className="relative">
            <div
              className={`relative px-4 py-3 rounded-2xl shadow-sm ${
                message?.senderId === "_CustomerSupport"
                  ? "bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-tr-sm"
                  : "bg-white border border-neutral-200 text-neutral-800 rounded-tl-sm"
              }`}
            >
              <p className="text-sm leading-relaxed break-words">
                {message.type === "location" ? (
                  <GetLocationMessage message={`${message.text}`} />
                ) : (
                  message?.text
                )}
              </p>
            </div>
            
            {/* Delete Button (for admin messages) */}
            {message?.senderId === "_CustomerSupport" && (
              <button
                className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 
                         p-1.5 bg-danger-500 hover:bg-danger-600 text-white rounded-full 
                         transition-all duration-200 shadow-md"
                onClick={() => handleDeleteMessage(message?.id)}
              >
                <DeleteIcon fontSize="small" />
              </button>
            )}
          </div>
        )}

        {/* File/Image Message */}
        <div className="relative">
          {message?.fileType &&
            (message?.fileType === "image/jpeg" ||
            message?.fileType === "image/jpg" ||
            message?.fileType === "image/png" ||
            message?.fileType === "jpg" ||
            message?.fileType === "jpeg" ||
            message?.fileType === "png" ? (
              <img
                loading="lazy"
                src={message?.fileUrl}
                alt=""
                className="max-w-sm rounded-2xl shadow-lg border-2 border-white"
              />
            ) : (
              <a
                href={message?.fileUrl}
                download={message?.fileType}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 px-4 py-3 rounded-2xl shadow-sm transition-all duration-200 ${
                  message?.senderId === "_CustomerSupport"
                    ? "bg-gradient-to-br from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700"
                    : "bg-white border border-neutral-200 text-neutral-800 hover:bg-neutral-50"
                }`}
              >
                <DownloadForOfflineRoundedIcon />
                <span className="font-medium">Download File</span>
              </a>
            ))}

          {/* Audio Message */}
          {message?.audioUrl && (
            <audio 
              src={message?.audioUrl} 
              controls 
              className="rounded-xl shadow-md max-w-xs"
            ></audio>
          )}

          {/* Delete Button for Files */}
          {message?.senderId === "_CustomerSupport" && message?.fileType && (
            <button
              className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 
                       p-1.5 bg-danger-500 hover:bg-danger-600 text-white rounded-full 
                       transition-all duration-200 shadow-md"
              onClick={() => handleDeleteMessage(message?.id)}
            >
              <DeleteIcon fontSize="small" />
            </button>
          )}
        </div>
      </div>
    </div>
  ) : (
    <div className="flex justify-center my-4">
      <div className="bg-primary-100 border border-primary-200 rounded-full px-4 py-2">
        <span className="text-sm text-primary-700">
          Chatting in <span className="font-semibold">{message?.text}</span>
        </span>
      </div>
    </div>
  );
};

export default Message;
