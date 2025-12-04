import { useContext, useState } from "react";
import Messages from "./Messages";
import { PartnerChatContext } from "../../../../contextAPIs/PartnerChatProvider";
import PartnerChatInput from "./PartnerChatInput";
import { AudioRecorder } from "react-audio-voice-recorder";
import { storage } from "../../../../firebase/firebase.config";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";

const PartnerChats = () => {
  const { data } = useContext(PartnerChatContext);
  const [audioUrl, setAudioUrl] = useState("");

  const addAudioElement = async (blob) => {
    const fileRef = ref(storage, "first-autio");

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
          <AudioRecorder
            onRecordingComplete={addAudioElement}
            audioTrackConstraints={{
              noiseSuppression: true,
              echoCancellation: true,
            }}
            downloadFileExtension="webm"
          />
        </div>
      </div>
      <Messages />
      <PartnerChatInput audioUrl={audioUrl} setAudioUrl={setAudioUrl} />
    </div>
  );
};

export default PartnerChats;
