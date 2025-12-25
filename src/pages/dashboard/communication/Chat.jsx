import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import MenuIcon from "@mui/icons-material/Menu";
import { deleteDoc, deleteField, doc, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { useContext, useState } from "react";
// import { AudioRecorder } from "react-audio-voice-recorder";
import VoiceRecorder from "../../../components/VoiceRecorder"; // Import Custom Recorder
import { AdminChatContext } from "../../../contextAPIs/AdminChatProvider";
import { db, storage } from "../../../firebase/firebase.config";
import { handleRedirectWhatsApp } from "../../../utils/utils";
import Input from "./Input";
import Messages from "./Messages";

const Chat = ({ setOpenSidebar }) => {
  const { data } = useContext(AdminChatContext);
  const [lastMessage, setLastMessage] = useState({});
  const [audioUrl, setAudioUrl] = useState("");

  const addAudioElement = async (blob) => {
    const fileRef = ref(storage, `file-${blob.size}`);

    const fileTask = await uploadBytesResumable(fileRef, blob);
    const fileURL = await getDownloadURL(fileTask.ref);
    setAudioUrl(fileURL);
  };

  const deleteChat = async () => {
    const confirmed = confirm("Are you sure you want to delete this chat?");
    if (confirmed) {
      try {
        let chatRoom = "";
        if (data) {
          chatRoom = data?.chatId?.split("_")[1];
        }
        await deleteDoc(doc(db, "chats", data.chatId));
        await updateDoc(doc(db, "chatRooms", chatRoom), {
          [data.chatId]: deleteField(),
        });
        alert("Chat successfully deleted.");
      } catch (error) {
        console.error("Error deleting chat:", error);
      }
    }
  };

  const isOlderThan3Months = (firebaseTimestamp) => {
    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(now.getMonth() - 3);

    return firebaseTimestamp?.toDate() < threeMonthsAgo;
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Modern Chat Header */}
      <div className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex gap-3 items-center">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setOpenSidebar((p) => !p)}
            className="lg:hidden p-2 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <MenuIcon className="text-neutral-600" />
          </button>

          {/* User Info */}
          {data?.oppositeUser?.photoURL && (
            <div className="relative">
              <img
                loading="lazy"
                src={data?.oppositeUser?.photoURL}
                alt={data?.oppositeUser?.displayName}
                className="h-12 w-12 rounded-full object-cover border-2 border-primary-200"
              />
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-success-500 border-2 border-white rounded-full"></span>
            </div>
          )}

          <div className="flex flex-col">
            <p className="font-bold text-neutral-800 text-lg">
              {data?.oppositeUser?.displayName || "No Username"}
            </p>
            <span className="text-sm text-neutral-500">
              {data?.oppositeUser?.phoneNumber || "No number"}
            </span>
          </div>
        </div>

        {/* Actions */}
        {data?.oppositeUser?.uid && (
          <div className="flex items-center gap-2">
            {/* Audio Recorder */}
            {/* Audio Recorder */}
            <div className="h-10 flex items-center">
              <VoiceRecorder onRecordingComplete={addAudioElement} />
            </div>

            {/* WhatsApp Button */}
            <button
              onClick={() => handleRedirectWhatsApp(data?.oppositeUser?.phoneNumber)}
              className="p-2 hover:bg-success-50 rounded-lg transition-all duration-200 group"
              title="Open in WhatsApp"
            >
              <img
                loading="lazy"
                src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
                alt="WhatsApp"
                className="w-8 h-8 transition-transform group-hover:scale-110"
              />
            </button>

            {/* Delete Chat Button */}
            {isOlderThan3Months(lastMessage?.date) && (
              <button
                className="p-2 bg-danger-50 hover:bg-danger-100 text-danger-600 rounded-lg 
                         transition-all duration-200 hover:scale-105"
                onClick={deleteChat}
                title="Delete old chat"
              >
                <DeleteForeverIcon />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Messages Area */}
      <Messages
        setLastMessage={setLastMessage}
        oppositeUser={data.oppositeUser}
      />

      {/* Input Area */}
      <Input
        lastMessage={lastMessage}
        audioUrl={audioUrl}
        setAudioUrl={setAudioUrl}
      />
    </div>
  );
};

export default Chat;
