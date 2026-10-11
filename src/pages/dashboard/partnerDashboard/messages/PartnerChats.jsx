import { getAuth } from "firebase/auth";
import { useContext, useState } from "react";
import Messages from "./Messages";
import { PartnerChatContext } from "../../../../contextAPIs/PartnerChatProvider";
import PartnerChatInput from "./PartnerChatInput";
import { storage } from "../../../../firebase/firebase.config";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import VoiceRecorder from "../../../../components/VoiceRecorder"; // Custom safe recorder

const PartnerChats = () => {
  const { data } = useContext(PartnerChatContext);
  const [audioUrl, setAudioUrl] = useState("");

  const addAudioElement = async (blob) => {
    // Note: path kept as original `chat/${getAuth().currentUser.uid}/${crypto.randomUUID()}` to avoid breaking existing logic if any
    const fileRef = ref(storage, `chat/${getAuth().currentUser.uid}/${crypto.randomUUID()}`);
    const fileTask = await uploadBytesResumable(fileRef, blob);
    const fileURL = await getDownloadURL(fileTask.ref);
    setAudioUrl(fileURL);
  };

  return (
    <div className="w-full h-full rounded-lg ">
      <div className="md:p-3 p-2 bg-[var(--chat-top-color)] z-10 flex items-center justify-between text-white">
        <div className="flex gap-2 items-center">
          <img
            src={data?.oppositeUser?.photoURL}
            alt=""
            className="h-10 w-10 rounded-full"
          />{" "}
          <div className="flex flex-col">
            <p className="font-bold text-[var(--all-user-details-color)] opacity-80">
              {data?.oppositeUser?.displayName
                ? data?.oppositeUser?.displayName
                : "No Username"}
            </p>
          </div>
        </div>
        <div>
          {/* Replaced crashing AudioRecorder with custom VoiceRecorder */}
          <VoiceRecorder onRecordingComplete={addAudioElement} />
        </div>
      </div>
      <Messages />
      <PartnerChatInput audioUrl={audioUrl} setAudioUrl={setAudioUrl} />
    </div>
  );
};

export default PartnerChats;
